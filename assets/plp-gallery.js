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
  let items = [];
  let index = 0;
  let next = null;
  let loading = false;
  let ticking = false;

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
      '<div class="plp-gallery__info" data-pg-info aria-live="polite"></div></div>' +
      '<div class="plp-gallery__thumbs" data-pg-thumbs role="listbox" aria-label="All products"></div>';
    results.parentNode.insertBefore(root, results);
    feed = $('[data-pg-feed]', root);
    thumbs = $('[data-pg-thumbs]', root);
    info = $('[data-pg-info]', root);
    feed.addEventListener('scroll', onScroll, { passive: true });
    root.addEventListener('click', (e) => {
      const t = e.target.closest('.plp-thumb');
      if (t) return go(Number(t.dataset.i));
      const b = e.target.closest('[data-pg-add]');
      if (b) return add(index, b);
    });
  }

  function slideHTML(it, i) {
    const eager = i < 2 ? 'eager' : 'lazy';
    return '<article class="plp-slide" data-i="' + i + '">' +
      '<a class="plp-slide__img" href="' + esc(it.url) + '"><img src="' + esc(it.image) + '" alt="' + esc(it.vendor + ' ' + it.title) + '" loading="' + eager + '" decoding="async"></a></article>';
  }

  // The info card does not scroll: it always shows the product that is on screen
  function renderInfo() {
    const it = items[index];
    if (!info || !it) return;
    info.innerHTML = '<a class="plp-gallery__name" href="' + esc(it.url) + '"><span class="plp-gallery__vendor">' + esc(it.vendor) + '</span><span class="plp-gallery__title">' + esc(it.title) + '</span></a>' +
      '<div class="plp-gallery__price">' + esc(it.available ? it.price : 'Sold out') + '</div>' +
      '';
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

  function slideHeight() {
    return feed.clientHeight || 1;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    // a timer, not requestAnimationFrame: rAF stops in background tabs
    setTimeout(() => {
      ticking = false;
      const i = Math.max(0, Math.min(items.length - 1, Math.round(feed.scrollTop / slideHeight())));
      if (i !== index) {
        index = i;
        markCurrent();
        if (index >= items.length - 6) more();
      }
    }, 16);
  }

  function go(i) {
    if (i < 0 || i >= items.length) return;
    feed.scrollTo({ top: i * slideHeight(), behavior: reduce ? 'auto' : 'smooth' });
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

  function open() {
    build();
    if (!root) return;
    items = collect(document);
    next = nextIn(document);
    index = Math.min(index, Math.max(0, items.length - 1));
    feed.innerHTML = items.map(slideHTML).join('');
    thumbs.innerHTML = items.map(thumbHTML).join('');
    // the feed has a height only once the gallery is displayed
    setTimeout(() => {
      feed.scrollTop = index * slideHeight();
      markCurrent();
    }, 30);
    if (index >= items.length - 6) more();
  }

  function syncToggle() {
    $$('[data-plp-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.plpView === mode()));
  }

  function setMode(m) {
    html.classList.toggle('plp-gallery-on', m === 'gallery');
    try { localStorage.setItem(KEY, m); } catch (_) {}
    if (m === 'gallery') open();
    syncToggle();
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-plp-view]');
    if (b) setMode(b.dataset.plpView);
  });
  document.addEventListener('keydown', (e) => {
    if (mode() !== 'gallery' || e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'ArrowRight') { go(index + 1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { go(index - 1); e.preventDefault(); }
  });
  window.addEventListener('resize', () => { if (mode() === 'gallery' && feed) feed.scrollTop = index * slideHeight(); });
  // filters, sold-out switch and sorting swap the results: rebuild the gallery from them
  document.addEventListener('plp:results-updated', () => {
    syncToggle();
    if (mode() === 'gallery') { index = 0; open(); }
  });

  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (_) {}
  if (saved === 'gallery') setMode('gallery');
  else syncToggle();
})();
