function SplideProductExtension(Splide, Components, options) {
  const { on, off, bind, unbind } = SplideEventInterface(Splide);

  function __resizeTrackForSlideAtIndex(index) {
    const slides = Splide.Components.Slides;
    const targetSlideObject = slides.getAt(index);

    if (!targetSlideObject) return;

    const targetSlide = targetSlideObject.slide;
    const targetSlideMedia = targetSlide.querySelector(
      '[data-product-single-media-wrapper]'
    );

    const targetSlideMediaHeight =
      targetSlideMedia.getBoundingClientRect().height;

    const gridlineWidth =
      parseInt(
        getComputedStyle(document.documentElement).getPropertyValue(
          '--gridline-width'
        ),
        10
      ) || 0;

    Splide.root.querySelector('.splide__track').style.maxHeight = `${
      targetSlideMediaHeight + gridlineWidth
    }px`;

    const thumbnailsSplideVerticalEl = Splide.root.parentNode.querySelector(
      '.splide.splide--thumbnails.splide--thumbnails--vertical'
    );

    if (thumbnailsSplideVerticalEl && isLgBreakpoint()) {
      const navHeight =
        Splide.root
          .querySelector('[data-slideshow-navigation]')
          .getBoundingClientRect().height || 0;

      const productContentHeight =
        Splide.root
          .closest('[data-product-media-container]')
          .parentNode.querySelector('[data-product-content]')
          .getBoundingClientRect().height || 0;

      thumbnailsSplideVerticalEl.style.setProperty(
        '--thumbnails-height',
        `${Math.max(
          targetSlideMediaHeight + navHeight,
          productContentHeight
        )}px`
      );
    }
  }

  function __dispatchMediaEvents(newIndex, oldIndex) {
    const slides = Splide.Components.Slides;
    const oldSlide = slides
      .getAt(oldIndex)
      .slide.querySelector('[data-product-single-media-wrapper]');

    const newSlide = slides
      .getAt(newIndex)
      .slide.querySelector('[data-product-single-media-wrapper]');

    if (oldSlide) oldSlide.dispatchEvent(new CustomEvent('mediaHidden'));
    if (newSlide) newSlide.dispatchEvent(new CustomEvent('mediaVisible'));
  }

  function onMounted() {
    __resizeTrackForSlideAtIndex(Splide.index);
  }

  function onResize() {
    __resizeTrackForSlideAtIndex(Splide.index);
  }

  function onSlidesUpdated() {
    __resizeTrackForSlideAtIndex(Splide.index);
  }

  function onWindowResize() {
    __resizeTrackForSlideAtIndex(Splide.index);
  }

  const debouncedWindowResize = debounce(onWindowResize, 150);

  function onMove(newIndex, oldIndex) {
    __resizeTrackForSlideAtIndex(newIndex);
    __dispatchMediaEvents(newIndex, oldIndex);

    Splide.root.dispatchEvent(
      new CustomEvent('move', {
        detail: {
          newIndex,
          oldIndex,
        },
      })
    );
  }

  function onDestroy() {
    unbind(window, 'resize');
  }

  function mount() {
    on('mounted', onMounted);
    on('resize', onResize);
    on('move', onMove);
    on('destroy', onDestroy);
    bind(window, 'resize', debouncedWindowResize);
    on('slides:updated', onSlidesUpdated);

    if (Shopify.designMode) {
      document.addEventListener('shopify:section:unload', (e) => {
        if (
          e.target.contains(Splide.root) &&
          !Splide.state.is(window.Splide.STATES.DESTROYED)
        ) {
          unbind(window, 'resize', debouncedWindowResize);
        }
      });
    }
  }

  return {
    mount,
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.data(
    'Theme_Product',
    ({
      product,
      initialVariant,
      optionsWithValues,
      featuredMediaId,
      splideOnDesktop = false,
      mediaScrollTo,
      singleVariantMode,
      alwaysShowProductFeaturedMediaFirst = false,
      firstMediaFullWidth = false,
      shouldUpdateHistoryState = false,
      swapMediaOnDesktop = false,
      templateSuffix = null,
    }) => ({
      productForm: null,
      productRoot: null,
      product,
      featuredMediaId,
      currentMediaId: featuredMediaId,
      splideOnDesktop,
      mediaScrollTo,
      singleVariantMode,
      alwaysShowProductFeaturedMediaFirst,
      firstMediaFullWidth,
      optionsWithValues,
      allOptionPositions: Array.from(
        { length: product.options.length },
        (value, index) => index + 1
      ),
      option1: null,
      option2: null,
      option3: null,
      _soldOutOrUnavailableVariants: null,
      quantity: 1,
      loading: false,
      locked: false,
      optionChangesThisKeypress: 0,
      shouldUpdateHistoryState,
      swapMediaOnDesktop,
      hasGiftCardRecipientForm: false,
      firstMediaView: true,
      addedToCart: false,
      errorMessage: '',
      isMaxLgBreakpoint: window.isMaxLgBreakpoint(),
      maxLgBreakpointMQL: window.maxLgBreakpointMQL(),
      productMediaContainerResizeObserver: null,
      splide: null,
      thumbnailsSplideHorizontal: null,
      thumbnailsSplideVertical: null,
      mainSplideOptions: null,
      thumbnailsSplideHorizontal: null,
      thumbnailsSplideVertical: null,
      thumbnailActiveStatePaused: false,
      splideIndex: 0,
      slideCount: 0,
      allSlides: [],
      allHorizontalThumbnailsSlides: [],
      allVerticalThumbnailsSlides: [],
      splidesInFlux: false,
      splideIsReady: false,
      mediaListIsReordered: false,
      templateSuffix,
      get productMediaContainerEl() {
        return this.$root.querySelector('[data-product-media-container]');
      },
      get splideEl() {
        return this.$root.querySelector('.splide:not(.splide--thumbnails)');
      },
      get thumbnailsSplideHorizontalEl() {
        return this.$root.querySelector(
          '.splide.splide--thumbnails:not(.splide--thumbnails--vertical)'
        );
      },
      get thumbnailsSplideVerticalEl() {
        return this.$root.querySelector(
          '.splide.splide--thumbnails.splide--thumbnails--vertical'
        );
      },
      get currentVariant() {
        return this.variantFromOptions();
      },
      set currentVariant(variant) {
        this.option1 = variant.option1;
        this.option2 = variant.option2;
        this.option3 = variant.option3;
      },
      get currentVariantId() {
        if (this.currentVariant) {
          return this.currentVariant.id;
        } else {
          return null;
        }
      },
      get currentVariantAvailable() {
        if (this.currentVariant) {
          return this.currentVariant.available;
        } else {
          return null;
        }
      },
      get currentVariantTitle() {
        if (this.currentVariant && this.currentVariant.title) {
          if (!this.currentVariant.title.includes('Default')) {
            return this.currentVariant.title;
          }
        }
        return '';
      },
      get currentPrice() {
        if (this.currentVariant) {
          return this.currentVariant.price;
        } else {
          return 0;
        }
      },
      variantFromOptions(
        option1 = this.option1,
        option2 = this.option2,
        option3 = this.option3
      ) {
        return (
          this.product.variants.find(
            (variant) =>
              variant.option1 === option1 &&
              variant.option2 === option2 &&
              variant.option3 === option3
          ) || null
        );
      },
      getVariantById(id) {
        return (
          this.product.variants.find((variant) => variant.id === id) || null
        );
      },
      clearSingleOptionSelectorDecoration(...classNames) {
        this.productRoot
          .querySelectorAll('[data-single-option-selector]')
          .forEach((optionEl) => {
            optionEl.classList.remove(...classNames);

            if (
              optionEl.tagName === 'BUTTON' &&
              classNames.includes('unavailable') &&
              optionEl.classList.contains('[&.unavailable]:hidden')
            ) {
              optionEl.disabled = false;
            }
          });
      },
      updateSingleOptionSelectorDecoration(
        atPosition,
        withValue,
        ...classNames
      ) {
        this.productRoot
          .querySelectorAll(
            `[data-single-option-selector][data-position="${atPosition}"]`
          )
          .forEach((optionEl) => {
            if (optionEl.value !== withValue) {
              return;
            }

            optionEl.classList.add(...classNames);

            if (
              optionEl.tagName === 'BUTTON' &&
              classNames.includes('unavailable') &&
              optionEl.classList.contains('[&.unavailable]:hidden')
            ) {
              optionEl.disabled = true;
            }
          });
      },
      updateOptionsAvailabilities() {
        this.clearSingleOptionSelectorDecoration('sold-out', 'unavailable');

        /**
         * Compare current options against sold out and
         * unavailable variants where (options.length - 1)
         * options match and decorate the diff option
         */

        const currentSelection = {
          option1: this.option1,
          option2: this.option2,
          option3: this.option3,
        };

        const optionsToDecorate = [];

        for (const variant of this.soldOutOrUnavailableVariants) {
          const { equal, diffKeys } = shallowDiffKeys(
            currentSelection,
            variant,
            ['option1', 'option2', 'option3']
          );

          if (equal === false && diffKeys.length === 1) {
            const diffKey = diffKeys[0];
            const diffKeyPosition = diffKeys[0].split('option')[1];

            optionsToDecorate.push({
              position: diffKeyPosition,
              value: variant[diffKey],
              className: variant.title ? 'sold-out' : 'unavailable',
            });
          } else if (equal === true) {
            for (const position of this.allOptionPositions) {
              optionsToDecorate.push({
                position,
                value: this[`option${position}`],
                className: variant.title ? 'sold-out' : 'unavailable',
              });
            }
          }
        }

        for (const option of optionsToDecorate) {
          this.updateSingleOptionSelectorDecoration(
            option.position,
            option.value,
            option.className
          );
        }
      },
      get soldOutOrUnavailableVariants() {
        if (this._soldOutOrUnavailableVariants)
          return this._soldOutOrUnavailableVariants;

        const allOptionsWithValues = [];

        for (const option of optionsWithValues) {
          allOptionsWithValues.push(option.values);
        }

        const allPossibilities = cartesian(...allOptionsWithValues).map((p) => [
          p[0] ? p[0] : null,
          p[1] ? p[1] : null,
          p[2] ? p[2] : null,
        ]);

        const optionsOfExistingVariants = this.product.variants.map(
          (variant) => [
            variant.option1 ? variant.option1 : null,
            variant.option2 ? variant.option2 : null,
            variant.option3 ? variant.option3 : null,
          ]
        );

        const unavailableVariants = allPossibilities
          .filter(
            (p) =>
              !optionsOfExistingVariants.some(
                (v) => p[0] === v[0] && p[1] === v[1] && p[2] === v[2]
              )
          )
          .map((v) => ({
            option1: v[0] ? v[0] : null,
            option2: v[1] ? v[1] : null,
            option3: v[2] ? v[2] : null,
          }));

        const soldOutVariants = this.product.variants
          .filter((variant) => variant.available === false)
          .map((variant) => ({
            title: variant.title,
            option1: variant.option1,
            option2: variant.option2,
            option3: variant.option3,
          }));

        this._soldOutOrUnavailableVariants =
          soldOutVariants.concat(unavailableVariants);

        return this._soldOutOrUnavailableVariants;
      },
      get isUsingSlideshowToDisplayMedia() {
        if (!this.splide) return false;

        return splideIsNotDestroyed(this.splide);
      },
      init() {
        this.isMaxLgBreakpoint = this.maxLgBreakpointMQL.matches;

        this.maxLgBreakpointMQL.addEventListener('change', (e) => {
          this.isMaxLgBreakpoint = e.matches;
        });

        if (this.singleVariantMode) {
          if (this.templateSuffix !== 'horizontal-gallery') {
            this.$watch('isMaxLgBreakpoint', (value) => {
              this.splidesInFlux = true;

              if (
                (this.templateSuffix === '' && value === true) ||
                this.templateSuffix === 'thumbnails'
              ) {
                setTimeout(() => {
                  this.updateSlidesForMediaGroupWithId(this.currentMediaId);

                  if (splideIsIdle(this.splide)) {
                    // reset splide if breakpoint destroy / init failed
                    this.splide.on('destroy.postBreakpointChange', () => {
                      setTimeout(() => {
                        this.initSplide();
                        this.splidesInFlux = false;
                      });

                      this.splide.off('destroy.postBreakpointChange');
                    });

                    this.splide.destroy();
                  } else {
                    setTimeout(() => {
                      this.splidesInFlux = false;
                    });
                  }
                });
              } else if (this.templateSuffix === '' && value === false) {
                setTimeout(() => {
                  this.resetSlides();

                  setTimeout(() => {
                    this.splidesInFlux = false;
                  });
                });
              }
            });
          } else {
            this.$watch('isMaxLgBreakpoint', (value) => {
              this.triggerWindowResizeForSplide();
            });
          }
        }

        if (Shopify.designMode) {
          /**
           * Handle re-init due to Theme Editor settings change
           */
          this.triggerWindowResizeForSplide();
        }

        /**
         * Handle product media container resize due to changes inside product
         * content like accordions, truncated description, payment button lazy
         * init, etc.
         */

        if (this.productMediaContainerEl) {
          this.productMediaContainerResizeObserver = new ResizeObserver(
            debounce((entries) => {
              const entry = entries[0];

              this.triggerWindowResizeForSplide();
            }, 150)
          );

          this.productMediaContainerResizeObserver.observe(
            this.productMediaContainerEl
          );
        }

        // Set a product root for nested components
        // to use instead of $root (which refers to their root)
        this.productRoot = this.$root;

        if (this.$root.querySelector('[x-data="GiftCardRecipient"]')) {
          this.hasGiftCardRecipientForm = true;
        }

        this.$watch('currentVariant', (value, oldValue) => {
          if (!value) return;

          if (
            !(this.alwaysShowProductFeaturedMediaFirst && this.firstMediaView)
          ) {
            if (value.featured_media) {
              this.currentMediaId = value.featured_media.id;
            } else {
              this.currentMediaId = this.featuredMediaId;
            }
          }

          if (this.shouldUpdateHistoryState) {
            const url = getUrlWithVariant(window.location.href, value.id);
            window.history.replaceState({ path: url }, '', url);
          }

          if (this.firstMediaView) {
            this.firstMediaView = false;
          }

          document.dispatchEvent(
            new CustomEvent('theme:variant:change', {
              detail: {
                productRootEl: this.productRoot,
                formEl: this.productRoot.querySelector(
                  'form.shopify-product-form'
                ),
                variant: value,
                previousVariant: oldValue,
                product: this.product,
              },
            })
          );
        });

        this.productRoot.addEventListener('theme:change:variant', (event) => {
          if (!event.detail || !event.detail.variantId) {
            console.error('theme:change:variant requires a variant ID');
            return;
          }

          const variant = this.getVariantById(event.detail.variantId);

          if (!variant) {
            console.error('theme:change:variant: variant not found');
          }

          this.currentVariant = variant;

          this.$nextTick();

          for (const position of [1, 2, 3]) {
            this.productRoot
              .querySelectorAll(
                `[data-single-option-selector][data-position="${position}"]`
              )
              .forEach((optionEl) => {
                optionEl.checked = optionEl.value === this[`option${position}`];
              });
          }
        });

        this.$watch('currentMediaId', async (value, oldValue) => {
          // There can be more than one media (e.g. for different breakpoints)
          // so we check the offsetHeight to see if the wrapper could currently
          // be visible

          // https://davidwalsh.name/offsetheight-visibility

          if (
            this.singleVariantMode &&
            ((this.templateSuffix === '' && this.isMaxLgBreakpoint) ||
              this.templateSuffix === 'thumbnails')
          ) {
            this.thumbnailActiveStatePaused = true;

            this.updateSlidesForMediaGroupWithId(value);

            setTimeout(() => {
              this.thumbnailActiveStatePaused = false;
            }, 100);
          } else {
            this.$root
              .querySelectorAll(
                `[data-product-single-media-wrapper][data-media-id="${oldValue}"]`
              )
              .forEach((mediaWrapperEl) => {
                if (!!mediaWrapperEl.offsetHeight) {
                  if (!this.isUsingSlideshowToDisplayMedia) {
                    mediaWrapperEl.dispatchEvent(
                      new CustomEvent('mediaHidden')
                    );
                  }
                }
              });

            this.$root
              .querySelectorAll(
                `[data-product-single-media-wrapper][data-media-id="${value}"]`
              )
              .forEach((mediaWrapperEl) => {
                if (!!mediaWrapperEl.offsetHeight) {
                  if (this.mediaScrollTo) {
                    if (this.isUsingSlideshowToDisplayMedia) {
                      this.goToSlide(mediaWrapperEl);
                    } else {
                      mediaWrapperEl.dispatchEvent(
                        new CustomEvent('mediaVisible')
                      );
                    }
                  } else {
                    this.updateMedia(mediaWrapperEl.closest('li'));
                  }
                }
              });
          }
        });

        this.currentVariant = initialVariant;

        if (
          this.product.options.length >= 1 &&
          this.product.options.length <= 3
        ) {
          this.updateOptionsAvailabilities();

          this.$watch('option1', (value) => {
            this.updateOptionsAvailabilities();
          });

          this.$watch('option2', (value) => {
            this.updateOptionsAvailabilities();
          });

          this.$watch('option3', (value) => {
            this.updateOptionsAvailabilities();
          });
        }

        this.setUpProductFormEvents();

        const addToCartBtnEl = this.$root.querySelector('.add-to-cart');

        if (addToCartBtnEl && addToCartBtnEl.offsetHeight) {
          document.documentElement.style.setProperty(
            '--add-to-cart-button-height',
            `${addToCartBtnEl.offsetHeight}px`
          );
        }

        this.allSlides = this.splideEl.querySelectorAll(
          '.splide__slide:not(.product-thumbnail)'
        );

        if (this.thumbnailsSplideHorizontalEl) {
          this.allHorizontalThumbnailsSlides =
            this.thumbnailsSplideHorizontalEl.querySelectorAll(
              '.splide__slide'
            );
        }

        if (this.thumbnailsSplideVerticalEl) {
          this.allVerticalThumbnailsSlides =
            this.thumbnailsSplideVerticalEl.querySelectorAll('.splide__slide');
        }

        this.__setUpSlideshow();

        if (this.singleVariantMode) {
          if (
            (this.templateSuffix === '' && this.isMaxLgBreakpoint) ||
            this.templateSuffix === 'thumbnails'
          ) {
            this.updateSlidesForMediaGroupWithId(this.currentMediaId);
          }
        }

        this.$watch('slideCount', (value) => {
          const dragDisableDefault = !(this.mainSplideOptions.drag === true);

          this.splide.Components.Drag.disable(
            value <= 1 ? true : dragDisableDefault
          );
        });
      },
      __handleOptionChange(el) {
        const position = parseInt(el.dataset.position, 10);
        const value = el.value.trim();

        this[`option${position}`] = value;
      },
      lockOptionChangeHandler() {
        this.optionChangesThisKeypress++;

        if (this.optionChangesThisKeypress === 2) {
          this.locked = true;
        }
      },
      unlockOptionChangeHandler(el) {
        this.optionChangesThisKeypress = 0;

        if (this.locked === false) return;

        this.__handleOptionChange(el);
        this.locked = false;
      },
      optionChange(el) {
        if (this.locked) return;

        this.__handleOptionChange(el);
      },
      setUpProductFormEvents() {
        this.$root.addEventListener('baseline:productform:loading', (event) => {
          event.stopPropagation();

          this.loading = true;
          this.errorMessage = null;
          this.addedToCart = false;
        });

        this.$root.addEventListener('baseline:productform:success', (event) => {
          event.stopPropagation();

          this.loading = false;
          this.errorMessage = null;
          this.addedToCart = true;

          if (!this.$root.querySelector('[data-show-on-add="true"]')) {
            if (this.$refs.added)
              this.$nextTick(() => this.$refs.added.focus());
          }
        });

        // Gift card recipient form errors are handled in gift-card-recipient.js
        if (!this.hasGiftCardRecipientForm) {
          this.$root.addEventListener('baseline:productform:error', (event) => {
            event.stopPropagation();

            this.errorMessage =
              event.detail.message || window.theme.strings.cartError;

            this.quantity = Number(
              this.$root.querySelector('[name="quantity"]').getAttribute('min')
            );

            this.loading = false;
          });
        }
      },
      openZoom(mediaId) {
        const zoomModalId = `image-zoom-${this.productRoot.id}`;

        if (!this.$store.modals.modals[zoomModalId]) {
          this.$store.modals.register(zoomModalId, 'modal');
        }

        this.$watch('$store.modals.modal.contents', (value) => {
          if (value === zoomModalId) {
            this.$nextTick(() => {
              const zoomModalEl = document.getElementById(zoomModalId);

              waitForContent(zoomModalEl).then(() => {
                const mediaEl = zoomModalEl.querySelector(
                  `[data-media-id="${mediaId}"]`
                );

                if (mediaEl) {
                  mediaEl.scrollIntoView();
                }
              });
            });
          }
        });

        this.$store.modals.open(zoomModalId);
      },
      __setUpSlideshow() {
        if (
          !this.splideEl ||
          !this.splideEl.dataset.slideshowEnabled === true
        ) {
          return;
        }

        if (typeof Splide === 'undefined') {
          console.error(
            'product.js requires a Splide object to be defined in the global scope'
          );

          return;
        }

        this.initSplide();

        document.addEventListener('dev:hotreloadmutation', async () => {
          if (!Shopify.designMode) {
            if (!this.singleVariantMode) {
              this.reinitMainSplide();
            } else {
              if (
                (this.templateSuffix === '' && this.isMaxLgBreakpoint) ||
                this.templateSuffix === 'thumbnails'
              ) {
                this.updateSlidesForMediaGroupWithId(this.currentMediaId);
              } else {
                this.reinitMainSplide();
              }
            }
          }
        });
      },
      initSplide() {
        if (this.templateSuffix !== 'horizontal-gallery') {
          this.mainSplideOptions = {
            arrows: Boolean(this.splideEl.querySelector('.splide__arrows')),
            pagination: Boolean(
              this.splideEl.querySelector('.splide__pagination')
            ),
            rewind: true,
            speed: 600,
            drag: !(this.splideEl.dataset.dragDisabled === 'true'),
            mediaQuery: 'min',
            breakpoints: {},
          };

          if (!this.splideOnDesktop) {
            this.mainSplideOptions.breakpoints['1024'] = {
              destroy: true,
            };
          }
        } else {
          this.mainSplideOptions = {
            type: 'slide',
            rewind: true,
            perPage: 1,
            autoWidth: false,
            mediaQuery: 'min',
            breakpoints: {
              1024: {
                fixedWidth: 'auto',
                // fixedWidth: 514,
                rewind: true,
                type: 'slide',
                pagination: true,
                arrows: true,
                drag: !(this.splideEl.dataset.dragDisabled === 'true'),
                classes: {
                  // Add classes for pagination.
                  // pagination:
                  //   'splide__pagination splide__pagination--product flex justify-start items-center mt-4 ml-1 w-auto lg:ml-4', // container
                },
              },
            },
          };
        }

        this.splide = new Splide(this.splideEl, this.mainSplideOptions);

        if (this.thumbnailsSplideHorizontalEl) {
          const mobileOnly =
            this.thumbnailsSplideHorizontalEl.hasAttribute('data-mobile-only');

          const desktopOnly =
            this.thumbnailsSplideHorizontalEl.hasAttribute('data-desktop-only');

          const thumbnailsSplideHorizontalOptions = {
            arrows: false,
            pagination: false,
            rewind: true,
            isNavigation: true,
            // perPage: 5,
            autoWidth: true,
            gap: 'var(--gridline-width)',
          };

          if (mobileOnly) {
            thumbnailsSplideHorizontalOptions.mediaQuery = 'min';

            thumbnailsSplideHorizontalOptions.breakpoints = {
              1024: {
                destroy: true,
              },
            };

            this.$watch('isMaxLgBreakpoint', (value) => {
              if (value === true) {
                this.resetSyncedSplide(this.thumbnailsSplideHorizontal);
              }
            });
          } else if (desktopOnly) {
            thumbnailsSplideHorizontalOptions.breakpoints = {
              1023: {
                destroy: true,
              },
            };

            this.$watch('isMaxLgBreakpoint', (value) => {
              if (value === false) {
                this.resetSyncedSplide(this.thumbnailsSplideHorizontal);
              }
            });
          }

          this.thumbnailsSplideHorizontal = new Splide(
            this.thumbnailsSplideHorizontalEl,
            thumbnailsSplideHorizontalOptions
          );

          this.splide.sync(this.thumbnailsSplideHorizontal);
        }

        if (this.thumbnailsSplideVerticalEl) {
          this.thumbnailsSplideVertical = new Splide(
            this.thumbnailsSplideVerticalEl,
            {
              arrows: false,
              pagination: false,
              rewind: true,
              isNavigation: true,
              direction: 'ttb',
              height: 'var(--thumbnails-height)',
              autoHeight: true,
              breakpoints: {
                1023: { destroy: true },
              },
            }
          );

          this.$watch('isMaxLgBreakpoint', async (value) => {
            if (value === false) {
              this.resetSyncedSplide(this.thumbnailsSplideVertical);
            }
          });

          this.splide.sync(this.thumbnailsSplideVertical);
        }

        this.splide.on('ready', () => {
          this.slideCount = this.splide.Components.Slides.get().length;
          this.splideIsReady = true;
        });

        this.splide.mount({ SplideProductExtension });

        if (this.thumbnailsSplideHorizontal) {
          this.thumbnailsSplideHorizontal.mount();
        }

        if (this.thumbnailsSplideVertical) {
          this.thumbnailsSplideVertical.mount();
        }

        this.splideEl.addEventListener('move', (e) => {
          this.splideIndex = e.detail.newIndex;
        });

        this.splide.on('refresh', () => {
          this.slideCount = this.splide.Components.Slides.get().length;
        });

        this.splide.on('destroy', () => {
          this.splideIsReady = false;
        });
      },
      goToSlide(el) {
        const index = parseInt(el.closest('.splide__slide').dataset.index, 10);

        this.splide.go(index);
      },
      updateMedia(el) {
        if (this.isUsingSlideshowToDisplayMedia) {
          if (!(isLgBreakpoint() && this.swapMediaOnDesktop)) {
            this.goToSlide(el);
          } else {
            this.swapMedia(el);
          }
        } else {
          if (!this.singleVariantMode) {
            this.swapMedia(el);
          }
        }
      },
      swapMedia(el) {
        const incomingEl = el;

        if (this.mediaListIsReordered) {
          this.resetMediaListOrder();
        }

        let restOfIncomingMediaGroup;

        const outgoingEl = this.$refs.mediaList.firstElementChild;

        if (incomingEl.hasAttribute('data-media-group-id')) {
          restOfIncomingMediaGroup = Array.from(
            this.$refs.mediaList.querySelectorAll(
              `[data-media-group-id="${incomingEl.getAttribute(
                'data-media-group-id'
              )}"]`
            )
          )
            .filter((elInGroup) => elInGroup != incomingEl)
            .reverse();
        }

        this.$refs.mediaList.insertBefore(outgoingEl, incomingEl);

        let restOfOutgoingMediaGroup;

        if (outgoingEl.hasAttribute('data-media-group-id')) {
          restOfOutgoingMediaGroup = Array.from(
            this.$refs.mediaList.querySelectorAll(
              `[data-media-group-id="${outgoingEl.getAttribute(
                'data-media-group-id'
              )}"]`
            )
          )
            .filter((elInGroup) => elInGroup != outgoingEl)
            .reverse();
        }

        if (restOfOutgoingMediaGroup && restOfOutgoingMediaGroup.length) {
          let lastInsertedEl = outgoingEl;

          restOfOutgoingMediaGroup.forEach((elInGroup) => {
            this.$refs.mediaList.insertBefore(
              elInGroup,
              lastInsertedEl.nextElementSibling
            );
          });
        }

        this.$refs.mediaList.insertBefore(
          incomingEl,
          this.$refs.mediaList.firstElementChild
        );

        if (restOfIncomingMediaGroup && restOfIncomingMediaGroup.length) {
          let lastInsertedEl = incomingEl;

          restOfIncomingMediaGroup.forEach((elInGroup) => {
            this.$refs.mediaList.insertBefore(
              elInGroup,
              lastInsertedEl.nextElementSibling
            );
          });
        }

        if (this.isUsingSlideshowToDisplayMedia) {
          this.splide.go(0);
        }

        this.mediaListIsReordered = true;
      },
      resetMediaListOrder() {
        const mediaListItemsArray = Array.from(this.$refs.mediaList.children);

        mediaListItemsArray.sort(function (a, b) {
          a = parseInt(a.getAttribute('data-order'), 10);
          b = parseInt(b.getAttribute('data-order'), 10);

          return a > b ? 1 : -1;
        });

        mediaListItemsArray.forEach((mediaListItemEl) => {
          this.$refs.mediaList.appendChild(mediaListItemEl);
        });
      },
      shouldBeFullWidth() {
        if (this.isMaxLgBreakpoint || !this.$el.parentNode) return false;

        const mediaGroupEls = Array.from(
          this.$el.parentNode.querySelectorAll(
            `[data-media-group-id="${this.currentMediaId}"`
          )
        );

        const leftOver = mediaGroupEls.length % 2;

        const index = mediaGroupEls.indexOf(this.$el);

        // First media
        if (index === 0) {
          if (leftOver > 0 || this.firstMediaFullWidth) {
            return true;
          }
        }

        // Last media
        if (index === mediaGroupEls.length - 1) {
          if (this.firstMediaFullWidth && leftOver === 0) {
            return true;
          } else if (this.firstMediaFullWidth && mediaGroupEls.length == 2) {
            return true;
          }
        }

        return false;
      },
      async triggerWindowResizeForSplide() {
        /**
         * Splide’s breakpoint change happens before $nextTick
         * so the slides can still be hidden, either due to `x-cloak`
         * or `x-show` in single variant mode, when it inits.
         *
         * We trigger a resize event on window after $nextTick so
         * the breakpoint change can trigger again once the slides
         * are visible.
         *
         */

        await this.$nextTick();

        window.dispatchEvent(new Event('resize'));
      },
      async resetSyncedSplide(syncedSplide) {
        /**
         * If a splide synced to the main splide is initialized
         * in a breakpoint where it is destroyed, it will
         * remain idle when switching to a breakpoint where it
         * would normally be active, unlike splides that aren’t
         * synced. This resets it, which should only need to
         * happen once.
         *
         */

        if (!splideIsIdle(syncedSplide)) return;

        syncedSplide.destroy();

        await this.$nextTick();

        this.splide.sync(syncedSplide);
        syncedSplide.mount();
      },
      async reinitMainSplide() {
        this.splide.destroy();

        await this.$nextTick();

        this.initSplide();
      },
      updateSlidesForMediaGroupWithId(id) {
        if (this.slideCount < this.allSlides.length) {
          this.splide.Components.Slides.remove(
            '.splide__slide:not(.product-thumbnail)'
          );

          for (const slide of this.allSlides) {
            this.splide.Components.Slides.add(slide);
          }

          if (this.thumbnailsSplideHorizontal) {
            this.thumbnailsSplideHorizontal.Components.Slides.remove(
              '.splide__slide'
            );

            for (const slide of this.allHorizontalThumbnailsSlides) {
              this.thumbnailsSplideHorizontal.Components.Slides.add(slide);
            }
          }

          if (this.thumbnailsSplideVertical) {
            this.thumbnailsSplideVertical.Components.Slides.remove(
              '.splide__slide'
            );

            for (const slide of this.allVerticalThumbnailsSlides) {
              this.thumbnailsSplideVertical.Components.Slides.add(slide);
            }

            const lastGridlineEl =
              this.thumbnailsSplideVerticalEl.querySelector(
                'li[role="presentation"]'
              );

            this.thumbnailsSplideVerticalEl
              .querySelector('.splide__list')
              .append(lastGridlineEl);
          }
        }

        this.splide.Components.Slides.remove(
          `.splide__slide:not([data-media-group-id="${id}"]):not(.product-thumbnail)`
        );

        this.splide.emit('slides:updated');

        if (this.thumbnailsSplideHorizontal) {
          this.thumbnailsSplideHorizontal.Components.Slides.remove(
            `.splide__slide:not([data-media-group-id="${id}"])`
          );
        }

        if (this.thumbnailsSplideVertical) {
          this.thumbnailsSplideVertical.Components.Slides.remove(
            `.splide__slide:not([data-media-group-id="${id}"])`
          );
        }
      },
      resetSlides() {
        if (this.slideCount < this.allSlides.length) {
          this.splide.Components.Slides.remove(
            '.splide__slide:not(.product-thumbnail)'
          );

          for (const slide of this.allSlides) {
            this.splide.Components.Slides.add(slide);
          }
        }
      },
    })
  );
});
