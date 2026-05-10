window.coreQuantity = {
  adjustQuantity(adjustCb) {
    if (typeof this.previousQuantity !== 'undefined') {
      this.previousQuantity = this.quantity;
    }

    const quantityBeforeAdjustment = this.quantity;

    adjustCb();

    this.dispatchInputEvent();

    if (this.quantity === quantityBeforeAdjustment) return;

    this.$nextTick(() => {
      this.dispatchChangeEvent();
    });
  },
  increment() {
    this.adjustQuantity(() => {
      this.$refs.quantityInput.stepUp();
    });
  },
  decrement() {
    this.adjustQuantity(() => {
      this.$refs.quantityInput.stepDown();
    });
  },
  dispatchInputEvent() {
    this.$refs.quantityInput.dispatchEvent(new Event('input'));
  },
  dispatchChangeEvent() {
    this.$refs.quantityInput.dispatchEvent(new Event('change'));
  },
};

document.addEventListener('alpine:init', () => {
  Alpine.data('Quantity', () => ({
    quantity: null,
    ...coreQuantity,
  }));
});
