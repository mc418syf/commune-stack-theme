document.addEventListener('alpine:init', () => {
  Alpine.data('CartItems', () => ({
    itemsRoot: null,
    loading: null,
    init() {
      this.itemsRoot = this.$root;

      window.addEventListener(
        'baseline:cart:afteradditem',
        this.onCartQuantityChange.bind(this)
      );

      window.addEventListener(
        'baseline:cart:cartqtychange',
        this.onCartQuantityChange.bind(this)
      );

      window.addEventListener(
        'baseline:cart:update',
        this.onCartQuantityChange.bind(this)
      );

      document.addEventListener('baseline:cart:lock', () => {
        this.loading = true;
      });

      document.addEventListener('baseline:cart:unlock', () => {
        this.loading = false;
      });
    },
    onCartQuantityChange(e) {
      Alpine.morph(
        this.itemsRoot,
        querySelectorInHTMLString(
          '[data-cart-items]',
          e.detail.response.sections['cart-items']
        ).outerHTML
      );

      this.$nextTick(() => {
        this.itemsRoot.querySelectorAll('input').forEach((inputEl) => {
          /**
           * Sometimes the quantity property can drift from
           * the line item input’s value due to manipulations from
           * discounts, etc.
           *
           * This treats the input’s value (from the fetch response)
           * as the source of truth and reconciles the quantity property.
           *
           */

          inputEl.value = inputEl.getAttribute('value');
          inputEl.dispatchEvent(new Event('input'));
        });
      });

      this.updateLiveRegion(
        parseDOMFromString(e.detail.response.sections['cart-live-region'])
          .firstElementChild.textContent
      );

      if (e.detail.originalTarget) {
        this.$nextTick(() => {
          if (!this.itemsRoot.contains(e.detail.originalTarget)) {
            let focusRoot;

            if (this.itemsRoot.closest('[role="dialog"]')) {
              focusRoot = this.itemsRoot.closest('[role="dialog"]').parentNode;
            } else {
              focusRoot = this.itemsRoot;
            }

            this.$focus.within(focusRoot).first();
          }
        });
      }

      const itemsRootEl = this.itemsRoot;

      switch (e.type) {
        case 'baseline:cart:afteradditem':
          document.dispatchEvent(
            new CustomEvent('theme:product:add', {
              detail: {
                cartItemCount: window.theme.cartItemCount,
                itemsRootEl,
                lineItemEl:
                  document.querySelector(
                    `[data-line-item-key="${e.detail.response.key}"]`
                  ) || null,
                variantId: e.detail.response.variant_id,
                key: e.detail.response.key,
                formEl: document.getElementById(e.detail.sourceId),
                get cartPromise() {
                  return fetch(
                    window.theme.routes.cart_url,
                    fetchConfigDefaults()
                  )
                    .then((res) => res.json())
                    .then((cart) => cart)
                    .catch((error) =>
                      console.error(
                        'Error fetching cart in `theme:product:add`',
                        error
                      )
                    );
                },
              },
            })
          );
          break;
        case 'baseline:cart:cartqtychange':
          document.dispatchEvent(
            new CustomEvent('theme:line-item:change', {
              detail: {
                cartItemCount: e.detail.response.item_count,
                itemsRootEl,
                lineItemEl:
                  document.querySelector(
                    `[data-line-item-key="${e.detail.key}"]`
                  ) || null,
                variantId: e.detail.variantId,
                key: e.detail.key,
                quantity: e.detail.quantity,
                previousQuantity: e.detail.previousQuantity,
                cart: e.detail.response,
              },
            })
          );
          break;
        case 'baseline:cart:update':
          document.dispatchEvent(
            new CustomEvent('theme:cart:update', {
              detail: {
                cartItemCount: window.theme.cartItemCount,
                itemsRootEl,
                get cartPromise() {
                  return fetch(
                    window.theme.routes.cart_url,
                    fetchConfigDefaults()
                  )
                    .then((res) => res.json())
                    .then((cart) => cart)
                    .catch((error) =>
                      console.error(
                        'Error fetching cart in `theme:cart:update`',
                        error
                      )
                    );
                },
              },
            })
          );
          break;
      }
    },
    updateLiveRegion(liveRegionText) {
      if (!liveRegionText) return;

      const cartStatus = document.getElementById('cart-live-region-text');

      cartStatus.textContent = liveRegionText;

      cartStatus.setAttribute('aria-hidden', false);

      setTimeout(() => {
        cartStatus.setAttribute('aria-hidden', true);
      }, 1000);
    },
  }));

  Alpine.data('CartItem', (key) => ({
    quantity: null,
    previousQuantity: null,
    key,
    locked: false,
    errorMessage: null,
    init() {
      document.addEventListener('baseline:cart:lock', () => {
        this.locked = true;
      });

      document.addEventListener('baseline:cart:unlock', () => {
        this.locked = false;
      });
    },
    async itemQuantityChange() {
      if (this.locked || this.loading) return;

      if (this.$refs.quantityInput.hasAttribute('data-last-value')) {
        if (
          this.quantity === Number(this.$refs.quantityInput.dataset.lastValue)
        ) {
          return;
        }
      }

      this.locked = true;
      this.loading = true;

      const request = {
        ...fetchConfigDefaults('application/javascript'),
        body: JSON.stringify({
          id: this.key,
          quantity: this.quantity,
          sections: 'cart-items,cart-footer,cart-item-count,cart-live-region',
          sections_url: window.location.pathname,
        }),
      };

      try {
        const response = await fetch(theme.routes.cart_change_url, request);
        const data = await response.json();

        if (data.status === 422) {
          this.errorMessage = data.message;
          this.quantity = this.previousQuantity;

          document.dispatchEvent(
            new CustomEvent('theme:line-item:error', {
              detail: {
                message: this.errorMessage,
                itemsRootEl: this.itemsRoot,
                lineItemEl:
                  document.querySelector(
                    `[data-line-item-key="${this.key}"]`
                  ) || null,
                variantId: Number(this.$refs.quantityInput.dataset.variantId),
                key: this.key,
                quantity: this.quantity,
              },
            })
          );
        } else {
          this.errorMessage = null;

          document.body.dispatchEvent(
            new CustomEvent('baseline:cart:cartqtychange', {
              bubbles: true,
              detail: {
                response: data,
                key: this.key,
                quantity: this.quantity,
                previousQuantity: this.previousQuantity,
                variantId: Number(this.$refs.quantityInput.dataset.variantId),
                originalTarget: this.$refs.quantityControl,
              },
            })
          );
        }
      } catch (e) {
        console.error(e);
        document.getElementById('cart-errors').textContent =
          theme.strings.cartError;
        document.dispatchEvent(
          new CustomEvent('theme:cart:error:other', {
            detail: {
              message: theme.strings.cartError,
              error: e,
            },
          })
        );
      } finally {
        this.locked = false;
        this.loading = false;
      }
    },
    removeItem() {
      const visibleQtyControl = Array.from(
        this.$root.querySelectorAll('[x-data="CartItemQuantity"]')
      ).filter((el) => el.offsetParent)[0];

      visibleQtyControl.dispatchEvent(new CustomEvent('remove'));
    },
  }));

  Alpine.data('CartItemQuantity', () => ({
    init() {
      this.$root.addEventListener('remove', () => {
        this.remove();
      });
    },
    remove() {
      this.adjustQuantity(() => {
        this.$refs.quantityInput.value = 0;
      });
    },
    ...coreQuantity,
  }));
});
