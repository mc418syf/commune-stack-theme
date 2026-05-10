document.addEventListener('alpine:init', () => {
  Alpine.data(
    'Theme_Slideshow',
    ({
      autoplay = false,
      autoplayInterval = null,
      mode = 'slideshow',
      gap = null,
      onlyIfNeeded = false,
    }) => ({
      autoplay,
      autoplayInterval,
      playing: false,
      splide: null,
      rate: 0,
      mode,
      gap,
      onlyIfNeeded,
      maxLgBreakpointMQL: window.matchMedia('(max-width: 1023px)'),
      init() {
        if (typeof Splide === 'undefined') {
          console.error(
            'slideshows.js requires a Splide object to be defined in the global scope'
          );

          return;
        }

        this.initSplide();

        if (this.onlyIfNeeded) {
          this.destroyOrInitIfNeeded();

          this.maxLgBreakpointMQL.addEventListener('change', (e) => {
            this.destroyOrInitIfNeeded();
          });
        }

        if (Shopify.designMode) {
          this._setUpDesignModeHandlers();
        }

        document.addEventListener('dev:hotreloadmutation', async () => {
          if (!Shopify.designMode) {
            this.splide.destroy();

            await this.$nextTick();

            this.initSplide();
          }
        });
      },
      initSplide() {
        const options = {
          arrows: true,
          pagination: true,
          rewind: true,
          speed: 600,
          start: parseInt(this.$root.dataset.start, 10) - 1 || 0,
          interval: this.autoplayInterval,
          autoplay: this.autoplay,
          drag: !this.autoplay,
        };

        if (this.mode === 'carousel') {
          options.autoWidth = true;
        }

        if (this.gap) {
          options.gap = this.gap;
        }

        this.splide = new Splide(this.$root, options);

        if (options.autoplay) {
          this.splide.on('autoplay:play', () => {
            this.playing = true;
          });

          this.splide.on('autoplay:pause', () => {
            this.playing = false;
          });

          this.splide.on('autoplay:playing', (rate) => {
            this.rate = rate;
          });
        }

        this.splide.mount();
      },
      destroyOrInitIfNeeded() {
        const slideEls = Array.from(
          this.$root.querySelectorAll('.splide__slide')
        );

        const totalSlidesWidth = slideEls.reduce(
          (totalWidth, slideEl) =>
            totalWidth + slideEl.getBoundingClientRect().width,
          0
        );

        const totalGridlinesWidth =
          parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue(
              '--gridline-width'
            )
          ) *
          (slideEls.length - 1);

        const totalContentWidth = totalSlidesWidth + totalGridlinesWidth;

        if (totalContentWidth <= this.$root.getBoundingClientRect().width) {
          if (splideIsNotDestroyed(this.splide)) this.splide.destroy();
        } else {
          if (!splideIsNotDestroyed(this.splide)) this.initSplide();
        }
      },
      _setUpDesignModeHandlers() {
        this.$root.addEventListener('slideshow-go', (e) => {
          if (!e.detail) return;

          this.splide.go(parseInt(e.detail, 10));
        });
      },
    })
  );
});
