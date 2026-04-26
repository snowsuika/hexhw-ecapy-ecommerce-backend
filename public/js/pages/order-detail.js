const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    if (!Auth.requireAuth()) return {};

    const el = document.getElementById('app');
    const orderId = el.dataset.orderId;
    const paymentResult = ref(el.dataset.paymentResult || null);

    const order = ref(null);
    const loading = ref(true);
    const paying = ref(false);

    const statusMap = {
      pending: { label: '待付款', cls: 'bg-apricot/20 text-apricot' },
      paid: { label: '已付款', cls: 'bg-sage/20 text-sage' },
      failed: { label: '付款失敗', cls: 'bg-red-100 text-red-600' },
    };

    const paymentMessages = {
      success: { text: '付款成功！感謝您的購買。', cls: 'bg-sage/10 text-sage border border-sage/20' },
      failed: { text: '付款失敗，請重試。', cls: 'bg-red-50 text-red-600 border border-red-100' },
      cancel: { text: '付款已取消。', cls: 'bg-apricot/10 text-apricot border border-apricot/20' },
      ecpay: { text: '正在確認付款結果...', cls: 'bg-gray-50 text-gray-600 border border-gray-200' },
    };

    async function goToEcpay() {
      if (!order.value || paying.value) return;
      paying.value = true;
      try {
        const res = await fetch('/api/orders/' + orderId + '/ecpay-form', {
          method: 'POST',
          headers: Auth.getAuthHeaders(),
        });
        if (!res.ok) {
          const data = await res.json();
          Notification.show(data.message || '無法前往付款頁面', 'error');
          return;
        }
        const html = await res.text();
        document.open();
        document.write(html);
        document.close();
      } catch (e) {
        Notification.show('前往付款頁面失敗', 'error');
      } finally {
        paying.value = false;
      }
    }

    async function verifyPayment() {
      paying.value = true;
      try {
        const res = await apiFetch('/api/orders/' + orderId + '/verify-payment', { method: 'POST' });
        order.value = { ...order.value, status: res.data.status };
        paymentResult.value = res.data.status === 'paid' ? 'success' : 'failed';
      } catch (e) {
        Notification.show('確認付款結果失敗，請重新整理頁面', 'error');
      } finally {
        paying.value = false;
      }
    }

    onMounted(async function () {
      try {
        const res = await apiFetch('/api/orders/' + orderId);
        order.value = res.data;
      } catch (e) {
        Notification.show('載入訂單失敗', 'error');
      } finally {
        loading.value = false;
      }

      if (paymentResult.value === 'ecpay') {
        await verifyPayment();
      }
    });

    return { order, loading, paying, paymentResult, statusMap, paymentMessages, goToEcpay };
  }
}).mount('#app');
