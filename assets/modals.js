document.addEventListener('alpine:init', () => {
  Alpine.store('modals', {
    domContentLoaded: false,
    leftDrawer: { open: false, contents: '' },
    rightDrawer: { open: false, contents: '' },
    quickBuyDrawer: { open: false, contents: '' },
    modal: { open: false, contents: '' },
    promo: { open: false, contents: '' },
    popup: { open: false, contents: '' },
    modals: {},
    async register(name, slotName) {
      this.modals[name] = slotName;

      if (!this.domContentLoaded) {
        await new Promise((resolve) => {
          document.addEventListener('DOMContentLoaded', () => {
            this.domContentLoaded = true;
            resolve();
          });
        });
      }

      this.setUpHide(slotName);
    },
    open(name) {
      if (this.modals[name]) {
        const slotName = this.modals[name];

        if (this[slotName].contents === name && this[slotName].open === true)
          return;

        document.body.dispatchEvent(
          new CustomEvent(`${kebabCase(name)}-will-open`, { bubbles: true })
        );

        document.body.dispatchEvent(
          new CustomEvent(`${kebabCase(slotName)}-will-open`, { bubbles: true })
        );

        this[slotName].contents = name;
        this[slotName].open = true;

        document.body.dispatchEvent(
          new CustomEvent(`${kebabCase(name)}-is-open`, { bubbles: true })
        );

        document.body.dispatchEvent(
          new CustomEvent(`${kebabCase(slotName)}-is-open`, {
            bubbles: true,
          })
        );
      }
    },
    close(nameOrSlotName) {
      let name, slotName;

      if (this.modals[nameOrSlotName]) {
        name = nameOrSlotName;
        slotName = this.modals[nameOrSlotName];
      } else {
        name = this[nameOrSlotName].contents;
        slotName = nameOrSlotName;
      }

      if (this[slotName].contents !== name || this[slotName].open !== true)
        return;

      document.body.dispatchEvent(
        new CustomEvent(`${kebabCase(name)}-will-close`, {
          bubbles: true,
        })
      );

      document.body.dispatchEvent(
        new CustomEvent(`${kebabCase(slotName)}-will-close`, { bubbles: true })
      );

      this[slotName].open = false;
    },
    setUpHide(slotName) {
      const slotEl = document.getElementById(`${kebabCase(slotName)}-slot`);

      slotEl._x_doHide = () => {
        Alpine.mutateDom(() => {
          slotEl.style.setProperty('display', 'none');
        });

        const name = Alpine.store('modals')[slotName].contents;

        Alpine.store('modals')[slotName].contents = '';

        document.body.dispatchEvent(
          new CustomEvent(`${kebabCase(name)}-is-closed`, {
            bubbles: true,
          })
        );

        document.body.dispatchEvent(
          new CustomEvent(`${kebabCase(slotName)}-is-closed`, {
            bubbles: true,
          })
        );
      };
    },
    closeAll() {
      Object.keys(this.modals).forEach((modal) => {
        Alpine.store('modals').close(modal);
      });
    },
  });
});
