const { app, request, registerUser } = require('../setup');
// Same module instance as the app, so this is the same in-memory database
const db = require('../../src/database');

describe('Integration: member → cart → order with shipping', () => {
  let token;
  let userId;
  let product; // price < 1,500 with enough stock
  const originalStock = new Map();

  const auth = () => ({ Authorization: `Bearer ${token}` });

  const recipient = {
    recipientName: '整合測試收件人',
    recipientEmail: 'integration@example.com',
    recipientAddress: '台北市整合測試路 1 號',
  };

  function getStock(productId) {
    return db.prepare('SELECT stock FROM products WHERE id = ?').get(productId).stock;
  }

  function countUserOrders() {
    return db.prepare('SELECT COUNT(*) AS count FROM orders WHERE user_id = ?').get(userId).count;
  }

  function countOrphanOrderItems() {
    return db.prepare(
      'SELECT COUNT(*) AS count FROM order_items WHERE order_id NOT IN (SELECT id FROM orders)'
    ).get().count;
  }

  function getUserCartItems() {
    return db.prepare('SELECT product_id, quantity FROM cart_items WHERE user_id = ?').all(userId);
  }

  async function addToCart(productId, quantity) {
    const res = await request(app)
      .post('/api/cart')
      .set(auth())
      .send({ productId, quantity });
    expect(res.status).toBe(200);
  }

  beforeAll(async () => {
    // 1. Create a test member
    const registered = await registerUser({ name: '整合測試會員' });
    token = registered.token;
    userId = registered.user.id;

    // 2. Get product data
    const res = await request(app).get('/api/products?limit=100');
    expect(res.status).toBe(200);
    product = res.body.data.products.find((p) => p.price < 1500 && p.stock >= 10);
    expect(product).toBeDefined();

    for (const p of res.body.data.products) {
      originalStock.set(p.id, p.stock);
    }
  });

  beforeEach(() => {
    // Every scenario starts with an empty cart
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
  });

  afterAll(() => {
    // Clean up everything this file created
    const orderIds = db.prepare('SELECT id FROM orders WHERE user_id = ?').all(userId).map((o) => o.id);
    const deleteItems = db.prepare('DELETE FROM order_items WHERE order_id = ?');
    for (const id of orderIds) deleteItems.run(id);
    db.prepare('DELETE FROM orders WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    const restoreStock = db.prepare('UPDATE products SET stock = ? WHERE id = ?');
    for (const [id, stock] of originalStock) restoreStock.run(stock, id);
  });

  describe('successful order', () => {
    it('should create a home delivery order below the free shipping threshold', async () => {
      const quantity = 1;
      const stockBefore = getStock(product.id);

      // 3. Add product to cart
      await addToCart(product.id, quantity);

      // 4. Create order with shipping information
      const res = await request(app)
        .post('/api/orders')
        .set(auth())
        .send({ ...recipient, shippingMethod: 'home_delivery' });

      // 5. Verify the result — status code and response format
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('error', null);
      expect(res.body).toHaveProperty('message');
      expect(res.body.data).toBeDefined();

      const subtotal = product.price * quantity;
      const data = res.body.data;
      expect(data).toMatchObject({
        subtotal_amount: subtotal,
        shipping_method: 'home_delivery',
        is_remote_area: false,
        is_express: false,
        shipping_fee: 120,
        total_amount: subtotal + 120,
        status: 'pending',
      });

      // Order written to the database
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(data.id);
      expect(order).toMatchObject({
        user_id: userId,
        recipient_name: recipient.recipientName,
        recipient_email: recipient.recipientEmail,
        recipient_address: recipient.recipientAddress,
        shipping_method: 'home_delivery',
        is_remote_area: 0,
        is_express: 0,
        subtotal_amount: subtotal,
        shipping_fee: 120,
        total_amount: subtotal + 120,
        status: 'pending',
      });

      // Order items written with price snapshot
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(data.id);
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        product_id: product.id,
        product_name: product.name,
        product_price: product.price,
        quantity,
      });

      // Stock deducted
      expect(getStock(product.id)).toBe(stockBefore - quantity);

      // Cart cleared
      const cartRes = await request(app).get('/api/cart').set(auth());
      expect(cartRes.status).toBe(200);
      expect(cartRes.body.data.items).toHaveLength(0);
      expect(getUserCartItems()).toHaveLength(0);
    });

    it('should keep surcharges when free shipping applies', async () => {
      const quantity = Math.ceil(1500 / product.price);
      const stockBefore = getStock(product.id);

      await addToCart(product.id, quantity);

      const res = await request(app)
        .post('/api/orders')
        .set(auth())
        .send({ ...recipient, shippingMethod: 'home_delivery', isRemoteArea: true, isExpress: true });

      expect(res.status).toBe(201);
      expect(res.body.error).toBeNull();

      const subtotal = product.price * quantity;
      expect(subtotal).toBeGreaterThanOrEqual(1500);
      // Base fee waived, remote area 200 + express 250 still charged
      expect(res.body.data).toMatchObject({
        subtotal_amount: subtotal,
        is_remote_area: true,
        is_express: true,
        shipping_fee: 450,
        total_amount: subtotal + 450,
      });

      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(res.body.data.id);
      expect(order).toMatchObject({ is_remote_area: 1, is_express: 1, shipping_fee: 450, total_amount: subtotal + 450 });

      const items = db.prepare('SELECT quantity FROM order_items WHERE order_id = ?').all(res.body.data.id);
      expect(items).toEqual([{ quantity }]);

      expect(getStock(product.id)).toBe(stockBefore - quantity);
      expect(getUserCartItems()).toHaveLength(0);
    });
  });

  describe('failed order leaves no partial data', () => {
    it('should not create an order or deduct stock when stock is insufficient', async () => {
      await addToCart(product.id, 2);
      // Stock drops after the item was added to the cart
      db.prepare('UPDATE products SET stock = 1 WHERE id = ?').run(product.id);
      const ordersBefore = countUserOrders();

      const res = await request(app)
        .post('/api/orders')
        .set(auth())
        .send({ ...recipient, shippingMethod: 'home_delivery' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ data: null, error: 'STOCK_INSUFFICIENT' });

      expect(countUserOrders()).toBe(ordersBefore);
      expect(countOrphanOrderItems()).toBe(0);
      expect(getStock(product.id)).toBe(1);
      expect(getUserCartItems()).toEqual([{ product_id: product.id, quantity: 2 }]);

      db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(originalStock.get(product.id), product.id);
    });

    it('should roll back the whole transaction when writing order items fails', async () => {
      await addToCart(product.id, 1);
      const stockBefore = getStock(product.id);
      const ordersBefore = countUserOrders();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Force a failure in the middle of the transaction (after the orders INSERT)
      db.exec(`
        CREATE TEMP TRIGGER fail_order_items_insert
        BEFORE INSERT ON order_items
        BEGIN
          SELECT RAISE(ABORT, 'forced failure for integration test');
        END;
      `);

      try {
        const res = await request(app)
          .post('/api/orders')
          .set(auth())
          .send({ ...recipient, shippingMethod: 'convenience_store' });

        expect(res.status).toBe(500);
        expect(res.body.data).toBeNull();
        expect(res.body.error).not.toBeNull();
      } finally {
        db.exec('DROP TRIGGER IF EXISTS fail_order_items_insert');
        consoleError.mockRestore();
      }

      expect(countUserOrders()).toBe(ordersBefore);
      expect(countOrphanOrderItems()).toBe(0);
      expect(getStock(product.id)).toBe(stockBefore);
      expect(getUserCartItems()).toEqual([{ product_id: product.id, quantity: 1 }]);
    });

    it('should reject an unsupported shipping method without writing anything', async () => {
      await addToCart(product.id, 1);
      const stockBefore = getStock(product.id);
      const ordersBefore = countUserOrders();

      const res = await request(app)
        .post('/api/orders')
        .set(auth())
        .send({ ...recipient, shippingMethod: 'drone' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ data: null, error: 'VALIDATION_ERROR' });

      expect(countUserOrders()).toBe(ordersBefore);
      expect(getStock(product.id)).toBe(stockBefore);
      expect(getUserCartItems()).toHaveLength(1);
    });
  });
});
