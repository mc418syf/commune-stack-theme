document.addEventListener('alpine:init', () => {
  Alpine.data('Theme_ProductMediaVideo', () => ({
    player: null,
    productMediaWrapper: null,
    enabled: false,
    playing: false,
    init() {
      document.body.addEventListener('pauseAllMedia', (e) => {
        if (e.detail !== null && e.detail.id === this.$root.id) {
          return;
        }

        this.pause();
      });

      this.$watch('enabled', (value) => {
        if (value === true) {
          this.player = this.$root.querySelector('[\\@play][\\@pause]');

          this.player.addEventListener('playing', () => {
            this.playing = true;
          });

          this.player.addEventListener('paused', () => {
            this.playing = false;
          });
        }
      });

      this.$watch('playing', (value) => {
        if (value === true) {
          this.dispatchPauseAllMediaEvent();
        }
      });

      this.productMediaWrapper = this.$root.closest(
        '[data-product-single-media-wrapper]'
      );

      if (this.productMediaWrapper) {
        this.setUpProductMediaListeners();
      }

      if (Shopify.designMode) {
        document.addEventListener('shopify:section:unload', (e) => {
          if (e.target.contains(this.$root) && this.player) {
            this.player.dispatchEvent(new CustomEvent('deinit'));
          }
        });
      }
    },
    setUpProductMediaListeners() {
      this.productMediaWrapper.addEventListener('mediaHidden', () => {
        this.pause();
      });

      this.productMediaWrapper.addEventListener('mediaVisible', () => {
        this.play();
      });
    },
    enable() {
      this.enabled = true;
    },
    dispatchPauseAllMediaEvent() {
      document.body.dispatchEvent(
        new CustomEvent('pauseAllMedia', {
          detail: {
            id: this.$root.id,
          },
        })
      );
    },
    play() {
      if (this.enabled === false || this.player === null) return;

      this.player.dispatchEvent(new CustomEvent('play'));
    },
    pause() {
      if (this.enabled === false || this.player === null) return;

      this.player.dispatchEvent(new CustomEvent('pause'));
    },
  }));
});
