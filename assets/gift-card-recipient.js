document.addEventListener('alpine:init', () => {
  Alpine.data('GiftCardRecipient', () => ({
    enabled: false,
    recipientMessage: '',
    get messageLength() {
      return this.recipientMessage.length;
    },
    errorMessage: null,
    errors: null,
    init() {
      document.body.addEventListener('baseline:productform:error', (e) => {
        if (
          e.detail.sourceId === this.$root.closest('form').getAttribute('id')
        ) {
          this.errors = e.detail.errors;
          this.enabled = true;
        }
      });
    },
  }));
});
