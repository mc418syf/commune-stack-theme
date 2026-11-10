/**
 * PLP gallery view. The grid's own cards carry the data (data-plp-*), so the gallery needs no extra requests
 * except the next pages of the listing, which it loads itself as you reach the end of the thumbnails.
 */
(function () {
  const KEY = 'commune_plp_view';
  const html = document.documentElement;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let root = null;
  let items = [];
  let index = 0;
  let next = null;
  let loading = false;

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
    root.innerHTML =
      '<div class="plp-gallery__stage">' +
      '<a class="plp-gallery__img" data-pg-link href="#"><img data-pg-img alt=""></a>' +
      '<div class="plp-gallery__info"><a class="plp-gallery__name" data-pg-name href="#"></a>' +
      '<div class="plp-gallery__price" data-pg-price></div>' +
      '<button type="button" class="theme-button plp-gallery__add" data-pg-add>Add to cart</button></div></div>' +
      '<div class="plp-gallery__thumbs" data-pg-thumbs role="listbox" aria-label="Products"></div>';
    results.parentNode.insertBefore(root, results);
    root.addEventListener('click', (e) => {
      const t = e.target.closest('.plp-thumb');
      if (t) return select(Number(t.dataset.i));
      if (e.target.closest('[data-pg-add]')) return add();
    });
  }

  function thumbsHTML(from) {
    return items.slice(from).map((it, k) =>
      '<button type="button" class="plp-thumb" role="option" data-i="' + (from + k) + '" aria-label="' + esc(it.vendor + ' ' + it.title) + '" aria-current="false"><img src="' + esc(it.thumb) + '" alt="" loading="lazy"></button>'
    ).join('');
  }

  function render() {
    if (!root || !items.length) return;
    const it = items[index];
    $('[data-pg-img]', root).src = it.image;
    $('[data-pg-img]', root).alt = it.vendor + ' ' + it.title;
    $('[data-pg-link]', root).href = it.url;
    const name = $('[data-pg-name]', root);
    name.href = it.url;
    name.innerHTML = '<span class="plp-gallery__vendor">' + esc(it.vendor) + '</span><span class="plp-gallery__title">' + esc(it.title) + '</span>';
    $('[data-pg-price]', root).textContent = it.available ? it.price : 'Sold out';
    const add = $('[data-pg-add]', root);
    add.hidden = !it.available;
    add.textContent = it.single ? 'Add to cart' : 'Choose size';
    add.disabled = false;
    $$('.plp-thumb', root).forEach((b) => {
      const on = Number(b.dataset.i) === index;
      b.setAttribute('aria-current', on);
      if (on) b.scrollIntoView({ inline: 'center', block: 'nearest' });
    });
    [index + 1, index - 1].forEach((k) => { if (items[k]) new Image().src = items[k].image; });
  }

  function select(i) {
    if (i < 0 || i >= items.length) return;
    index = i;
    render();
    if (index >= items.length - 6) more();
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
      $('[data-pg-thumbs]', root).insertAdjacentHTML('beforeend', thumbsHTML(from));
    } catch (_) {
      next = null;
    }
    loading = false;
  }

  async function add() {
    const it = items[index];
    if (!it || !it.available) return;
    if (!it.single) { location.href = it.url; return; }
    const btn = $('[data-pg-add]', root);
    btn.disabled = true;
    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: [{ id: Number(it.variant), quantity: 1 }] }),
      });
      if (!res.ok) throw new Error('add failed');
      document.dispatchEvent(new CustomEvent('edge:cart-added'));
      btn.textContent = 'Added';
      setTimeout(() => { if (items[index] === it) btn.textContent = 'Add to cart'; btn.disabled = false; }, 1500);
    } catch (_) {
      btn.textContent = 'Sold out';
      btn.disabled = true;
    }
  }

  function open() {
    build();
    if (!root) return;
    items = collect(document);
    next = nextIn(document);
    index = Math.min(index, Math.max(0, items.length - 1));
    $('[data-pg-thumbs]', root).innerHTML = thumbsHTML(0);
    render();
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
    if (e.key === 'ArrowRight') { select(index + 1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { select(index - 1); e.preventDefault(); }
  });
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
