document.addEventListener('alpine:init', () => {
  Alpine.data('Theme_Model', () => ({
    enabled: false,
    modelViewerUI: null,
    modelId: null,
    firstTime: true,
    _init() {
      this.enabled = true;

      this.$nextTick(() => {
        Shopify.loadFeatures([
          {
            name: 'model-viewer-ui',
            version: '1.0',
            onLoad: (errors) => {
              if (errors) return;

              this.modelViewerUI = new Shopify.ModelViewerUI(
                this.$root.querySelector('model-viewer')
              );
            },
          },
        ]);
      });

      this.productMediaWrapper = this.$root.closest(
        '[data-product-single-media-wrapper]'
      );

      this.modelId = this.productMediaWrapper.dataset.productSingleMediaWrapper;

      if (this.productMediaWrapper) {
        this.setUpProductMediaListeners();
      }
    },
    setUpProductMediaListeners() {
      this.productMediaWrapper.addEventListener('mediaHidden', () => {
        this.pause();
      });

      this.productMediaWrapper.addEventListener('xrLaunch', () => {
        this.pause();
      });

      this.productMediaWrapper.addEventListener('mediaVisible', () => {
        this.setXRButton();
        if (window.isTouch()) return;

        this.play();
      });
    },
    setXRButton() {
      const productRoot = this.productRoot;
      const xrButton = this.productRoot.querySelector('[data-shopify-xr]');

      if (!productRoot || !xrButton) return;

      xrButton.setAttribute('data-shopify-model3d-id', this.modelId);
    },
    pause() {
      if (this.enabled === false || !this.modelViewerUI) return;

      Alpine.raw(this.modelViewerUI).pause();
    },
    play() {
      if (
        this.enabled === false ||
        this.firstTime === true ||
        !this.modelViewerUI
      )
        return;

      Alpine.raw(this.modelViewerUI).play();

      this.firstTime = false;
    },
  }));
});
