document.addEventListener('alpine:init', () => {
  Alpine.data(
    'PromoPopup',
    ({ delay, frequency, enabled, hasErrors, hasSuccessMessage }) => ({
      delay,
      frequency,
      enabled,
      sectionId: null,
      storageKey: null,
      async init() {
        this.sectionId = this.$root.id;
        this.storageKey = `switch-popup-${this.sectionId}`;

        // Prevent popup on Shopify robot challenge page
        if (window.location.pathname === '/challenge') return;

        initTeleport(this.$root);

        Alpine.store('modals').register('promoPopup', 'promo');

        document.body.addEventListener('promo-is-closed', (e) => {
          setExpiringStorageItem(
            this.storageKey,
            'shown',
            daysInMs(this.frequency)
          );
        });

        const popupContent =
          this.$refs.teleported.content.querySelector('template').content;

        const hasErrors = Boolean(popupContent.querySelector('[data-errors]'));
        const hasSuccessMessage = Boolean(
          popupContent.querySelector('[data-success-message]')
        );

        if (hasSuccessMessage || hasErrors) {
          this.open();

          this.clearSuccessParams();

          setExpiringStorageItem(this.storageKey, 'shown', daysInMs(200));
        }

        if (!Shopify.designMode) {
          if (getExpiringStorageItem(this.storageKey) !== 'shown') {
            setTimeout(() => {
              this.open();

              const escapeHandler = (e) => {
                if (e.code !== 'Escape') return;

                this.$store.modals.close('promoPopup');

                document.body.removeEventListener('keydown', escapeHandler);
              };

              document.body.addEventListener('keydown', escapeHandler);
            }, this.delay * 1000);
          }
        } else {
          if (window.theme.designMode.selected === this.sectionId) {
            if (this.enabled === true) {
              this.open();
            } else {
              // It might be open from a previous instantiation
              Alpine.store('modals').close('promoPopup');
            }
          }

          document.addEventListener(
            'shopify:section:select',
            this.onSectionSelect.bind(this)
          );

          document.addEventListener(
            'shopify:section:deselect',
            this.onSectionDeselect.bind(this)
          );
        }
      },
      open() {
        this.$store.modals.open('promoPopup');
        this.$focus.first();
      },
      onSectionSelect(e) {
        if (!e.target.contains(this.$root)) return;

        if (!this.enabled) return;

        this.open();
      },
      onSectionDeselect(e) {
        if (!e.target.contains(this.$root)) return;

        this.$store.modals.close('promoPopup');
      },
      clearSuccessParams() {
        /**
         * After a successful submission, the URL becomes
         * `?customer_posted=true#contact_form`, which will cause
         * the popup to reappear when returning to the URL.
         *
         * This will remove that search param and clear the hash.
         */

        const updatedParams = new URLSearchParams(window.location.search);

        if (updatedParams.has('customer_posted')) {
          updatedParams.delete('customer_posted');
        }

        let newURL;

        if (updatedParams.toString().length > 0) {
          newURL = `${window.location.pathname}?${updatedParams.toString()}`;
        } else {
          newURL = window.location.pathname;
        }

        history.replaceState('', document.title, newURL);
      },
      destroy() {
        document.removeEventListener(
          'shopify:section:select',
          this.onSectionSelect
        );

        document.removeEventListener(
          'shopify:section:deselect',
          this.onSectionDeselect
        );
      },
    })
  );
});
