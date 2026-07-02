const { createApp, ref, onMounted, nextTick } = Vue;

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
if (hasGsap) {
  gsap.registerPlugin(ScrollTrigger);
}

let cardScrollTriggers = [];

function animateProductCards() {
  if (!hasGsap || prefersReducedMotion) return;
  cardScrollTriggers.forEach(function (st) { st.kill(); });
  cardScrollTriggers = [];

  ['#featured-products', '#products'].forEach(function (sectionSelector) {
    const cards = document.querySelectorAll(sectionSelector + ' .card-elevated');
    if (!cards.length) return;
    gsap.set(cards, { opacity: 0, y: 24 });
    cardScrollTriggers.push(
      ScrollTrigger.batch(cards, {
        start: 'top 88%',
        once: true,
        onEnter: function (batch) {
          gsap.to(batch, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.08 });
        }
      })
    );
  });
}

function initStaticAnimations() {
  if (!hasGsap || prefersReducedMotion) return;

  gsap.timeline({ defaults: { ease: 'power2.out' } })
    .from('#hero .gold-line', { opacity: 0, scaleX: 0, transformOrigin: 'left', duration: 0.5 })
    .from('#hero h1', { opacity: 0, y: 20, duration: 0.6 }, '-=0.2')
    .from('#hero p', { opacity: 0, y: 16, duration: 0.6 }, '-=0.35')
    .from('#hero .btn-primary', { opacity: 0, y: 12, duration: 0.5 }, '-=0.3');

  gsap.from('#brand-story .gold-line, #brand-story h2, #brand-story p', {
    opacity: 0,
    y: 20,
    duration: 0.6,
    stagger: 0.12,
    ease: 'power2.out',
    scrollTrigger: { trigger: '#brand-story', start: 'top 75%' }
  });

  gsap.to('#brand-story-img', {
    yPercent: 12,
    ease: 'none',
    scrollTrigger: { trigger: '#brand-story', start: 'top bottom', end: 'bottom top', scrub: true }
  });

  gsap.from('#testimonials .card-elevated', {
    opacity: 0,
    y: 24,
    duration: 0.5,
    stagger: 0.1,
    ease: 'power2.out',
    scrollTrigger: { trigger: '#testimonials', start: 'top 80%' }
  });

  gsap.from('#services > div', {
    opacity: 0,
    scale: 0.85,
    duration: 0.5,
    stagger: 0.1,
    ease: 'back.out(1.7)',
    scrollTrigger: { trigger: '#services', start: 'top 85%' }
  });
}

createApp({
  setup() {
    const products = ref([]);
    const pagination = ref({ total: 0, page: 1, limit: 9, totalPages: 0 });
    const loading = ref(true);

    const featuredImages = [
      'https://images.unsplash.com/photo-1620142828449-203a4979d9c3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
      'https://images.unsplash.com/photo-1692167900605-e02666cadb6d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
      'https://images.unsplash.com/photo-1561593291-cc3650b2df7c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
      'https://images.unsplash.com/photo-1615385639736-362b69696227?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    ];

    async function loadProducts(page) {
      page = page || 1;
      loading.value = true;
      try {
        const res = await apiFetch('/api/products?page=' + page + '&limit=9');
        products.value = res.data.products.map(function (p) {
          p._adding = false;
          return p;
        });
        pagination.value = res.data.pagination;
      } catch (e) {
        products.value = [];
      } finally {
        loading.value = false;
        await nextTick();
        animateProductCards();
      }
    }

    function goToProduct(id) {
      window.location.href = '/products/' + id;
    }

    async function addToCart(product) {
      if (product._adding) return;
      product._adding = true;
      try {
        await apiFetch('/api/cart', {
          method: 'POST',
          body: JSON.stringify({ productId: product.id, quantity: 1 })
        });
        Notification.show('已加入購物車', 'success');
        // Update cart badge
        var badge = document.getElementById('cart-badge');
        if (badge) {
          var count = parseInt(badge.textContent || '0') + 1;
          badge.textContent = count;
          badge.style.display = 'flex';
        }
      } catch (e) {
        Notification.show('加入購物車失敗', 'error');
      } finally {
        product._adding = false;
      }
    }

    onMounted(function () {
      initStaticAnimations();
      loadProducts(1);
    });

    return {
      products, pagination, loading, featuredImages,
      loadProducts, goToProduct, addToCart
    };
  }
}).mount('#app');
