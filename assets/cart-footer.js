document.addEventListener('alpine:init', () => {
  Alpine.data('CartFooter', () => {
    return {
      footerRoot: null,
      _morphFooter(e) {
        const newFooterSection = querySelectorInHTMLString(
          '[data-cart-footer]',
          e.detail.response.sections['cart-footer']
        );

        Alpine.morph(
          this.footerRoot,
          newFooterSection ? newFooterSection.outerHTML : '',
          {
            updating(el, toEl, childrenOnly, skip) {
              if (
                el.classList &&
                el.classList.contains('additional-checkout-buttons')
              ) {
                skip();
              }
            },
          }
        );
      },
      init() {
        this.footerRoot = this.$root;

        window.addEventListener('baseline:cart:afteradditem', (e) => {
          this._morphFooter(e);
        });

        window.addEventListener('baseline:cart:cartqtychange', (e) => {
          this._morphFooter(e);
        });

        window.addEventListener('baseline:cart:update', (e) => {
          this._morphFooter(e);
        });
      },
    };
  });
});
