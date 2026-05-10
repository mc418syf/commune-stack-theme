document.addEventListener('alpine:init', () => {
  Alpine.data('RTE', () => {
    return {
      init() {
        this.$root.querySelectorAll('table').forEach((tableEl) => {
          const wrapper = wrap(tableEl);

          wrapper.classList.add('rte__table');
        });

        const iframeSelector = `iframe[src*="youtube.com"],iframe[src="vimeo"]`;

        this.$root.querySelectorAll(iframeSelector).forEach((extVideoEl) => {
          const wrapper = wrap(extVideoEl);

          wrapper.classList.add('rte__external-video');
        });
      },
    };
  });
});
