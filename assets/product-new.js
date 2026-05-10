// should stay static at load until the property it depends on changes
// once that property has changed it should load a given url

function getMyMessage() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve('(async) the variant id is');
    }, 2500);
  });
}

document.addEventListener('alpine:init', () => {
  Alpine.data('ProductNew', (initialVariantId) => ({
    currentVariantId: initialVariantId,
    variantMediaHTML: null,
    variantInfoHTML: null,
    loading: false,
    init() {
      this.$watch('currentVariantId', this.onVariantIdChange.bind(this));
    },
    async onVariantIdChange(value) {
      if (value === initialVariantId) {
        this.variantMediaHTML = null;
        this.variantInfoHTML = null;

        return;
      }

      this.loading = true;

      const updatedHTML = await fetchHTML(
        currentURLWithParams({
          variant: value,
          section_id: getSectionId(this.$root),
        })
      );

      this.variantMediaHTML = querySelectorInHTMLString(
        `[data-fragment-id="info"]`,
        updatedHTML
      ).innerHTML;

      this.variantMediaHTML = querySelectorInHTMLString(
        `[data-fragment-id="media"]`,
        updatedHTML
      ).innerHTML;

      this.loading = false;
    },
  }));
});
