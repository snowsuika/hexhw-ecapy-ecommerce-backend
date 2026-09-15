const {
  calculateShipping,
  validateShippingInput,
  SHIPPING_METHODS,
} = require('../src/utils/shipping');

const { HOME_DELIVERY, CONVENIENCE_STORE } = SHIPPING_METHODS;

describe('Shipping module', () => {
  describe('calculateShipping', () => {
    it('should charge 120 base fee for home delivery', () => {
      const result = calculateShipping({ subtotal: 1000, shippingMethod: HOME_DELIVERY });

      expect(result).toEqual({
        base_fee: 120,
        remote_area_fee: 0,
        express_fee: 0,
        shipping_fee: 120,
        free_shipping_applied: false,
      });
    });

    it('should charge 60 for convenience store pickup', () => {
      const result = calculateShipping({ subtotal: 1000, shippingMethod: CONVENIENCE_STORE });

      expect(result.base_fee).toBe(60);
      expect(result.shipping_fee).toBe(60);
      expect(result.free_shipping_applied).toBe(false);
    });

    it('should still charge base fee when subtotal is 1,499', () => {
      const result = calculateShipping({ subtotal: 1499, shippingMethod: HOME_DELIVERY });

      expect(result.base_fee).toBe(120);
      expect(result.shipping_fee).toBe(120);
      expect(result.free_shipping_applied).toBe(false);
    });

    it('should waive base fee when subtotal reaches 1,500', () => {
      const result = calculateShipping({ subtotal: 1500, shippingMethod: HOME_DELIVERY });

      expect(result.base_fee).toBe(0);
      expect(result.shipping_fee).toBe(0);
      expect(result.free_shipping_applied).toBe(true);
    });

    it('should add 200 for remote area', () => {
      const result = calculateShipping({
        subtotal: 1000,
        shippingMethod: HOME_DELIVERY,
        isRemoteArea: true,
      });

      expect(result.remote_area_fee).toBe(200);
      expect(result.shipping_fee).toBe(320);
    });

    it('should add 250 for same-day express', () => {
      const result = calculateShipping({
        subtotal: 1000,
        shippingMethod: HOME_DELIVERY,
        isExpress: true,
      });

      expect(result.express_fee).toBe(250);
      expect(result.shipping_fee).toBe(370);
    });

    it('should add multiple surcharges together', () => {
      const result = calculateShipping({
        subtotal: 1000,
        shippingMethod: HOME_DELIVERY,
        isRemoteArea: true,
        isExpress: true,
      });

      expect(result).toEqual({
        base_fee: 120,
        remote_area_fee: 200,
        express_fee: 250,
        shipping_fee: 570,
        free_shipping_applied: false,
      });
    });

    it('should keep surcharges when free shipping applies', () => {
      const result = calculateShipping({
        subtotal: 1500,
        shippingMethod: HOME_DELIVERY,
        isRemoteArea: true,
        isExpress: true,
      });

      expect(result).toEqual({
        base_fee: 0,
        remote_area_fee: 200,
        express_fee: 250,
        shipping_fee: 450,
        free_shipping_applied: true,
      });
    });

    it('should not waive convenience store fee when subtotal reaches 1,500', () => {
      const result = calculateShipping({ subtotal: 1500, shippingMethod: CONVENIENCE_STORE });

      expect(result.base_fee).toBe(60);
      expect(result.shipping_fee).toBe(60);
      expect(result.free_shipping_applied).toBe(false);
    });

    it('should throw for an unsupported shipping method', () => {
      expect(() => calculateShipping({ subtotal: 1000, shippingMethod: 'drone' })).toThrow();
    });

    it('should throw for a negative or non-integer subtotal', () => {
      expect(() => calculateShipping({ subtotal: -1, shippingMethod: HOME_DELIVERY })).toThrow();
      expect(() => calculateShipping({ subtotal: 99.5, shippingMethod: HOME_DELIVERY })).toThrow();
      expect(() => calculateShipping({ subtotal: '1000', shippingMethod: HOME_DELIVERY })).toThrow();
    });
  });

  describe('validateShippingInput', () => {
    it('should accept valid input', () => {
      expect(validateShippingInput({ shippingMethod: HOME_DELIVERY })).toBeNull();
      expect(validateShippingInput({
        shippingMethod: CONVENIENCE_STORE,
        isRemoteArea: false,
        isExpress: true,
      })).toBeNull();
    });

    it('should reject missing shipping method', () => {
      expect(validateShippingInput({})).toEqual(expect.any(String));
    });

    it('should reject non-boolean surcharge flags', () => {
      expect(validateShippingInput({ shippingMethod: HOME_DELIVERY, isRemoteArea: 'true' }))
        .toEqual(expect.any(String));
      expect(validateShippingInput({ shippingMethod: HOME_DELIVERY, isExpress: 1 }))
        .toEqual(expect.any(String));
    });
  });
});
