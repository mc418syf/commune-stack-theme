/**
 * Commune Try In-Store
 * Alpine.js store ($store.tryOnList) with localStorage persistence.
 * Triggered by: window.dispatchEvent(new CustomEvent('open-try-on'))
 */

const TRY_ON_STORAGE_KEY = 'commune_try_on_list';

function tryOnMoney(cents) {
  if (typeof window.formatMoney === 'function') return window.formatMoney(cents);
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function tryOnSelectedVariant(btn) {
  const productRoot = btn.closest('[data-product-root]');
  const selectedInput = productRoot?.querySelector('form [name="id"]');
  const selectedId = Number(selectedInput?.value || btn.dataset.variantId);
  const variants = JSON.parse(btn.dataset.variants || '[]');
  return variants.find((v) => Number(v.id) === selectedId) || {
    id: selectedId,
    title: btn.dataset.variantTitle || '',
    price: btn.dataset.priceCents,
    featured_image: null,
    featured_media: null,
  };
}

function tryOnRefreshButton(btn) {
  const store = window.Alpine && window.Alpine.store('tryOnList');
  if (!store) return;
  const variant = tryOnSelectedVariant(btn);
  const label = btn.querySelector('[data-try-on-label]');
  if (!label) return;
  const inList = store.has(Number(variant.id));
  label.textContent = inList
    ? (btn.dataset.labelAdded || 'Added to Try-On')
    : (btn.dataset.label || 'Try In-Store');
  btn.disabled = inList;
}

// Called by the PDP button onclick
function tryOnPDP(btn) {
  const store = window.Alpine && window.Alpine.store('tryOnList');
  if (!store) return;

  const variant = tryOnSelectedVariant(btn);
  const variantId = Number(variant.id);

  if (store.has(variantId)) {
    window.dispatchEvent(new CustomEvent('open-try-on'));
    return;
  }

  const image =
    variant.featured_image?.src ||
    variant.featured_media?.preview_image?.src ||
    btn.dataset.image ||
    '';

  const variantTitle =
    variant.title && !variant.title.toLowerCase().includes('default title')
      ? variant.title
      : '';

  store.add({
    variantId,
    productId:    Number(btn.dataset.productId),
    title:        btn.dataset.title,
    variantTitle,
    vendor:       btn.dataset.vendor,
    price:        tryOnMoney(variant.price || btn.dataset.priceCents),
    image,
    url:          `${btn.dataset.url}?variant=${variantId}`,
  });

  tryOnRefreshButton(btn);
  window.dispatchEvent(new CustomEvent('open-try-on'));
}

// Refresh button state when variant selection changes
document.addEventListener('theme:variant:change', (e) => {
  const root = e.detail && e.detail.productRootEl;
  const btn = root && root.querySelector('[data-try-on-pdp]');
  if (btn) tryOnRefreshButton(btn);
});

document.addEventListener('alpine:init', () => {
  Alpine.store('tryOnList', {
    items: [],

    init() {
      try {
        const saved = localStorage.getItem(TRY_ON_STORAGE_KEY);
        if (saved) this.items = JSON.parse(saved);
      } catch (_) {}

      requestAnimationFrame(() => {
        document.querySelectorAll('[data-try-on-pdp]').forEach(tryOnRefreshButton);
      });
    },

    save() {
      try {
        localStorage.setItem(TRY_ON_STORAGE_KEY, JSON.stringify(this.items));
      } catch (_) {}
    },

    get count() {
      return this.items.length;
    },

    has(variantId) {
      return this.items.some((i) => i.variantId === variantId);
    },

    add(item) {
      if (this.has(item.variantId)) return false;
      this.items.push(item);
      this.save();
      return true;
    },

    remove(variantId) {
      this.items = this.items.filter((i) => i.variantId !== variantId);
      this.save();
    },

    clear() {
      this.items = [];
      this.save();
    },
  });
});
