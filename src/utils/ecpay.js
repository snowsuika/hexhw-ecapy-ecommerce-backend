const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');

function ecpayUrlEncode(source) {
  let encoded = encodeURIComponent(source);
  // space: %20 → + (PHP urlencode behavior)
  encoded = encoded.replace(/%20/g, '+');
  // ~ is not encoded by encodeURIComponent but PHP gives %7E → strtolower → %7e
  encoded = encoded.replace(/~/g, '%7e');
  // ' is not encoded by encodeURIComponent but PHP urlencode gives %27
  encoded = encoded.replace(/'/g, '%27');
  // convert to lowercase (PHP strtolower)
  encoded = encoded.toLowerCase();
  // .NET special char restorations
  encoded = encoded
    .replace(/%2d/g, '-')
    .replace(/%5f/g, '_')
    .replace(/%2e/g, '.')
    .replace(/%21/g, '!')
    .replace(/%2a/g, '*')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')');
  return encoded;
}

function generateCheckMacValue(params, hashKey, hashIV) {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([k]) => k !== 'CheckMacValue')
  );
  const sorted = Object.entries(filtered).sort((a, b) =>
    a[0].toLowerCase().localeCompare(b[0].toLowerCase())
  );
  const paramStr = sorted.map(([k, v]) => `${k}=${v}`).join('&');
  const raw = `HashKey=${hashKey}&${paramStr}&HashIV=${hashIV}`;
  const encoded = ecpayUrlEncode(raw);
  return crypto.createHash('sha256').update(encoded, 'utf8').digest('hex').toUpperCase();
}

// Derive ECPay MerchantTradeNo from order_no (strip dashes, ≤ 20 chars)
function getMerchantTradeNo(orderNo) {
  return orderNo.replace(/-/g, '');
}

function formatEcpayDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function buildAioParams(order, orderItems, orderId) {
  const hashKey = process.env.ECPAY_HASH_KEY;
  const hashIV = process.env.ECPAY_HASH_IV;
  const merchantId = process.env.ECPAY_MERCHANT_ID;
  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';

  const itemName = orderItems
    .map(i => `${i.product_name} x${i.quantity}`)
    .join('#')
    .slice(0, 400);

  const params = {
    MerchantID: merchantId,
    MerchantTradeNo: getMerchantTradeNo(order.order_no),
    MerchantTradeDate: formatEcpayDate(new Date()),
    PaymentType: 'aio',
    TotalAmount: order.total_amount,
    TradeDesc: '花店電商訂單',
    ItemName: itemName,
    ReturnURL: `${baseUrl}/api/orders/${orderId}/ecpay-return`,
    OrderResultURL: `${baseUrl}/api/orders/${orderId}/ecpay-return`,
    ChoosePayment: 'ALL',
    EncryptType: 1,
  };

  params.CheckMacValue = generateCheckMacValue(params, hashKey, hashIV);
  return params;
}

function queryTradeInfo(merchantTradeNo) {
  const hashKey = process.env.ECPAY_HASH_KEY;
  const hashIV = process.env.ECPAY_HASH_IV;
  const merchantId = process.env.ECPAY_MERCHANT_ID;
  const isStaging = process.env.ECPAY_ENV !== 'production';

  const params = {
    MerchantID: merchantId,
    MerchantTradeNo: merchantTradeNo,
    TimeStamp: String(Math.floor(Date.now() / 1000)),
  };
  params.CheckMacValue = generateCheckMacValue(params, hashKey, hashIV);

  const body = querystring.stringify(params);
  const hostname = isStaging
    ? 'payment-stage.ecpay.com.tw'
    : 'payment.ecpay.com.tw';

  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path: '/Cashier/QueryTradeInfo/V5',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        resolve(Object.fromEntries(new URLSearchParams(raw)));
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { generateCheckMacValue, getMerchantTradeNo, buildAioParams, queryTradeInfo };
