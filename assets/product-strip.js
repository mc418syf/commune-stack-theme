(() => {
  'use strict';

  const DESKTOP = matchMedia('(min-width: 1024px)');

  function mount(list) {
    let startX = 0, startLeft = 0, down = false, moved = false;

    list.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || !DESKTOP.matches) return;
      down = true; moved = false;
      startX = e.clientX; startLeft = list.scrollLeft;
    });

    addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) < 5) return;
      if (!moved) { moved = true; list.classList.add('is-dragging'); }
      list.scrollLeft = startLeft - dx;
    });

    const end = () => {
      if (!down) return;
      down = false;
      list.classList.remove('is-dragging');
    };
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);

    // A drag must not open the zoom on the image underneath
    list.addEventListener('click', (e) => {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }, true);

    // Vertical wheel movement over the strip scrolls it sideways, so a plain mouse wheel works
    list.addEventListener('wheel', (e) => {
      if (!DESKTOP.matches || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const atStart = list.scrollLeft <= 0 && e.deltaY < 0;
      const atEnd = Math.ceil(list.scrollLeft + list.clientWidth) >= list.scrollWidth && e.deltaY > 0;
      if (atStart || atEnd) return; // let the page scroll once the strip runs out
      e.preventDefault();
      list.scrollLeft += e.deltaY;
    }, { passive: false });
  }

  const mountAll = (scope) => scope.querySelectorAll('.product-strip .splide__list').forEach((el) => {
    if (!el.dataset.stripReady) { el.dataset.stripReady = '1'; mount(el); }
  });

  mountAll(document);
  document.addEventListener('shopify:section:load', (e) => mountAll(e.target));
})();
