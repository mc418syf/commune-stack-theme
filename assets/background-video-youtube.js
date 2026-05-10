document.addEventListener('alpine:init', () => {
  Alpine.data('BackgroundVideoYT', () => ({
    enabled: false,
    playing: false,
    ready: false,
    tall: false,
    ytPlayerState: null,
    didBuffer: false,
    player: null,
    showFallbackImage: false,
    init() {
      this.$watch('enabled', (value) => {
        if (value === true) {
          this.player = this.$root.querySelector('[\\@play][\\@pause]');

          this.player.addEventListener('playing', () => {
            this.ytPlayerState = 'playing';
          });

          this.player.addEventListener('paused', () => {
            this.ytPlayerState = 'paused';
          });

          this.player.addEventListener('buffering', () => {
            this.ytPlayerState = 'buffering';
          });

          this.player.addEventListener('unstarted', () => {
            this.ytPlayerState = 'unstarted';
          });

          this.player.addEventListener('ready', () => {
            this.ready = true;
          });

          this.$nextTick(() => {
            this._initResponsiveVideoContainer();
          });
        }
      });

      this.$watch('ytPlayerState', (value) => {
        if (value === 'unstarted') {
          if (this.didBuffer === true) {
            this.showFallbackImage = true;
          }
        }

        if (value === 'buffering') {
          this.didBuffer = true;
        }

        if (value === 'playing') {
          this.playing = true;
        }
      });

      if (Shopify.designMode) {
        document.addEventListener('shopify:section:unload', (e) => {
          if (e.target.contains(this.$root)) {
            this.deinit();
          }
        });
      }
    },
    playerIsReady() {
      return new Promise((resolve) => {
        this.$watch('ready', (value) => {
          if (value === true) {
            resolve();
          }
        });
      });
    },
    async play() {
      if (!this.enabled) {
        this.enabled = true;
        await this.playerIsReady();
      }

      this.player.dispatchEvent(new CustomEvent('play'));
    },
    pause() {
      if (!this.enabled) {
        return;
      }

      this.player.dispatchEvent(new CustomEvent('pause'));
    },
    _checkContainerSize() {
      // Assume 16/9 ratio
      const videoRatio = (16 / 9).toFixed(2);

      const containerAspectRatio = (
        this.$root.clientWidth / this.$root.clientHeight
      ).toFixed(2);

      const iFrameEl = this.player.querySelector('iframe');

      iFrameEl.style.width = '';
      iFrameEl.style.left = '';

      if (containerAspectRatio < videoRatio) {
        this.tall = true;

        const newWidth = ((videoRatio / containerAspectRatio) * 100).toFixed(2);
        const newLeft = (newWidth - 100) / 2;

        iFrameEl.style.width = `${newWidth}%`;
        iFrameEl.style.left = `-${newLeft}%`;
      } else {
        this.tall = false;
      }
    },
    _initResponsiveVideoContainer() {
      this._checkContainerSize();

      this._debouncedCheckContainerSize = debounce(
        this._checkContainerSize.bind(this),
        300
      );

      window.addEventListener('resize', this._debouncedCheckContainerSize);
    },
    deinit() {
      window.removeEventListener('resize', this._debouncedCheckContainerSize);
      this.player.dispatchEvent(new CustomEvent('deinit'));
    },
  }));
});
