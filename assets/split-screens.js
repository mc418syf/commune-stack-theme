(() => {
  'use strict';

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
  const MOBILE = matchMedia('(max-width: 749px)');
  const designMode = !!(window.Shopify && window.Shopify.designMode);

  function mount(root) {
    const html = document.documentElement;
    const snapMode = designMode ? 'off' : root.dataset.snap;
    const wrapper = root.closest('.shopify-section') || root;
    const neighbours = [wrapper.previousElementSibling, wrapper.nextElementSibling].filter(Boolean);
    let inView = false;

    // Videos only play while visible
    const videos = [...root.querySelectorAll('video')];
    const watcher = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !REDUCED.matches) e.target.play().catch(() => {});
        else e.target.pause();
      }
    }, { threshold: 0.25 });
    videos.forEach((v) => watcher.observe(v));

    // Snapping needs a snap point on either side too, or the page could not be scrolled out of the section
    const applySnap = () => {
      const on = inView && (snapMode === 'all' || (snapMode === 'mobile' && MOBILE.matches));
      html.classList.toggle('split-snap', on);
      neighbours.forEach((el) => el.classList.toggle('split-snap-point', snapMode !== 'off'));
    };

    // A short haptic tick when a new asset snaps into view (mobile, full screen layout)
    const haptics = !designMode && root.dataset.haptics === 'true' && root.dataset.mobileLayout === 'full' && 'vibrate' in navigator;
    let hapticObserver;
    let current = null;
    let armed = false;
    if (haptics) {
      const arm = () => { armed = true; };
      addEventListener('touchstart', arm, { passive: true, once: true });
      hapticObserver = new IntersectionObserver((entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || e.target === current) continue;
          const first = current === null;
          current = e.target;
          if (!first && armed && MOBILE.matches && !REDUCED.matches) {
            try { navigator.vibrate(12); } catch (err) { /* blocked until the visitor has tapped the page */ }
          }
        }
      }, { threshold: 0.6 });
      root.querySelectorAll('.split__panel:not(.split__panel--empty)').forEach((p) => hapticObserver.observe(p));
    }

    const sectionWatcher = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      applySnap();
    });
    sectionWatcher.observe(root);
    MOBILE.addEventListener('change', applySnap);

    return () => {
      watcher.disconnect();
      sectionWatcher.disconnect();
      if (hapticObserver) hapticObserver.disconnect();
      MOBILE.removeEventListener('change', applySnap);
      html.classList.remove('split-snap');
      neighbours.forEach((el) => el.classList.remove('split-snap-point'));
    };
  }

  const mounted = new WeakMap();
  const mountAll = (scope) => scope.querySelectorAll('[data-split-screens]').forEach((el) => {
    if (!mounted.has(el)) mounted.set(el, mount(el));
  });
  const unmountAll = (scope) => scope.querySelectorAll('[data-split-screens]').forEach((el) => {
    const stop = mounted.get(el);
    if (stop) { stop(); mounted.delete(el); }
  });

  mountAll(document);
  document.addEventListener('shopify:section:load', (e) => mountAll(e.target));
  document.addEventListener('shopify:section:unload', (e) => unmountAll(e.target));
})();
