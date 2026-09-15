const path = require('path');
const { test, expect } = require('./fixtures');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@hexschool.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '12345678';

// ECPay staging pages are third-party and may change; keep their selectors in one place
const ECPAY = {
  urlPattern: /payment-stage\.ecpay\.com\.tw/,
  webAtm: /網路\s*ATM/,
  bank: '台灣土地銀行',
  goPay: '前往付款',
  closeDialog: '關閉',
  bankSave: 'Save',
  backToStore: '返回商店',
};

test('member checkout with shipping and pays via ECPay WebATM', async ({ page }, testInfo) => {
  // 1. Login
  await page.goto('/login');
  await page.locator('input[type="email"]:visible').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"]:visible').first().fill(ADMIN_PASSWORD);
  await Promise.all([
    page.waitForURL((url) => url.pathname === '/'),
    page.locator('form:visible button[type="submit"]').first().click(),
  ]);

  const authHeaders = await page.evaluate(() => Auth.getAuthHeaders());
  expect(authHeaders.Authorization).toBeTruthy();

  // Start from an empty cart so the amounts are predictable
  const cartRes = await page.request.get('/api/cart', { headers: authHeaders });
  for (const item of (await cartRes.json()).data.items) {
    await page.request.delete(`/api/cart/${item.id}`, { headers: authHeaders });
  }

  // 2. Choose a product and add it to the cart
  const addButton = page.getByRole('button', { name: '加入購物車' }).first();
  await expect(addButton).toBeEnabled();
  await Promise.all([
    page.waitForResponse((res) => res.url().endsWith('/api/cart') && res.request().method() === 'POST' && res.ok()),
    addButton.click(),
  ]);

  // 3. Go to checkout
  await page.goto('/cart');
  await Promise.all([
    page.waitForURL('**/checkout'),
    page.getByRole('button', { name: '前往結帳' }).click(),
  ]);

  // 4. Fill shipping method and recipient data
  await page.getByPlaceholder('請輸入收件人姓名').fill('E2E 測試收件人');
  await page.getByPlaceholder('請輸入 Email').fill('e2e@example.com');
  await page.getByPlaceholder('請輸入收件地址').fill('台北市 E2E 測試路 1 號');
  const quoteResponse = page.waitForResponse((res) => res.url().includes('/api/orders/shipping-quote') && res.ok());
  await page.locator('input[name="shippingMethod"][value="home_delivery"]').check();
  const quote = (await (await quoteResponse).json()).data;
  await expect(page.getByText(`NT$ ${quote.total_amount.toLocaleString()}`).last()).toBeVisible();

  // 5. Create the order
  // The page redirects right after the response, so its body can't be read here;
  // take the order id from the URL and load the order through the API instead
  const [orderResponse] = await Promise.all([
    page.waitForResponse((res) => res.url().endsWith('/api/orders') && res.request().method() === 'POST'),
    page.getByRole('button', { name: '確認送出訂單' }).click(),
  ]);
  expect(orderResponse.status()).toBe(201);
  await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/);
  const orderId = new URL(page.url()).pathname.split('/').pop();
  const createdRes = await page.request.get(`/api/orders/${orderId}`, { headers: authHeaders });
  const order = (await createdRes.json()).data;
  expect(order.status).toBe('pending');
  expect(order.shipping_method).toBe('home_delivery');
  expect(order.total_amount).toBe(quote.total_amount);

  // 6. Go to ECPay staging
  await Promise.all([
    page.waitForURL(ECPAY.urlPattern, { timeout: 60_000 }),
    page.getByRole('button', { name: '前往綠界付款' }).click(),
  ]);

  // 7. Choose WebATM
  await page.getByText(ECPAY.webAtm).first().click();

  // 8. Choose Land Bank of Taiwan
  await page.locator('select:visible').filter({ hasText: ECPAY.bank }).first().selectOption({ label: ECPAY.bank });

  // 9. Go to payment
  await page.getByText(ECPAY.goPay, { exact: true }).locator('visible=true').first().click();

  // 10. Close the reminder dialog
  await page.getByText(ECPAY.closeDialog, { exact: true }).locator('visible=true').first().click();

  // 11. Click Save on the mock bank page
  const saveButton = page.getByRole('button', { name: ECPAY.bankSave }).or(page.locator(`input[value="${ECPAY.bankSave}"]`));
  await saveButton.first().click({ timeout: 60_000 });

  // 12–13. Wait for ECPay success, then return to the store.
  // ECPay staging either shows a "返回商店" button or auto-submits back to OrderResultURL,
  // so accept whichever happens first and record which path was taken.
  const orderPageUrl = new RegExp(`/orders/${order.id}`);
  const backToStore = page.getByText(ECPAY.backToStore).locator('visible=true').first();
  const autoReturned = page.waitForURL(orderPageUrl, { timeout: 90_000 }).then(() => 'auto-redirect');
  const buttonShown = backToStore.waitFor({ timeout: 90_000 }).then(() => 'back-to-store-button');
  autoReturned.catch(() => {});
  buttonShown.catch(() => {});

  const returnPath = await Promise.race([autoReturned, buttonShown]);
  if (returnPath === 'back-to-store-button') {
    await Promise.all([
      page.waitForURL(orderPageUrl, { timeout: 60_000 }),
      backToStore.click(),
    ]);
  }
  testInfo.annotations.push({ type: 'ecpay-return', description: returnPath });

  // 14. Order page shows "已付款"
  await expect(page.getByText('已付款').first()).toBeVisible({ timeout: 30_000 });

  // 15. Order status is paid (API is the primary assertion)
  const detailRes = await page.request.get(`/api/orders/${order.id}`, { headers: authHeaders });
  expect(detailRes.ok()).toBeTruthy();
  expect((await detailRes.json()).data.status).toBe('paid');

  // Screenshot after returning to the store
  const screenshotPath = path.join(__dirname, 'screenshots', `paid-${order.order_no}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach('paid-order', { path: screenshotPath, contentType: 'image/png' });
});
