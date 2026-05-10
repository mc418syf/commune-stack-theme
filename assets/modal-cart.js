document.addEventListener('alpine:init', () => {
  Alpine.data('Theme_ModalCart', ({ openOnAddToCart }) => {
    return {
      init() {
        if (openOnAddToCart === true) {
          document.body.addEventListener('baseline:cart:afteradditem', () => {
            Alpine.store('modals').closeAll();

            Alpine.store('modals').open('cart');
          });
        }

        Alpine.store('modals').register('cart', 'rightDrawer');
      },
    };
  });
});
