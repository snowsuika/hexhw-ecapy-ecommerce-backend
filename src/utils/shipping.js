/**
 * Shipping fee calculation.
 *
 * Pure functions only — no Express, no database — so the rules can be unit tested
 * in isolation and shared by the order creation flow and the shipping quote API.
 *
 * Rules:
 * - Home delivery base fee: 120
 * - Convenience store pickup: 60 (NOT a base fee, so free shipping does not waive it)
 * - Subtotal >= 1,500: home delivery base fee is waived
 * - Remote area: +200 (always charged)
 * - Same-day express: +250 (always charged)
 */

const SHIPPING_METHODS = Object.freeze({
  HOME_DELIVERY: 'home_delivery',
  CONVENIENCE_STORE: 'convenience_store'
});

const SHIPPING_FEES = Object.freeze({
  [SHIPPING_METHODS.HOME_DELIVERY]: 120,
  [SHIPPING_METHODS.CONVENIENCE_STORE]: 60,
  REMOTE_AREA: 200,
  EXPRESS: 250
});

const FREE_SHIPPING_THRESHOLD = 1500;

const VALID_METHODS = Object.values(SHIPPING_METHODS);

/**
 * Validate shipping options from a request.
 * Returns an error message string, or null when the input is valid.
 */
function validateShippingInput({ shippingMethod, isRemoteArea, isExpress } = {}) {
  if (!shippingMethod) {
    return '配送方式為必填欄位';
  }
  if (!VALID_METHODS.includes(shippingMethod)) {
    return `配送方式必須為 ${VALID_METHODS.join(' 或 ')}`;
  }
  if (isRemoteArea !== undefined && typeof isRemoteArea !== 'boolean') {
    return 'isRemoteArea 必須為布林值';
  }
  if (isExpress !== undefined && typeof isExpress !== 'boolean') {
    return 'isExpress 必須為布林值';
  }
  return null;
}

/**
 * Calculate the shipping fee breakdown.
 * Throws when the input is invalid; callers handling user input should run
 * validateShippingInput() first to return a 400 instead.
 */
function calculateShipping({ subtotal, shippingMethod, isRemoteArea = false, isExpress = false } = {}) {
  if (!Number.isInteger(subtotal) || subtotal < 0) {
    throw new Error('subtotal 必須為大於等於 0 的整數');
  }
  const error = validateShippingInput({ shippingMethod, isRemoteArea, isExpress });
  if (error) {
    throw new Error(error);
  }

  const isHomeDelivery = shippingMethod === SHIPPING_METHODS.HOME_DELIVERY;
  // Free shipping only waives the home delivery base fee
  const freeShippingApplied = isHomeDelivery && subtotal >= FREE_SHIPPING_THRESHOLD;

  const baseFee = freeShippingApplied ? 0 : SHIPPING_FEES[shippingMethod];
  const remoteAreaFee = isRemoteArea ? SHIPPING_FEES.REMOTE_AREA : 0;
  const expressFee = isExpress ? SHIPPING_FEES.EXPRESS : 0;

  return {
    base_fee: baseFee,
    remote_area_fee: remoteAreaFee,
    express_fee: expressFee,
    shipping_fee: baseFee + remoteAreaFee + expressFee,
    free_shipping_applied: freeShippingApplied
  };
}

/**
 * SQLite stores booleans as 0/1; convert shipping flags on an order row
 * so every API returns them as real booleans.
 */
function formatOrderShipping(order) {
  return {
    ...order,
    is_remote_area: Boolean(order.is_remote_area),
    is_express: Boolean(order.is_express)
  };
}

module.exports = {
  SHIPPING_METHODS,
  SHIPPING_FEES,
  FREE_SHIPPING_THRESHOLD,
  validateShippingInput,
  calculateShipping,
  formatOrderShipping
};
