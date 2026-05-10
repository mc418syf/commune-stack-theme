document.addEventListener('alpine:init', () => {
  Alpine.data('FreeShippingBar', () => ({
    contentHTML: null,
    init() {
      window.addEventListener(
        'baseline:cart:afteradditem',
        this.onCartUpdate.bind(this)
      );

      window.addEventListener(
        'baseline:cart:cartqtychange',
        this.onCartUpdate.bind(this)
      );

      window.addEventListener(
        'baseline:cart:update',
        this.onCartUpdate.bind(this)
      );
    },
    async onCartUpdate() {
      const updatedSection = await freshHTML(
        getURLWithParams(window.theme.routes.root_url, {
          section_id: this.$root.id,
        })
      );

      this.contentHTML = querySelectorInHTMLString(
        '[data-content]',
        updatedSection
      ).innerHTML;

      const scrollingTextContainerEl = this.$root.querySelector(
        'scrolling-items-container'
      );

      if (scrollingTextContainerEl) {
        await this.$nextTick();

        scrollingTextContainerEl.dispatchEvent(
          new CustomEvent('scrolling-items:change')
        );
      }
    },
  }));
});
