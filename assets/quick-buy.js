document.addEventListener('alpine:init', () => {
  Alpine.data('QuickBuy', () => ({
    loading: false,
    addedToCart: false,
    errorMessage: '',
    init() {
      this.setUpProductFormEvents();

      const addToCartBtnEl = this.$root.querySelector('.add-to-cart');

      if (addToCartBtnEl && addToCartBtnEl.offsetHeight) {
        document.documentElement.style.setProperty(
          '--add-to-cart-button-height',
          `${addToCartBtnEl.offsetHeight}px`
        );
      }

      const formEl = this.$root.querySelector('form');

      if (!formEl) return;

      if (
        formEl.hasAttribute('data-messages-id') &&
        formEl.dataset.messagesId !== ''
      ) {
        const messagesModalId = formEl.dataset.messagesId;

        this.$watch('errorMessage', (value) => {
          if (Boolean(value)) {
            Alpine.store('modals').open(messagesModalId);
          }
        });

        if (!window.theme.settings.openDrawerOnAddToCart) {
          this.$watch('addedToCart', (value) => {
            if (value) {
              Alpine.store('modals').open(messagesModalId);
            }
          });
        }
      }
    },
    setUpProductFormEvents() {
      this.$root.addEventListener('baseline:productform:loading', (event) => {
        event.stopPropagation();

        this.loading = true;
        this.errorMessage = null;
        this.addedToCart = false;
      });

      this.$root.addEventListener('baseline:productform:success', (event) => {
        event.stopPropagation();

        this.loading = false;
        this.errorMessage = null;
        this.addedToCart = true;

        if (!this.$root.querySelector('[data-show-on-add="true"]')) {
          if (this.$refs.added) this.$nextTick(() => this.$refs.added.focus());
        }
      });

      this.$root.addEventListener('baseline:productform:error', (event) => {
        event.stopPropagation();

        this.errorMessage =
          event.detail.message || window.theme.strings.cartError;

        this.loading = false;
      });
    },
  }));
});
