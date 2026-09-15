const { createApp, ref, computed, watch, onMounted } = Vue;

createApp({
  setup() {
    if (!Auth.requireAuth()) return {};

    const loading = ref(true);
    const submitting = ref(false);
    const cartItems = ref([]);
    const form = ref({
      recipientName: '',
      recipientEmail: '',
      recipientAddress: '',
      shippingMethod: '',
      isRemoteArea: false,
      isExpress: false
    });
    const errors = ref({});
    const quote = ref(null);
    const quoteLoading = ref(false);
    let quoteRequestId = 0;

    const shippingOptions = [
      { value: 'home_delivery', label: '宅配', hint: 'NT$ 120' },
      { value: 'convenience_store', label: '超商取貨', hint: 'NT$ 60' }
    ];

    const cartTotal = computed(function () {
      return cartItems.value.reduce(function (sum, item) {
        return sum + item.product.price * item.quantity;
      }, 0);
    });

    // Shipping is always calculated by the backend; the page only displays the quote
    const summarySubtotal = computed(function () {
      return quote.value ? quote.value.subtotal_amount : cartTotal.value;
    });

    const summaryTotal = computed(function () {
      return quote.value ? quote.value.total_amount : cartTotal.value;
    });

    async function fetchQuote() {
      if (!form.value.shippingMethod) {
        quote.value = null;
        return;
      }
      const requestId = ++quoteRequestId;
      quoteLoading.value = true;
      const params = new URLSearchParams({
        shippingMethod: form.value.shippingMethod,
        isRemoteArea: String(form.value.isRemoteArea),
        isExpress: String(form.value.isExpress)
      });
      try {
        const res = await apiFetch('/api/orders/shipping-quote?' + params.toString());
        // Ignore responses from outdated option changes
        if (requestId === quoteRequestId) quote.value = res.data;
      } catch (err) {
        if (requestId === quoteRequestId) {
          quote.value = null;
          Notification.show(err?.data?.message || '運費試算失敗', 'error');
        }
      } finally {
        if (requestId === quoteRequestId) quoteLoading.value = false;
      }
    }

    watch(
      function () {
        return [form.value.shippingMethod, form.value.isRemoteArea, form.value.isExpress];
      },
      fetchQuote
    );

    function validate() {
      errors.value = {};
      if (!form.value.recipientName.trim()) errors.value.recipientName = '請輸入收件人姓名';
      if (!form.value.recipientEmail.trim()) {
        errors.value.recipientEmail = '請輸入 Email';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.recipientEmail)) {
        errors.value.recipientEmail = 'Email 格式不正確';
      }
      if (!form.value.recipientAddress.trim()) errors.value.recipientAddress = '請輸入收件地址';
      if (!form.value.shippingMethod) errors.value.shippingMethod = '請選擇配送方式';
      return Object.keys(errors.value).length === 0;
    }

    async function submitOrder() {
      if (!validate() || submitting.value) return;
      submitting.value = true;
      try {
        const res = await apiFetch('/api/orders', {
          method: 'POST',
          body: JSON.stringify(form.value)
        });
        Notification.show('訂單已建立', 'success');
        window.location.href = '/orders/' + res.data.id;
      } catch (err) {
        Notification.show(err?.data?.message || '訂單建立失敗', 'error');
      } finally {
        submitting.value = false;
      }
    }

    onMounted(async function () {
      try {
        const res = await apiFetch('/api/cart');
        cartItems.value = res.data.items;
        if (cartItems.value.length === 0) {
          window.location.href = '/cart';
          return;
        }
      } catch (e) {
        window.location.href = '/cart';
        return;
      }
      loading.value = false;
    });

    return {
      loading, submitting, cartItems, form, errors, cartTotal,
      shippingOptions, quote, quoteLoading, summarySubtotal, summaryTotal, submitOrder
    };
  }
}).mount('#app');
