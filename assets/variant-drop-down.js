document.addEventListener('alpine:init', () => {
  Alpine.data('VariantDropDown', () => ({
    expanded: false,
    toggle() {
      if (this.expanded) {
        this.close();
        return;
      }

      this.$refs.button.focus();

      this.expanded = true;

      /**
       * We’re setting the `display` style directly instead of
       * using `x-show` because `x-show` can cause arbitrary
       * delays that are long enough to impact focus behaviour.
       *
       */
      this.$refs.panel.style.display = '';

      const selectedEl = this.$refs.panel.querySelector('[aria-selected]');

      if (selectedEl) {
        this.$focus.focus(selectedEl);
      } else {
        this.$focus.within($refs.panel).first();
      }
    },
    close(focusAfter) {
      if (!this.expanded) return;

      this.expanded = false;

      this.$refs.panel.style.display = 'none';

      if (focusAfter) {
        this.$focus.focus(focusAfter);
      }
    },
  }));
});
