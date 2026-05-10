/**
 * Commune237 Stack System
 * Registers an Alpine.js store ($store.stack) that persists to localStorage.
 * Used by the stack drawer, product tiles, PDP, and the /pages/stack appointment page.
 */

const STORAGE_KEY = 'commune_stack';

document.addEventListener('alpine:init', () => {
  Alpine.store('stack', {
    items: [],

    init() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) this.items = JSON.parse(saved);
      } catch (e) {}
    },

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
      } catch (e) {}
    },

    get count() {
      return this.items.length;
    },

    has(variantId) {
      return this.items.some(i => i.variantId === variantId);
    },

    add(product) {
      // product = { id, variantId, title, vendor, price, image, url, size }
      if (this.has(product.variantId)) return false;
      this.items.push({ ...product, note: '' });
      this.save();
      return true;
    },

    remove(variantId) {
      this.items = this.items.filter(i => i.variantId !== variantId);
      this.save();
    },

    updateNote(variantId, note) {
      const item = this.items.find(i => i.variantId === variantId);
      if (item) { item.note = note; this.save(); }
    },

    clear() {
      this.items = [];
      this.save();
    }
  });
});
