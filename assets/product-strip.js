(() => {
  'use strict';

  const DESKTOP = matchMedia('(min-width: 1024px)');
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');

  // How quickly the strip eases toward where it is heading (per frame), and how far a flick carries it
  const EASE = 0.12;
  const FLICK = 240;
  const MAX_VELOCITY = 3; // scroll pixels per millisecond

  function mount(list) {
    let target = list.scrollLeft;
    let frame = 0;
    let down = false;
    let moved = false;
    let startX = 0;
    let startLeft = 0;
    let lastX = 0;
    let lastT = 0;
    let velocity = 0; // scroll pixels per millisecond

    const max = () => Math.max(0, list.scrollWidth - list.clientWidth);
    const clamp = (v) => Math.min(max(), Math.max(0, v));

    function tick() {
      const diff = target - list.scrollLeft;
      if (Math.abs(diff) < 0.5) {
        list.scrollLeft = target;
        frame = 0;
        return;
      }
      list.scrollLeft += REDUCED.matches ? diff : diff * EASE;
      frame = requestAnimationFrame(tick);
    }
    const glideTo = (value) => {
      target = clamp(value);
      if (!frame) frame = requestAnimationFrame(tick);
    };

    // Scrolling that did not come from us (trackpad, keyboard, scrollbar): follow it
    list.addEventListener('scroll', () => {
      if (!frame && !down) target = list.scrollLeft;
    }, { passive: true });

    // Mouse wheel (vertical) glides the strip sideways. A trackpad's own sideways swipe stays native.
    list.addEventListener('wheel', (e) => {
      if (!DESKTOP.matches || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const base = frame ? target : list.scrollLeft;
      const atStart = base <= 0 && delta < 0;
      const atEnd = base >= max() - 1 && delta > 0;
      if (atStart || atEnd) return; // let the page scroll once the strip runs out
      e.preventDefault();
      glideTo(base + delta);
    }, { passive: false });

    // Drag with the mouse: follows the pointer directly, then carries on after a flick
    list.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || !DESKTOP.matches) return;
      down = true; moved = false;
      startX = lastX = e.clientX;
      startLeft = list.scrollLeft;
      lastT = e.timeStamp;
      velocity = 0;
      cancelAnimationFrame(frame); frame = 0;
    });

    addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) < 5) return;
      if (!moved) { moved = true; list.classList.add('is-dragging'); }
      list.scrollLeft = startLeft - dx;
      const dt = Math.max(1, e.timeStamp - lastT);
      velocity = velocity * 0.7 + (-(e.clientX - lastX) / dt) * 0.3;
      lastX = e.clientX; lastT = e.timeStamp;
    });

    const end = (e) => {
      if (!down) return;
      down = false;
      list.classList.remove('is-dragging');
      // Held still before letting go: no flick
      if (e.timeStamp - lastT > 90) velocity = 0;
      velocity = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, velocity));
      if (moved && Math.abs(velocity) > 0.05 && !REDUCED.matches) glideTo(list.scrollLeft + velocity * FLICK);
      else target = list.scrollLeft;
    };
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);

    // Arrow keys work wherever the focus is (for example after clicking the description), not only after clicking an image
    document.addEventListener('keydown', (e) => {
      if (!DESKTOP.matches || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const t = e.target;
      if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [data-edge-panel]')) return;
      if (!list.isConnected || list.getClientRects().length === 0) return;
      const step = Math.max(240, list.clientWidth * 0.6) * (e.key === 'ArrowLeft' ? -1 : 1);
      const base = frame ? target : list.scrollLeft;
      if ((step < 0 && base <= 0) || (step > 0 && base >= max() - 1)) return;
      e.preventDefault();
      glideTo(base + step);
    });

    // A drag must not open the zoom on the image underneath
    list.addEventListener('click', (e) => {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }, true);
  }

  const mountAll = (scope) => scope.querySelectorAll('.product-strip .splide__list').forEach((el) => {
    if (!el.dataset.stripReady) { el.dataset.stripReady = '1'; mount(el); }
  });

  mountAll(document);
  document.addEventListener('shopify:section:load', (e) => mountAll(e.target));
})();
