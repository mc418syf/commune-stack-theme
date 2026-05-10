document.addEventListener('alpine:init', () => {
  Alpine.data('ProductForm', () => ({
    formEl: null,
    init() {
      this.formEl = this.$root.querySelector('form');

      this.formEl.addEventListener('submit', this.submit.bind(this));
    },
    async submit(event) {
      event.preventDefault();

      this.$root.dispatchEvent(
        new CustomEvent('baseline:productform:loading', {
          bubbles: true,
        })
      );

      event.preventDefault();

      liveRegion(window.theme.strings.loading);

      const formData = new FormData(event.target);
      const formId = event.target.getAttribute('id');

      const options = fetchConfigDefaults('application/javascript');

      formData.append('sections', 'cart-items,cart-footer,cart-item-count');
      formData.append('sections_url', window.location.pathname);

      options.body = formData;
      options.headers['X-Requested-With'] = 'XMLHttpRequest';
      delete options.headers['Content-Type'];

      let response, data;

      response = await fetch(`${theme.routes.cart_add_url}`, options);
      data = await response.json();

      if (data.status) {
        let errors = data.errors || data.description;
        let message = data.description || data.message;

        const errorDetail = {
          sourceId: formId,
          variantId: Number(formData.get('id')),
          errors,
          message,
        };

        this.$root.dispatchEvent(
          new CustomEvent('baseline:productform:error', {
            detail: errorDetail,
            bubbles: true,
          })
        );

        const formEl = this.formEl;
        const productRootEl = formEl.closest('[data-product-root]') || null;

        document.dispatchEvent(
          new CustomEvent('theme:product:error:add-to-cart', {
            detail: {
              productRootEl,
              formEl,
              ...errorDetail,
            },
          })
        );
      } else {
        this.$root.dispatchEvent(
          new CustomEvent('baseline:productform:success', {
            bubbles: true,
          })
        );

        document.body.dispatchEvent(
          new CustomEvent('baseline:cart:afteradditem', {
            bubbles: true,
            detail: {
              response: data,
              sourceId: formId,
            },
          })
        );
      }
    },
  }));
});
