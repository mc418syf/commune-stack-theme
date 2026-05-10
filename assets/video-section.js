document.addEventListener('alpine:init', () => {
  Alpine.data('VideoSection', () => ({
    player: null,
    enabled: false,
    init() {
      this.$watch('enabled', (value) => {
        if (value === true) {
          this.$nextTick(() => {
            this.player = this.$root.querySelector('[\\@play][\\@pause]');

            if (Shopify.designMode) {
              document.addEventListener('shopify:section:unload', (e) => {
                if (e.target.contains(this.$root) && this.player) {
                  this.player.dispatchEvent(new CustomEvent('deinit'));
                }
              });
            }
          });
        }
      });
    },
    pause() {
      this.player.dispatchEvent(new CustomEvent('pause'));
    },
  }));
});
