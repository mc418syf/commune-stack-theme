document.addEventListener('alpine:init', () => {
  Alpine.data('Theme_Header', () => ({
    isStuck: false,

    init() {
      // Scroll logo swap disabled — isStuck stays false permanently
    },
  }));
});
