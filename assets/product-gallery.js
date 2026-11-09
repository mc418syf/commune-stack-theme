/**
 * Product page, mobile gallery counter: "01/05" on the image instead of the progress bar.
 * product.js dispatches a 'move' event on the .splide--product element with detail.newIndex.
 */
(function () {
  const pad = (n) => String(n).padStart(2, '0');

  function init() {
    document.querySelectorAll('.splide--product').forEach((splide) => {
      const box = splide.querySelector('[data-pdp-count]');
      if (!box) return;
      const cur = box.querySelector('[data-cur]');
      const tot = box.querySelector('[data-tot]');
      const total = () => splide.querySelectorAll('.splide__slide:not(.splide__slide--clone)').length;
      tot.textContent = pad(total());
      splide.addEventListener('move', (e) => {
        tot.textContent = pad(total());
        cur.textContent = pad(((e.detail && e.detail.newIndex) || 0) + 1);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
