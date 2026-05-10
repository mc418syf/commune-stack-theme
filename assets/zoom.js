document.addEventListener('alpine:init', () => {
  Alpine.data('Theme_Zoom', () => {
    return {
      imageProxies: [],
      _isLandscapeMQL: window.matchMedia('(orientation: landscape)'),
      viewportIsLandscape: false,
      willOverflow: false,
      init() {
        this.viewportIsLandscape = this._isLandscapeMQL.matches;

        this.$watch('imageProxies', () => {
          this.$nextTick(() => {
            this.checkOverflow();
          });
        });

        this._isLandscapeMQL.addEventListener('change', (e) => {
          this.viewportIsLandscape = e.matches;
        });

        window.addEventListener(
          'resize',
          debounce(() => {
            this.checkOverflow();
          }, 300)
        );
      },
      scrollZoomAreaTo(index) {
        document.dispatchEvent(new CustomEvent('unzoom'));

        this.$root.querySelector(`[data-index="${index}"]`).scrollIntoView({
          behavior: 'smooth',
        });
      },
      checkOverflow() {
        this.willOverflow =
          this.$refs.proxyContainer.scrollHeight > window.innerHeight;
      },
    };
  });

  Alpine.data('Theme_Zoomable', () => {
    return {
      zoomed: false,
      loaded: false,
      init() {
        this.imageProxies.push({
          ratio: this.$refs.image.clientWidth / this.$refs.image.clientHeight,
          current: false,
        });

        if (this.$refs.image.complete) {
          this.loaded = true;
        } else {
          this.$refs.image.addEventListener('load', (e) => {
            if (this.$refs.image.complete) {
              this.loaded = true;
            }
          });
        }
      },
      handleZoom() {
        this.$nextTick(() => {
          // At this point, image element is not constrained by the frame

          const frameWidth = this.$el.clientWidth,
            frameHeight = this.$el.clientHeight;

          const zoomTarget = {
            x: this.$event.detail.ratioX * this.$refs.image.clientWidth,
            y: this.$event.detail.ratioY * this.$refs.image.clientHeight,
          };

          const frameCenter = {
            x: frameWidth / 2,
            y: frameHeight / 2,
          };

          const pointerDelta = {
            x: frameWidth * this.$event.detail.deltaX,
            y: frameHeight * this.$event.detail.deltaY,
          };

          this.$el.scroll(
            zoomTarget.x - frameCenter.x + pointerDelta.x,
            zoomTarget.y - frameCenter.y + pointerDelta.y
          );
        });
      },
      unZoom() {
        if (this.zoomed) {
          this.zoomed = false;
        }
      },
      handleImageClick() {
        // If already zoomed, zoom out

        if (this.zoomed) {
          this.zoomed = false;
          return;
        }

        // Otherwise, find the x and y deltas

        // At this point, image element is the same size as the frame

        const unzoomedImageWidth = this.$el.clientWidth,
          unzoomedImageHeight = this.$el.clientHeight;

        const unzoomedImageCenter = {
          x: unzoomedImageWidth / 2,
          y: unzoomedImageHeight / 2,
        };

        this.$dispatch('zoom', {
          ratioX: this.$event.offsetX / unzoomedImageWidth,
          ratioY: this.$event.offsetY / unzoomedImageHeight,
          deltaX:
            (unzoomedImageCenter.x - this.$event.offsetX) / unzoomedImageWidth,
          deltaY:
            (unzoomedImageCenter.y - this.$event.offsetY) / unzoomedImageHeight,
        });

        this.zoomed = true;
      },
    };
  });
});
