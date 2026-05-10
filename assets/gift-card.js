document.addEventListener('alpine:init', () => {
  Alpine.data('GiftCard', () => ({
    copied: false,
    init() {
      new QRCode(this.$refs.qrCode, {
        text: this.$refs.qrCode.dataset.identifier,
        width: 120,
        height: 120,
        imageAltText: theme.strings.qrImageAlt,
      });
    },
    async copy() {
      this.copied = false;

      await navigator.clipboard.writeText(this.$refs.giftCardCode.value);

      this.copied = true;
    },
  }));
});
