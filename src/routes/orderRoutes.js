const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const authMiddleware = require('../middleware/authMiddleware');
const { buildAioParams, getMerchantTradeNo, queryTradeInfo } = require('../utils/ecpay');
const { calculateShipping, validateShippingInput, formatOrderShipping } = require('../utils/shipping');

const router = express.Router();

// POST /api/orders/:id/ecpay-return — No auth, ECPay browser redirect
router.post('/:id/ecpay-return', (req, res) => {
  res.redirect(`/orders/${req.params.id}?payment=ecpay`);
});

router.use(authMiddleware);

function generateOrderNo() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = uuidv4().slice(0, 5).toUpperCase();
  return `ORD-${dateStr}-${random}`;
}

/**
 * @openapi
 * /api/orders:
 *   post:
 *     summary: 從購物車建立訂單
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [recipientName, recipientEmail, recipientAddress, shippingMethod]
 *             properties:
 *               recipientName:
 *                 type: string
 *               recipientEmail:
 *                 type: string
 *                 format: email
 *               recipientAddress:
 *                 type: string
 *               shippingMethod:
 *                 type: string
 *                 enum: [home_delivery, convenience_store]
 *                 description: 宅配 120 元（商品小計滿 1,500 免）；超商取貨 60 元（不適用滿額免運）
 *               isRemoteArea:
 *                 type: boolean
 *                 default: false
 *                 description: 偏遠地區，加收 200 元
 *               isExpress:
 *                 type: boolean
 *                 default: false
 *                 description: 當日急件，加收 250 元
 *     responses:
 *       201:
 *         description: 訂單建立成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     order_no:
 *                       type: string
 *                     subtotal_amount:
 *                       type: integer
 *                       description: 商品小計
 *                     shipping_method:
 *                       type: string
 *                       enum: [home_delivery, convenience_store]
 *                     is_remote_area:
 *                       type: boolean
 *                     is_express:
 *                       type: boolean
 *                     shipping_fee:
 *                       type: integer
 *                       description: 運費（基本運費 + 附加費）
 *                     total_amount:
 *                       type: integer
 *                       description: 商品小計 + 運費
 *                     status:
 *                       type: string
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           product_name:
 *                             type: string
 *                           product_price:
 *                             type: integer
 *                           quantity:
 *                             type: integer
 *                     created_at:
 *                       type: string
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 message:
 *                   type: string
 *       400:
 *         description: 購物車為空、庫存不足、收件資訊缺失或配送資訊不合法
 */
router.post('/', (req, res) => {
  const {
    recipientName,
    recipientEmail,
    recipientAddress,
    shippingMethod,
    isRemoteArea = false,
    isExpress = false
  } = req.body;
  const userId = req.user.userId;

  if (!recipientName || !recipientEmail || !recipientAddress) {
    return res.status(400).json({
      data: null,
      error: 'VALIDATION_ERROR',
      message: '收件人姓名、Email 和地址為必填欄位'
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(recipientEmail)) {
    return res.status(400).json({
      data: null,
      error: 'VALIDATION_ERROR',
      message: 'Email 格式不正確'
    });
  }

  const shippingError = validateShippingInput({ shippingMethod, isRemoteArea, isExpress });
  if (shippingError) {
    return res.status(400).json({
      data: null,
      error: 'VALIDATION_ERROR',
      message: shippingError
    });
  }

  // Get cart items with product info
  const cartItems = db.prepare(
    `SELECT ci.id, ci.product_id, ci.quantity,
            p.name as product_name, p.price as product_price, p.stock as product_stock
     FROM cart_items ci
     JOIN products p ON ci.product_id = p.id
     WHERE ci.user_id = ?`
  ).all(userId);

  if (cartItems.length === 0) {
    return res.status(400).json({
      data: null,
      error: 'CART_EMPTY',
      message: '購物車為空'
    });
  }

  // Check stock
  const insufficientItems = cartItems.filter(item => item.quantity > item.product_stock);
  if (insufficientItems.length > 0) {
    const names = insufficientItems.map(i => i.product_name).join(', ');
    return res.status(400).json({
      data: null,
      error: 'STOCK_INSUFFICIENT',
      message: `以下商品庫存不足：${names}`
    });
  }

  // Calculate subtotal, shipping fee and total
  const subtotalAmount = cartItems.reduce(
    (sum, item) => sum + item.product_price * item.quantity, 0
  );
  const shipping = calculateShipping({ subtotal: subtotalAmount, shippingMethod, isRemoteArea, isExpress });
  const totalAmount = subtotalAmount + shipping.shipping_fee;

  const orderId = uuidv4();
  const orderNo = generateOrderNo();

  // Transaction: create order, order items, deduct stock, clear cart
  const createOrder = db.transaction(() => {
    db.prepare(
      `INSERT INTO orders (id, order_no, user_id, recipient_name, recipient_email, recipient_address,
                           shipping_method, is_remote_area, is_express, subtotal_amount, shipping_fee, total_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      orderId, orderNo, userId, recipientName, recipientEmail, recipientAddress,
      shippingMethod, isRemoteArea ? 1 : 0, isExpress ? 1 : 0, subtotalAmount, shipping.shipping_fee, totalAmount
    );

    const insertItem = db.prepare(
      `INSERT INTO order_items (id, order_id, product_id, product_name, product_price, quantity)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');

    for (const item of cartItems) {
      insertItem.run(uuidv4(), orderId, item.product_id, item.product_name, item.product_price, item.quantity);
      updateStock.run(item.quantity, item.product_id);
    }

    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
  });

  createOrder();

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  const orderItems = db.prepare(
    'SELECT product_name, product_price, quantity FROM order_items WHERE order_id = ?'
  ).all(orderId);

  res.status(201).json({
    data: {
      id: order.id,
      order_no: order.order_no,
      subtotal_amount: order.subtotal_amount,
      shipping_method: order.shipping_method,
      is_remote_area: Boolean(order.is_remote_area),
      is_express: Boolean(order.is_express),
      shipping_fee: order.shipping_fee,
      total_amount: order.total_amount,
      status: order.status,
      items: orderItems,
      created_at: order.created_at
    },
    error: null,
    message: '訂單建立成功'
  });
});

/**
 * @openapi
 * /api/orders:
 *   get:
 *     summary: 自己的訂單列表
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     orders:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           order_no:
 *                             type: string
 *                           total_amount:
 *                             type: integer
 *                           status:
 *                             type: string
 *                           created_at:
 *                             type: string
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 message:
 *                   type: string
 */
router.get('/', (req, res) => {
  const orders = db.prepare(
    'SELECT id, order_no, total_amount, status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user.userId);

  res.json({
    data: { orders },
    error: null,
    message: '成功'
  });
});

/**
 * @openapi
 * /api/orders/shipping-quote:
 *   get:
 *     summary: 依目前購物車試算運費與訂單總額
 *     description: 商品小計由後端依登入者購物車計算；實際建立訂單時會重新計算，不信任前端金額。
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: shippingMethod
 *         required: true
 *         schema:
 *           type: string
 *           enum: [home_delivery, convenience_store]
 *       - in: query
 *         name: isRemoteArea
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *           default: 'false'
 *       - in: query
 *         name: isExpress
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *           default: 'false'
 *     responses:
 *       200:
 *         description: 試算成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     subtotal_amount:
 *                       type: integer
 *                     base_fee:
 *                       type: integer
 *                     remote_area_fee:
 *                       type: integer
 *                     express_fee:
 *                       type: integer
 *                     shipping_fee:
 *                       type: integer
 *                     free_shipping_applied:
 *                       type: boolean
 *                     total_amount:
 *                       type: integer
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 message:
 *                   type: string
 *       400:
 *         description: 配送資訊不合法
 */
router.get('/shipping-quote', (req, res) => {
  const { shippingMethod } = req.query;

  // Query strings are text; only accept explicit 'true' / 'false'
  const flags = {};
  for (const key of ['isRemoteArea', 'isExpress']) {
    const value = req.query[key];
    if (value === undefined || value === 'false') {
      flags[key] = false;
    } else if (value === 'true') {
      flags[key] = true;
    } else {
      return res.status(400).json({
        data: null,
        error: 'VALIDATION_ERROR',
        message: `${key} 必須為 true 或 false`
      });
    }
  }

  const shippingError = validateShippingInput({ shippingMethod, ...flags });
  if (shippingError) {
    return res.status(400).json({
      data: null,
      error: 'VALIDATION_ERROR',
      message: shippingError
    });
  }

  const { subtotal } = db.prepare(
    `SELECT COALESCE(SUM(p.price * ci.quantity), 0) AS subtotal
     FROM cart_items ci
     JOIN products p ON ci.product_id = p.id
     WHERE ci.user_id = ?`
  ).get(req.user.userId);

  const shipping = calculateShipping({ subtotal, shippingMethod, ...flags });

  res.json({
    data: {
      subtotal_amount: subtotal,
      ...shipping,
      total_amount: subtotal + shipping.shipping_fee
    },
    error: null,
    message: '成功'
  });
});

/**
 * @openapi
 * /api/orders/{id}:
 *   get:
 *     summary: 訂單詳情
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     order_no:
 *                       type: string
 *                     recipient_name:
 *                       type: string
 *                     recipient_email:
 *                       type: string
 *                     recipient_address:
 *                       type: string
 *                     subtotal_amount:
 *                       type: integer
 *                     shipping_method:
 *                       type: string
 *                       nullable: true
 *                       enum: [home_delivery, convenience_store]
 *                     is_remote_area:
 *                       type: boolean
 *                     is_express:
 *                       type: boolean
 *                     shipping_fee:
 *                       type: integer
 *                     total_amount:
 *                       type: integer
 *                     status:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           product_id:
 *                             type: string
 *                           product_name:
 *                             type: string
 *                           product_price:
 *                             type: integer
 *                           quantity:
 *                             type: integer
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 message:
 *                   type: string
 *       404:
 *         description: 訂單不存在
 */
router.get('/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);

  if (!order) {
    return res.status(404).json({ data: null, error: 'NOT_FOUND', message: '訂單不存在' });
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);

  res.json({
    data: { ...formatOrderShipping(order), items },
    error: null,
    message: '成功'
  });
});

/**
 * @openapi
 * /api/orders/{id}/pay:
 *   patch:
 *     summary: 模擬付款（更新訂單付款狀態）
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [success, fail]
 *     responses:
 *       200:
 *         description: 付款狀態更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     order_no:
 *                       type: string
 *                     subtotal_amount:
 *                       type: integer
 *                     shipping_method:
 *                       type: string
 *                       nullable: true
 *                       enum: [home_delivery, convenience_store]
 *                     is_remote_area:
 *                       type: boolean
 *                     is_express:
 *                       type: boolean
 *                     shipping_fee:
 *                       type: integer
 *                     total_amount:
 *                       type: integer
 *                     status:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           product_name:
 *                             type: string
 *                           product_price:
 *                             type: integer
 *                           quantity:
 *                             type: integer
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 message:
 *                   type: string
 *       400:
 *         description: action 無效或訂單狀態不是 pending
 *       404:
 *         description: 訂單不存在
 */
router.patch('/:id/pay', (req, res) => {
  const { action } = req.body;
  const userId = req.user.userId;

  const actionMap = { success: 'paid', fail: 'failed' };
  if (!action || !actionMap[action]) {
    return res.status(400).json({
      data: null,
      error: 'VALIDATION_ERROR',
      message: 'action 必須為 success 或 fail'
    });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!order) {
    return res.status(404).json({ data: null, error: 'NOT_FOUND', message: '訂單不存在' });
  }

  if (order.status !== 'pending') {
    return res.status(400).json({
      data: null,
      error: 'INVALID_STATUS',
      message: '訂單狀態不是 pending，無法付款'
    });
  }

  const newStatus = actionMap[action];
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(newStatus, order.id);

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);

  res.json({
    data: { ...formatOrderShipping(updated), items },
    error: null,
    message: action === 'success' ? '付款成功' : '付款失敗'
  });
});

// POST /api/orders/:id/ecpay-form — Returns auto-submit HTML to ECPay (requires JWT)
router.post('/:id/ecpay-form', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);

  if (!order) {
    return res.status(404).json({ data: null, error: 'NOT_FOUND', message: '訂單不存在' });
  }
  if (order.status !== 'pending') {
    return res.status(400).json({ data: null, error: 'INVALID_STATUS', message: '訂單狀態不是 pending，無法付款' });
  }

  const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
  const params = buildAioParams(order, orderItems, order.id);

  const isStaging = process.env.ECPAY_ENV !== 'production';
  const ecpayUrl = isStaging
    ? 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5'
    : 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5';

  const inputs = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${String(v).replace(/"/g, '&quot;')}">`)
    .join('\n    ');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>前往付款...</title></head>
<body onload="document.f.submit()">
  <p style="font-family:sans-serif;text-align:center;margin-top:40px;">正在前往綠界付款頁面，請稍候...</p>
  <form name="f" method="POST" action="${ecpayUrl}">
    ${inputs}
  </form>
</body>
</html>`);
});

// POST /api/orders/:id/verify-payment — Query ECPay and update order status (requires JWT)
router.post('/:id/verify-payment', async (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);

  if (!order) {
    return res.status(404).json({ data: null, error: 'NOT_FOUND', message: '訂單不存在' });
  }

  // Idempotent: already processed
  if (order.status !== 'pending') {
    return res.json({ data: { status: order.status }, error: null, message: '訂單狀態已更新' });
  }

  try {
    const result = await queryTradeInfo(getMerchantTradeNo(order.order_no));

    if (result.TradeStatus === '1') {
      db.prepare('UPDATE orders SET status = ?, ecpay_trade_no = ? WHERE id = ?')
        .run('paid', result.TradeNo || null, order.id);
      return res.json({ data: { status: 'paid' }, error: null, message: '付款成功' });
    } else {
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('failed', order.id);
      return res.json({ data: { status: 'failed' }, error: null, message: '付款未完成' });
    }
  } catch (err) {
    return res.status(500).json({ data: null, error: 'INTERNAL_ERROR', message: '查詢付款狀態失敗，請稍後再試' });
  }
});

module.exports = router;
