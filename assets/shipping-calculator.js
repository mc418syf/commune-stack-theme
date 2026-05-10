document.addEventListener('alpine:init', () => {
  Alpine.data('ShippingCalculator', () => ({
    country: null,
    selectedCountryOptionEl: null,
    loading: false,
    errorMessages: null,
    searchParams: null,
    shippingRates: [],
    get shippingRatesResultsTitle() {
      if (this.shippingRates) {
        if (this.shippingRates.length === 1) {
          return window.theme.strings.shippingCalculatorResultsTitleOne;
        } else {
          return window.theme.strings.shippingCalculatorResultsTitleMany.replace(
            '{{ count }}',
            this.shippingRates.length
          );
        }
      }

      return '';
    },
    get provinces() {
      return this.selectedCountryOptionEl &&
        this.selectedCountryOptionEl.hasAttribute('data-provinces')
        ? JSON.parse(this.selectedCountryOptionEl.dataset.provinces)
        : [];
    },
    init() {
      if (this.$refs.countrySelect) {
        this.selectedCountryOptionEl =
          this.$refs.countrySelect.selectedOptions[0];
      }

      this.$watch('country', (value) => {
        this.selectedCountryOptionEl = Array.from(
          this.$refs.countrySelect.options
        ).filter((option) => option.value === value)[0];
      });

      this.$watch('shippingRates', (value, oldValue) => {
        if (value.length === 0) return;

        if (value.length !== oldValue.length) {
          this.$nextTick(() => {
            this.$refs.results.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
          });
        }
      });
    },
    async onSubmit() {
      this.loading = true;
      this.errorMessages = null;

      this.searchParams = new URLSearchParams(new FormData(this.$refs.form));

      this.prepareRates();
    },
    async prepareRates() {
      const prepareURL = getURLAddingParams(
        `${window.theme.routes.cart_url}/prepare_shipping_rates.json`,
        this.searchParams
      );

      const prepareResponse = await fetch(prepareURL, { method: 'POST' });

      if (prepareResponse.ok) {
        this.getRates();
      } else {
        this.errorMessages = await prepareResponse.json();
        this.loading = false;

        this.shippingRates = null;
      }
    },
    async getRates() {
      const getURL = getURLAddingParams(
        `${window.theme.routes.cart_url}/async_shipping_rates.json`,
        this.searchParams
      );

      try {
        const ratesResponse = await fetch(getURL);
        const ratesData = await ratesResponse.json();

        if (ratesData === null) {
          this.getRates();
        }

        if (ratesData.shipping_rates) {
          this.shippingRates = ratesData.shipping_rates;
          this.loading = false;
        }
      } catch (e) {
        console.error(e);
        this.loading = false;
      }
    },
    hasErrorFor(key) {
      return Boolean(
        this.errorMessages && this.errorMessages.hasOwnProperty(key)
      );
    },
  }));
});
