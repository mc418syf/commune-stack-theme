document.addEventListener('alpine:init', () => {
  Alpine.store('cartCount', {
    count: (window.theme && window.theme.cartItemCount) || 0,
    init() {
      window.addEventListener('baseline:cart:afteradditem', (e) => {
        this._setFromFetchedSection(e.detail.response);
      });

      window.addEventListener('baseline:cart:cartqtychange', (e) => {
        this._setFromFetchedSection(e.detail.response);
      });

      window.addEventListener('baseline:cart:update', (e) => {
        this._setFromFetchedSection(e.detail.response);
      });
    },
    _setFromFetchedSection(data) {
      const countSectionHTML = data.sections['cart-item-count'];

      this.count = parseInt(
        parseDOMFromString(countSectionHTML).firstElementChild.innerText.trim(),
        10
      );

      window.theme.cartItemCount = this.count;
    },
    countWithText() {
      let string = theme.strings.itemCountOther;

      if (this.count === 1) {
        string = theme.strings.itemCountOne;
      }

      return string.replace('{{ count }}', this.count);
    },
  });
});
