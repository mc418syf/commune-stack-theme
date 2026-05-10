document.addEventListener('alpine:init', () => {
  Alpine.data('Theme_Header', () => ({
    isStuck: false,
    overlayHeaderWithSticky: null,
    overlayTextColor: null,
    init() {
      this.overlayHeaderWithSticky =
        this.$root.dataset.overlayHeaderWithSticky === 'true';

      if (this.overlayHeaderWithSticky) {
        this.setUpOverlayWithSticky();
      }
    },
    setUpOverlayWithSticky() {
      const positionerEl = document.createElement('div');
      positionerEl.id = 'sticky-positioner';

      document.body.insertBefore(
        positionerEl,
        this.$root.closest('.shopify-section')
      );

      const observer = new IntersectionObserver(([e]) => {
        e.intersectionRatio === 0
          ? (this.isStuck = true)
          : (this.isStuck = false);
      });

      observer.observe(positionerEl);

      this.overlayTextColor = this.$root.dataset.overlayTextColorScheme;

      this.updateColorScheme(this.isStuck);

      this.$watch('isStuck', (value) => {
        this.updateColorScheme(value);
      });
    },
    updateColorScheme(isStuck) {
      if (isStuck) {
        this.$refs.header.setAttribute('data-color-scheme', '');
        this.$refs.header.classList.remove('bg-transparent');
        this.$refs.header.classList.add('bg-scheme-background');
      } else {
        this.$refs.header.setAttribute(
          'data-color-scheme',
          this.overlayTextColor
        );
        this.$refs.header.classList.remove('bg-scheme-background');
        this.$refs.header.classList.add('bg-transparent');
      }
    },
  }));
});
