/**
 * PLP gallery view: a snap-scrolling feed, one product per screen. Scrolling (wheel, trackpad or swipe), the arrow keys or a
 * thumbnail moves to another product. The grid's own cards carry the data (data-plp-*); the gallery only fetches
 * the next pages of the listing, as you get near the end.
 */
(function () {
  const KEY = 'commune_plp_view';
  const html = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let root = null;
  let feed = null;
  let thumbs = null;
  let info = null;
  let brand = null;
  let items = [];
  let index = 0;
  let next = null;
  let loading = false;
  let ticking = false;
  let lead = false; // true while the feed has a copy of the last slide in front and of the first slide behind (so it can loop)
  let settleTimer = 0;
  let pendingUrl = null; // the product to start on when the gallery opens
  let resumeUrl = null; // the product that was opened from the gallery: Back (or a reload) returns to it
  const LAST_KEY = 'plp-gallery-last';
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    const last = JSON.parse(sessionStorage.getItem(LAST_KEY));
    if (nav && nav.type === 'back_forward' && last && last.page === location.pathname + location.search) resumeUrl = last.url;
  } catch (_) { /* storage blocked */ }

  const read = (el) => {
    const d = el.dataset;
    return {
      url: d.plpUrl, title: d.plpTitle, vendor: d.plpVendor, price: d.plpPrice, image: d.plpImage, thumb: d.plpThumb,
      variant: d.plpVariant, single: d.plpSingle === 'true', available: d.plpAvailable === 'true',
    };
  };
  const nextIn = (doc) => {
    const a = doc.querySelector('#results [data-plp-pagination] a[rel="next"]');
    return a ? a.getAttribute('href') : null;
  };
  const collect = (doc) => $$('#results ul.collection-list [data-plp-item]', doc).map(read).filter((i) => i.url && i.image);
  const mode = () => (html.classList.contains('plp-gallery-on') ? 'gallery' : 'grid');

  function build() {
    if (root) return;
    const results = $('#results');
    if (!results) return;
    root = document.createElement('section');
    root.className = 'plp-gallery';
    root.setAttribute('aria-label', 'Gallery');
    root.innerHTML = '<div class="plp-gallery__main"><div class="plp-gallery__feed" data-pg-feed tabindex="0" aria-label="Products"></div>' +
      '<div class="plp-gallery__brand" data-pg-brand></div>' +
      '<div class="plp-gallery__info" data-pg-info aria-live="polite"></div></div>' +
      '<div class="plp-gallery__thumbs" data-pg-thumbs role="listbox" aria-label="All products"></div>';
    results.parentNode.insertBefore(root, results);
    feed = $('[data-pg-feed]', root);
    thumbs = $('[data-pg-thumbs]', root);
    info = $('[data-pg-info]', root);
    brand = $('[data-pg-brand]', root);
    feed.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', () => { if (mode() === 'gallery' && pageMode()) onScroll(); }, { passive: true });
    root.addEventListener('click', (e) => {
      const t = e.target.closest('.plp-thumb');
      if (t) return go(Number(t.dataset.i));
      const b = e.target.closest('[data-pg-add]');
      if (b) return add(index, b);
    });
  }

  function slideHTML(it, i, clone) {
    const eager = i < 2 || clone ? 'eager' : 'lazy';
    return '<article class="plp-slide' + (clone ? ' plp-slide--clone' : '') + '"' + (clone ? ' aria-hidden="true"' : '') + ' data-i="' + i + '">' +
      '<a class="plp-slide__img" href="' + esc(it.url) + '"><img src="' + esc(it.image) + '" alt="' + esc(it.vendor + ' ' + it.title) + '" loading="' + eager + '" decoding="async"></a></article>';
  }

  // The info card does not scroll: it always shows the product that is on screen
  function renderInfo() {
    const it = items[index];
    if (!info || !it) return;
    info.innerHTML = '<a class="plp-gallery__name" href="' + esc(it.url) + '"><span class="plp-gallery__vendor">' + esc(it.vendor) + '</span><span class="plp-gallery__title">' + esc(it.title) + '</span></a>' +
      '<div class="plp-gallery__price">' + esc(it.available ? it.price : 'Sold out') + '</div>' +
      '';
    // phones: the card is fixed at the bottom of the screen; every slide keeps that much room free under its photo
    if (root) root.style.setProperty('--pg-info-h', info.offsetHeight + 'px');
  }

  function thumbHTML(it, i) {
    return '<button type="button" class="plp-thumb" role="option" data-i="' + i + '" aria-label="' + esc(it.vendor + ' ' + it.title) + '" aria-current="false"><img src="' + esc(it.thumb) + '" alt="" loading="lazy"></button>';
  }

  function markCurrent() {
    renderInfo();
    $$('.plp-thumb', thumbs).forEach((b) => {
      const on = Number(b.dataset.i) === index;
      b.setAttribute('aria-current', on);
      if (on) thumbs.scrollTo({ left: b.offsetLeft - thumbs.clientWidth / 2 + b.offsetWidth / 2, behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  // Phones: the gallery scrolls with the page itself instead of inside its own box. A mobile browser only hides its
  // address bar and toolbar when the page scrolls, so this is what makes the gallery go full screen after the first swipe.
  const pageMq = window.matchMedia('(max-width: 767px)');
  const pageMode = () => pageMq.matches;
  const feedTop = () => feed.getBoundingClientRect().top + window.scrollY; // where the first slide starts on the page
  const getTop = () => (pageMode() ? window.scrollY - feedTop() : feed.scrollTop);
  const setTop = (v) => { if (pageMode()) window.scrollTo(0, feedTop() + v); else feed.scrollTop = v; };
  const smoothTo = (v) => {
    const o = { top: (pageMode() ? feedTop() : 0) + v, behavior: reduce ? 'auto' : 'smooth' };
    if (pageMode()) window.scrollTo(o); else feed.scrollTo(o);
  };
  const snapEl = () => (pageMode() ? html : feed);

  function slideHeight() {
    if (pageMode()) {
      const s = feed.querySelector('.plp-slide');
      return (s && s.offsetHeight) || window.innerHeight || 1;
    }
    return feed.clientHeight || 1;
  }

  const pos = (i) => i + (lead ? 1 : 0);

  // jumps must not be pulled back by scroll snapping
  function noSnap(fn) {
    const el = snapEl();
    el.style.scrollSnapType = 'none';
    fn();
    setTimeout(() => { el.style.scrollSnapType = ''; }, 60);
  }

  // Once every page is loaded the feed loops: the last slide is repeated before the first and the first after the last
  function ends() {
    const want = !next && items.length > 1;
    if (!feed || want === lead) return;
    noSnap(() => {
      if (want) {
        feed.insertAdjacentHTML('afterbegin', slideHTML(items[items.length - 1], items.length - 1, true));
        feed.insertAdjacentHTML('beforeend', slideHTML(items[0], 0, true));
        setTop(getTop() + slideHeight());
      } else {
        $$('.plp-slide--clone', feed).forEach((c) => c.remove());
        setTop(getTop() - slideHeight());
      }
    });
    lead = want;
  }

  // When the scrolling stops on a repeated slide, jump to the real one (same picture, so nobody sees it)
  function settle() {
    if (!lead || !feed) return;
    const h = slideHeight();
    const top = getTop();
    const p = Math.round(top / h);
    // The page can end before the repeated slide at the bottom is fully reached (slides shorter than the screen, browser bars):
    // being at the very bottom of the page past the last real slide counts as having landed on the repeat
    const maxTop = pageMode() ? document.documentElement.scrollHeight - window.innerHeight : feed.scrollHeight - feed.clientHeight;
    const atBottom = (pageMode() ? window.scrollY : feed.scrollTop) >= maxTop - 3;
    if (atBottom && top >= items.length * h - h * 0.5) { noSnap(() => { setTop(h); }); return; }
    // On a phone the slide height is rarely a whole number (browser bars, rounding), so p * h drifts by a few pixels
    // over a long feed: a fixed 2px tolerance then never matched on the repeated slide at the end and the feed stopped there
    if (Math.abs(top - p * h) > Math.max(2, h * 0.04)) return;
    if (p === 0) noSnap(() => { setTop(items.length * h); });
    else if (p === items.length + 1) noSnap(() => { setTop(h); });
  }

  function onScroll() {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, 140);
    if (ticking) return;
    ticking = true;
    // a timer, not requestAnimationFrame: rAF stops in background tabs
    setTimeout(() => {
      ticking = false;
      const p = Math.round(getTop() / slideHeight());
      let i = lead ? p - 1 : p;
      if (lead) {
        if (i < 0) i = items.length - 1;
        else if (i >= items.length) i = 0;
      } else {
        i = Math.max(0, Math.min(items.length - 1, i));
      }
      if (i !== index) {
        index = i;
        markCurrent();
        if (index >= items.length - 6) more();
      }
    }, 16);
  }

  function go(i) {
    if (!items.length) return;
    let p = -1;
    if (i < 0) p = lead ? 0 : -1;
    else if (i >= items.length) p = lead ? items.length + 1 : -1;
    else p = pos(i);
    if (p < 0) return;
    smoothTo(p * slideHeight());
  }

  async function more() {
    if (loading || !next) return;
    loading = true;
    try {
      const url = new URL(next, location.origin);
      const cur = new URLSearchParams(location.search);
      if (cur.has('preview_theme_id') && !url.searchParams.has('preview_theme_id')) url.searchParams.set('preview_theme_id', cur.get('preview_theme_id'));
      const res = await fetch(url.pathname + url.search, { credentials: 'same-origin' });
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      const seen = new Set(items.map((i) => i.url));
      const fresh = collect(doc).filter((i) => !seen.has(i.url));
      const from = items.length;
      items = items.concat(fresh);
      next = nextIn(doc);
      feed.insertAdjacentHTML('beforeend', fresh.map((it, k) => slideHTML(it, from + k)).join(''));
      thumbs.insertAdjacentHTML('beforeend', fresh.map((it, k) => thumbHTML(it, from + k)).join(''));
    } catch (_) {
      next = null;
    }
    loading = false;
    ends();
    watchEnd();
  }

  // A small listing (a brand with a few pages) is loaded whole right away, so the feed can loop from the very first slide:
  // swiping down on the first product lands on the last one. A big listing (All) still loops only once its end is reached.
  const lastPageOf = (doc) => {
    let last = 1;
    doc.querySelectorAll('#results [data-plp-pagination] a[href*="page="]').forEach((a) => {
      const n = parseInt(new URL(a.getAttribute('href'), location.origin).searchParams.get('page'), 10);
      if (n > last) last = n;
    });
    return last;
  };
  async function loadSmall() {
    if (!next || lastPageOf(document) > 4) return;
    for (let guard = 0; next && guard < 60; guard++) {
      if (loading) await new Promise((r) => setTimeout(r, 120));
      else await more();
    }
  }

  // A second way to notice the end is near, next to the scroll position: the last few slides coming into view.
  // It does not depend on scroll events, so a phone browser that reports them late (or not at all) still loads the next page.
  let endWatch = null;
  function watchEnd() {
    if (endWatch) { endWatch.disconnect(); endWatch = null; }
    if (!feed || !next || !('IntersectionObserver' in window)) return;
    endWatch = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) more();
    }, { rootMargin: '0px 0px 600px 0px' });
    $$('.plp-slide:not(.plp-slide--clone)', feed).slice(-6).forEach((slide) => endWatch.observe(slide));
  }

  async function add(i, btn) {
    const it = items[i];
    if (!it || !it.available) return;
    if (!it.single) { location.href = it.url; return; }
    btn.disabled = true;
    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: [{ id: Number(it.variant), quantity: 1 }] }),
      });
      if (!res.ok) throw new Error('add failed');
      document.dispatchEvent(new CustomEvent('edge:cart-added'));
      btn.textContent = 'Added to cart';
      setTimeout(() => { btn.textContent = 'Add to cart'; btn.disabled = false; }, 1500);
    } catch (_) {
      btn.textContent = 'Sold out';
    }
  }

  // The brand description (when one brand is selected) is rendered with the results; the gallery shows a copy of it
  function renderBrand() {
    if (!brand) return;
    const n = $('#results [data-brand-note]');
    brand.innerHTML = n ? n.outerHTML : '';
    syncBrandH();
  }

  // Phones: the brand note is fixed under the header strip, so every slide keeps that much room free above its photo
  // (the note never covers a product). An opened note lies over the photo while it is being read, as before.
  function syncBrandH() {
    if (!root || !brand) return;
    const h = pageMode() && brand.firstElementChild && !brand.querySelector('.brand-note.is-open') ? brand.offsetHeight : null;
    if (h !== null) root.style.setProperty('--pg-brand-h', h + 'px');
    else if (!pageMode() || !brand.firstElementChild) root.style.setProperty('--pg-brand-h', '0px');
    root.classList.toggle('has-brand', !!brand.firstElementChild);
  }

  function open() {
    build();
    if (!root) return;
    renderBrand();
    items = collect(document);
    next = nextIn(document);
    if (pendingUrl) {
      const k = items.findIndex((it) => it.url === pendingUrl);
      if (k > -1) index = k;
      pendingUrl = null;
    }
    index = Math.min(index, Math.max(0, items.length - 1));
    lead = false;
    feed.innerHTML = items.map((it, i) => slideHTML(it, i)).join('');
    thumbs.innerHTML = items.map((it, i) => thumbHTML(it, i)).join('');
    ends();
    watchEnd();
    // the feed has a height only once the gallery is displayed
    setTimeout(() => {
      noSnap(() => { setTop(pos(index) * slideHeight()); });
      markCurrent();
    }, 30);
    if (index >= items.length - 6) more();
    loadSmall();
    syncBrandH();
    setTimeout(syncBrandH, 400);
    if (resumeUrl) {
      const url = resumeUrl;
      resumeUrl = null;
      resume(url);
    }
  }

  // Coming back from a product page: load pages of the listing until that product is in the feed, then stand on it.
  // The feed stays invisible meanwhile so nobody sees it jump.
  async function resume(url) {
    if (root) root.style.visibility = 'hidden';
    let moved = false;
    const mark = () => { moved = true; };
    ['wheel', 'touchstart', 'keydown'].forEach((t) => addEventListener(t, mark, { once: true, passive: true }));
    const started = Date.now();
    try {
      while (items.findIndex((it) => it.url === url) < 0 && next && Date.now() - started < 8000) {
        if (loading) await new Promise((r) => setTimeout(r, 50));
        else await more();
      }
    } catch (_) { /* show it where it is */ }
    const place = () => {
      const k = items.findIndex((it) => it.url === url);
      if (k < 0 || !feed || mode() !== 'gallery') return;
      index = k;
      noSnap(() => { setTop(pos(k) * slideHeight()); });
      markCurrent();
    };
    place();
    if (root) root.style.visibility = '';
    // the listing's own scroll restore may run a moment later: stand on the product again unless the visitor has moved
    [250, 700, 1500].forEach((ms) => setTimeout(() => { if (!moved) place(); }, ms));
  }

  // The rail button shows the view you would switch to: the gallery icon in grid view, the grid icon in gallery view
  function syncToggle() {
    const next = mode() === 'gallery' ? 'grid' : 'gallery';
    $$('[data-plp-toggle]').forEach((b) => {
      $$('[data-ico]', b).forEach((i) => { i.toggleAttribute('hidden', i.dataset.ico !== next); });
      b.setAttribute('aria-label', 'Switch to ' + next + ' view');
      b.title = next === 'gallery' ? 'Gallery view' : 'Grid view';
    });
  }

  // the grid product nearest the middle of the screen: the one the visitor is looking at
  function gridUrl() {
    let best = null;
    let bd = Infinity;
    $$('#results ul.collection-list [data-plp-item]').forEach((t) => {
      const r = t.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const d = Math.hypot(r.left + r.width / 2 - window.innerWidth / 2, r.top + r.height / 2 - window.innerHeight / 2);
      if (d < bd) { bd = d; best = t; }
    });
    return best ? best.dataset.plpUrl : null;
  }

  function setMode(m, startup) {
    const was = mode();
    let url = null;
    if (!startup && m !== was) url = was === 'grid' ? gridUrl() : (items[index] && items[index].url) || null;
    html.classList.toggle('plp-gallery-on', m === 'gallery');
    try { localStorage.setItem(KEY, m); } catch (_) {}
    if (m === 'gallery') {
      pendingUrl = url;
      open();
      window.scrollTo(0, 0);
    } else {
      const tile = url && $$('#results ul.collection-list [data-plp-item]').find((t) => t.dataset.plpUrl === url);
      if (tile) tile.scrollIntoView({ block: 'center', behavior: 'instant' });
      else window.scrollTo(0, 0);
    }
    syncToggle();
  }

  // Remember which product was opened from the gallery (and name the listing for the product page's <Back> button)
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('.plp-slide__img, .plp-gallery__name');
    if (!a || !a.getAttribute('href')) return;
    const url = a.getAttribute('href');
    try {
      sessionStorage.setItem(LAST_KEY, JSON.stringify({ page: location.pathname + location.search, url }));
      const lab = document.querySelector('[data-plp-trigger-label] .plp-t__d');
      let name = ((lab && lab.textContent) || '').trim().replace(/^</, '').replace(/>$/, '');
      if (!name || /^filter$/i.test(name)) name = 'All';
      sessionStorage.setItem('plp-last', JSON.stringify({ url: location.pathname + location.search, label: name }));
    } catch (_) { /* storage blocked */ }
  });
  document.addEventListener('click', (e) => {
    const note = e.target.closest('.brand-note');
    if (note && !e.target.closest('a')) {
      // in the gallery the open note covers the image instead of pushing it: the holder keeps the closed height
      const holder = note.closest('.plp-gallery__brand');
      if (holder && !note.classList.contains('is-open')) holder.style.height = holder.offsetHeight + 'px';
      note.classList.toggle('is-open');
      if (holder && !note.classList.contains('is-open')) holder.style.height = '';
    }
    if (e.target.closest('[data-plp-toggle]')) return setMode(mode() === 'gallery' ? 'grid' : 'gallery');
  });
  document.addEventListener('keydown', (e) => {
    if (mode() !== 'gallery' || e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'ArrowRight') { go(index + 1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { go(index - 1); e.preventDefault(); }
  });
  // A phone fires "resize" every time its toolbar hides or shows; only a real change of width (rotation) needs repositioning there
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => {
    if (mode() !== 'gallery' || !feed) return;
    if (pageMode() && window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    syncBrandH();
    noSnap(() => { setTop(pos(index) * slideHeight()); });
  });
  // filters, sold-out switch and sorting swap the results: rebuild the gallery from them
  document.addEventListener('plp:results-updated', () => {
    syncToggle();
    if (mode() === 'gallery') { index = 0; open(); }
  });

  // Opening a listing (Shop All from the menu, a brand, a link) starts in grid view. The view chosen last is only
  // brought back when the same page is shown again: Back from a product, or a reload.
  let saved = null;
  let again = false;
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    again = !!nav && (nav.type === 'back_forward' || nav.type === 'reload');
    saved = localStorage.getItem(KEY);
  } catch (_) {}
  if (saved === 'gallery' && again) setMode('gallery', true);
  else syncToggle();
})();
/* brand note v5 */
