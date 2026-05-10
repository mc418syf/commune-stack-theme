document.addEventListener('alpine:init', () => {
  Alpine.data('Video', (mode = 'preview') => ({
    player: null,
    enabled: false,
    playing: false,
    id: '',
    playback: 'inline',
    mode: mode,
    init() {
      this.id = this.$root.id;
      //this.$store.modals.modal.open = true;
      document.body.addEventListener('pauseAllMedia', (e) => {
        if (e.detail !== null && e.detail.id === this.$root.id) {
          return;
        }

        //if autoplay, return
        if (this.mode === 'autoplay') return;
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

      if (this.productMediaWrapper !== null) {
        this.setUpProductMediaListeners();
      }

      if (Shopify.designMode) {
        document.addEventListener('shopify:section:unload', (e) => {
          if (e.target.contains(this.$root) && this.player) {
            this.player.dispatchEvent(new CustomEvent('deinit'));
          }
        });
      }

      if (this.mode === 'autoplay') {
        this.enable();
      }
      this.$nextTick(() => {
        this.checkImagesLoaded();
      });
    },
    checkImagesLoaded() {
      const images = this.$root.querySelectorAll('img.track-loaded');
      images.forEach((image) => {
        if (image.complete) {
          image.classList.add('is-complete');
        } else {
          image.addEventListener('load', () => {
            image.classList.add('is-complete');
          });
        }
      });
    },
    enable() {
      if (this.playback === 'modal') {
        if (!this.$store.modals.modals[this.id]) {
          this.$store.modals.register(this.id, 'modal');
        }
        this.dispatchPauseAllMediaEvent();
        this.$store.modals.open(this.id);
      } else {
        this.enabled = true;
      }
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
    setUpProductMediaListeners() {
      this.productMediaWrapper.addEventListener('mediaHidden', () => {
        this.pause();
      });
      this.productMediaWrapper.addEventListener('mediaVisible', () => {
        /*
        this.setXRButton();
        // if (window.isTouch()) return;
        this.play();
        */
      });
    },
  }));
});
