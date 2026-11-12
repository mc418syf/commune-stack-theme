/* plp filter v4 */
/**
 * Filter and search panel (snippets/plp-filter-panel.liquid), the top-left trigger and the sidebar "In stock" switch.
 * - The trigger opens the panel: a left-docked column on desktop (the page moves right, a click in the grid keeps it open),
 *   a sheet that drops down over the page on phones (a click outside closes it; nothing underneath moves). Esc or the trigger again closes it on both.
 * - Every choice applies live: the URL is rebuilt here (Designer and Sort allow one value, Category and Gender several),
 *   the page is fetched (debounced, the previous request is cancelled) and the grid, the lists, the trigger text,
 *   the piece count and the switch are swapped in. history.pushState keeps the URL shareable and the back button working.
 * - Search uses /search/suggest.json (up to 4 products).
 */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const fp = $('#plp-fp');
  if (!fp) return;
  const html = document.documentElement;
  const inner = $('.plp-fp__in', fp);
  const searchOnly = fp.hasAttribute('data-plp-search-only');
  const SOLD_KEY = 'commune_hide_sold_out';

  let isOpen = false;
  let target = null; // the URL the visitor has asked for (changes pile up while the request is debounced)
  let timer = 0;
  let ctrl = null;
  let seq = 0;

  const trigger = () => $('[data-plp-trigger]');

  /* ---------- open / close ---------- */
  const desktop = window.matchMedia('(min-width: 768px)');

  // Desktop: the panel animates its width (CSS) and the gallery view moves right by that width.
  // Phones: the sheet animates max-height; its real height is measured (it changes with the search results).
  function size() {
    if (desktop.matches) {
      fp.style.maxHeight = '';
      const w = parseFloat(getComputedStyle(fp).getPropertyValue('--pf-w')) || 342;
      html.style.setProperty('--plp-panel-w', isOpen ? w + 'px' : '0px');
      html.style.setProperty('--plp-panel-h', '0px');
      return;
    }
    fp.style.maxHeight = isOpen ? inner.offsetHeight + 'px' : '0px';
    // the sheet lies over the page and the gallery, so neither makes room for it
    html.style.setProperty('--plp-panel-h', '0px');
    html.style.setProperty('--plp-panel-w', '0px');
  }

  function setOpen(v, restoreFocus) {
    if (v === isOpen) return;
    isOpen = v;
    html.classList.add('plp-fp-used');
    fp.toggleAttribute('data-open', v);
    fp.toggleAttribute('inert', !v);
    html.classList.toggle('plp-fp-open', v);
    $$('[data-plp-trigger]').forEach((b) => b.setAttribute('aria-expanded', String(v)));
    size();
    if (v && searchOnly) {
      const q = $('[data-plp-q]');
      if (q) q.focus({ preventScroll: true });
    }
    if (!v) {
      clearSearch();
      if (restoreFocus) {
        const t = trigger();
        if (t) t.focus();
      }
    }
  }

  if (window.ResizeObserver) new ResizeObserver(size).observe(inner);
  window.addEventListener('resize', size);
  if (desktop.addEventListener) desktop.addEventListener('change', size);

  /* ---------- filter: build the URL, fetch, swap ---------- */
  function wanted() {
    return new URL((target || new URL(location.href)).href);
  }
  function schedule(ms) {
    clearTimeout(timer);
    timer = setTimeout(commit, ms);
  }

  /* On a brand collection page the Designer list shows every designer (taken from the All page) and works as navigation */
  const ALL_KEY = 'plp-all-designers:v2';
  // The collection comes from the page address as well (not only from the panel's attribute), including market prefixes like /en-ca
  const collectionHandle = () => {
    const m = location.pathname.match(/\/collections\/([^/?#]+)/);
    return (m && decodeURIComponent(m[1])) || fp.dataset.plpCollection || '';
  };
  const onBrandPage = () => {
    const h = collectionHandle();
    return !!h && h !== 'all' && h !== 'vendors' && h !== 'types';
  };
  const allUrl = () => {
    const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    return root.replace(/\/?$/, '/') + 'collections/all';
  };
  const stockOn = () => { const s = $('[data-plp-stock]'); return !!s && s.getAttribute('aria-checked') === 'true'; };
  async function allDesignersHTML() {
    // With "In stock" on, the All page is asked for its in-stock counts, so designers with nothing in stock can be left out
    const key = ALL_KEY + (stockOn() ? ':in' : '');
    try { const c = sessionStorage.getItem(key); if (c) return c; } catch (_) {}
    // An unpublished theme is only served with its preview parameters, otherwise the live theme answers (it has no designer list)
    const to = new URL(allUrl(), location.origin);
    if (stockOn()) to.searchParams.set('filter.v.availability', '1');
    const here = new URLSearchParams(location.search);
    ['preview_theme_id', '_fd', 'pb', '_ab', '_bt'].forEach((k) => { if (here.has(k)) to.searchParams.set(k, here.get(k)); });
    const res = await fetch(to.pathname + to.search, { headers: { Accept: 'text/html' }, credentials: 'same-origin' });
    if (!res.ok) { console.warn('[plp] designer list: ' + to.pathname + to.search + ' answered ' + res.status); return ''; }
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const list = $('.plp-f__c--des .plp-f__list', doc);
    const out = list ? list.innerHTML : '';
    if (!out) console.warn('[plp] designer list: no Designer list found in ' + to.pathname + to.search + ' (preview parameters sent: ' + (to.search || 'none') + ')');
    try { if (out) sessionStorage.setItem(key, out); } catch (_) {}
    return out;
  }
  async function applyAllDesigners() {
    if (!onBrandPage()) return;
    console.info('[plp] designer list: brand page "' + collectionHandle() + '", loading all designers');
    try {
      const out = await allDesignersHTML();
      const list = $('.plp-f__c--des .plp-f__list');
      if (!out || !list) { if (out && !list) console.warn('[plp] designer list: panel has no Designer list to fill'); return; }
      const top = list.parentElement.scrollTop;
      list.innerHTML = out;
      $$('[data-plp-opt][data-single]', list).forEach((b) => {
        const here = !!b.dataset.brandUrl && b.dataset.brandUrl === location.pathname;
        b.setAttribute('aria-pressed', String(here));
        b.removeAttribute('aria-disabled');
        const c = b.querySelector('.plp-o__c');
        if (stockOn() && !here && c && parseInt(c.textContent, 10) === 0) b.remove(); // nothing in stock: not offered
      });
      list.parentElement.scrollTop = top;
    } catch (err) { console.warn('[plp] designer list failed', err); /* keep the list the page came with */ }
  }

  function pick(btn) {
    const u = wanted();
    const param = btn.dataset.param;
    const value = btn.dataset.value;
    const on = btn.getAttribute('aria-pressed') === 'true';
    if (btn.hasAttribute('data-plp-sort')) {
      u.searchParams.delete('sort_by');
      if (value) u.searchParams.set('sort_by', value);
      $$('[data-plp-sort]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      u.searchParams.delete('page');
      target = u;
      return schedule(150);
    }
    const others = u.searchParams.getAll(param).filter((x) => x !== value);
    u.searchParams.delete(param);
    if (btn.hasAttribute('data-single') && onBrandPage()) {
      // the designer list is a menu here: another brand opens its own page, the current one goes back to All
      const to = new URL(on ? allUrl() : (btn.dataset.brandUrl || allUrl()), location.origin);
      u.searchParams.delete(param);
      u.searchParams.forEach((val, key) => { if (key !== 'q' && key !== 'page') to.searchParams.append(key, val); });
      if (!on && !btn.dataset.brandUrl) to.searchParams.set(param, value);
      window.location.href = to.pathname + to.search;
      return;
    }
    if (btn.hasAttribute('data-single') && btn.dataset.brandUrl) {
      // choosing a designer opens that brand's own page (own URL for SEO); other filters and sort carry over
      const keep = new URL(btn.dataset.brandUrl, location.origin);
      if (!on) {
        u.searchParams.delete(param);
        u.searchParams.forEach((val, key) => { if (key !== 'q') keep.searchParams.append(key, val); });
        keep.searchParams.delete('page');
        window.location.href = keep.pathname + keep.search;
        return;
      }
    }
    if (btn.hasAttribute('data-single')) {
      // one designer at a time: a new choice replaces the old one, the chosen one again clears it
      if (!on) u.searchParams.set(param, value);
      $$('[data-plp-opt][data-single][data-param="' + param + '"]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      if (!on) btn.setAttribute('aria-pressed', 'true');
    } else {
      others.forEach((x) => u.searchParams.append(param, x));
      if (!on) u.searchParams.append(param, value);
      btn.setAttribute('aria-pressed', String(!on));
    }
    u.searchParams.delete('page');
    target = u;
    schedule(150);
  }

  function clearAll() {
    const u = wanted();
    Array.from(u.searchParams.keys()).forEach((k) => {
      if (k.indexOf('filter.p.') === 0) u.searchParams.delete(k);
    });
    u.searchParams.delete('page');
    target = u;
    $$('[data-plp-opt]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    schedule(150);
  }

  function toggleStock(btn) {
    if (btn.hasAttribute('data-plp-stock-local')) {
      // Availability filter not enabled in Search & Discovery: hide sold-out cards on the page instead
      const on = btn.getAttribute('aria-checked') !== 'true';
      btn.setAttribute('aria-checked', String(on));
      html.classList.toggle('edge-hide-soldout', on);
      try { localStorage.setItem(SOLD_KEY, on ? '1' : '0'); } catch (_) {}
      return;
    }
    const on = btn.getAttribute('aria-checked') === 'true';
    btn.setAttribute('aria-checked', String(!on));
    const u = wanted();
    if (on) u.searchParams.delete(btn.dataset.param);
    else u.searchParams.set(btn.dataset.param, btn.dataset.value || '1');
    u.searchParams.delete('page');
    target = u;
    schedule(150);
  }

  function swap(doc) {
    const active = document.activeElement;
    const focusKey = active && active.matches && active.matches('[data-plp-opt]') ? [active.dataset.param, active.dataset.value] : null;

    const res = $('#results');
    const nres = $('#results', doc);
    if (res && nres) res.innerHTML = nres.innerHTML;

    const cols = $('[data-plp-cols]');
    const ncols = $('[data-plp-cols]', doc);
    if (cols && ncols) {
      const top = cols.scrollTop;
      const tops = $$('[data-plp-col]', cols).map((c) => c.scrollTop);
      cols.innerHTML = ncols.innerHTML;
      cols.scrollTop = top;
      $$('[data-plp-col]', cols).forEach((c, i) => { c.scrollTop = tops[i] || 0; });
    }
    const lab = $('[data-plp-trigger-label]');
    const nlab = $('[data-plp-trigger-label]', doc);
    if (lab && nlab) lab.innerHTML = nlab.innerHTML;

    const n = $('[data-plp-n]');
    const nn = $('[data-plp-n]', doc);
    if (n && nn) n.textContent = nn.textContent;
    const sn = $('[data-plp-sortnote]');
    const nsn = $('[data-plp-sortnote]', doc);
    if (sn && nsn) sn.textContent = nsn.textContent;

    const sw = $('[data-plp-stock]');
    const nsw = $('[data-plp-stock]', doc);
    if (sw && nsw && nsw.hasAttribute('data-param')) sw.setAttribute('aria-checked', nsw.getAttribute('aria-checked'));

    if (focusKey) {
      const again = $$('[data-plp-opt]').find((b) => b.dataset.param === focusKey[0] && b.dataset.value === focusKey[1]);
      if (again) again.focus({ preventScroll: true });
    }
    size();
    applyAllDesigners();
  }

  async function load(url, push) {
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    const mine = ++seq;
    html.classList.add('edge-busy');
    try {
      const res = await fetch(url, { headers: { Accept: 'text/html' }, signal: ctrl.signal });
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      if (mine !== seq) return;
      swap(doc);
      if (push && url !== location.pathname + location.search) history.pushState({ plp: true }, '', url);
      target = null;
      document.dispatchEvent(new CustomEvent('plp:results-updated'));
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      window.location.href = url;
    } finally {
      if (mine === seq) html.classList.remove('edge-busy');
    }
  }

  function commit() {
    if (!target) return;
    const u = target;
    load(u.pathname + u.search, true);
  }

  window.addEventListener('popstate', () => {
    if ($('[data-plp-cols]')) {
      target = null;
      load(location.pathname + location.search, false);
    }
  });

  /* ---------- search ---------- */
  const q = $('[data-plp-q]');
  const qx = $('[data-plp-q-clear]');
  const box = $('[data-plp-results]');
  let sTimer = 0;
  let sSeq = 0;
  let sCtrl = null;

  function money(cents) {
    if (typeof window.communeMoney === 'function') return window.communeMoney(cents);
    const cur = (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || 'CAD';
    try {
      return new Intl.NumberFormat('en-CA', { style: 'currency', currency: cur }).format(cents / 100);
    } catch (_) {
      return '$' + (cents / 100).toFixed(2);
    }
  }

  function thumb(p) {
    const src = p.image || (p.featured_image && p.featured_image.url) || '';
    if (!src) return '';
    return '<img src="' + esc(src + (src.indexOf('?') > -1 ? '&' : '?') + 'width=120') + '" alt="" width="40" height="50" loading="lazy">';
  }

  function render(products) {
    if (!box) return;
    if (products === null) box.innerHTML = '';
    else if (!products.length) box.innerHTML = '<p class="plp-r plp-r--none">&lt;No match&gt;</p>';
    else {
      box.innerHTML = products
        .map(
          (p) =>
            '<a class="plp-r" href="' + esc(p.url) + '"><span class="plp-r__i">' + thumb(p) + '</span><span class="plp-r__n">' + esc([p.vendor, p.title].filter(Boolean).join(' ')) +
            '</span><span class="plp-r__p">' + esc(money(parseFloat(p.price) * 100)) + '</span></a>'
        )
        .join('');
    }
    size();
  }

  function clearSearch() {
    clearTimeout(sTimer);
    sSeq++;
    if (sCtrl) sCtrl.abort();
    if (q) q.value = '';
    if (qx) qx.hidden = true;
    render(null);
  }

  if (q) {
    q.addEventListener('input', () => {
      clearTimeout(sTimer);
      const text = q.value.trim();
      if (qx) qx.hidden = !q.value;
      if (!text) {
        sSeq++;
        if (sCtrl) sCtrl.abort();
        return render(null);
      }
      sTimer = setTimeout(async () => {
        const mine = ++sSeq;
        if (sCtrl) sCtrl.abort();
        sCtrl = new AbortController();
        try {
          const res = await fetch(
            '/search/suggest.json?q=' + encodeURIComponent(text) + '&resources[type]=product&resources[limit]=4&resources[options][unavailable_products]=last',
            { headers: { Accept: 'application/json' }, signal: sCtrl.signal }
          );
          const data = await res.json();
          if (mine !== sSeq) return;
          render((data.resources && data.resources.results && data.resources.results.products) || []);
        } catch (err) {
          if (err && err.name === 'AbortError') return;
          if (mine === sSeq) render([]);
        }
      }, 200);
    });
  }

  /* ---------- events ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t || !t.closest) return;

    if (t.closest('[data-plp-trigger]')) return setOpen(!isOpen);
    if (t.closest('[data-plp-close]')) return setOpen(false, true);

    const opt = t.closest('[data-plp-opt]');
    if (opt) {
      if (opt.getAttribute('aria-disabled') === 'true') return;
      return pick(opt);
    }
    if (t.closest('[data-plp-clear]')) {
      e.preventDefault();
      return clearAll();
    }
    const stock = t.closest('[data-plp-stock]');
    if (stock) return toggleStock(stock);
    if (t.closest('[data-plp-q-clear]')) {
      clearSearch();
      if (q) q.focus();
      return;
    }
    // Phones: a click anywhere else outside the panel closes it. Desktop: the panel is docked beside the grid and stays open.
    if (isOpen && !desktop.matches && t.isConnected && !fp.contains(t) && !t.closest('[data-plp-toggle]') && !t.closest('[data-plp-stock]')) setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) setOpen(false, true);
  });

  // keep the sidebar switch and the trigger in step when the theme editor re-renders the header
  document.addEventListener('shopify:section:load', () => {
    $$('[data-plp-trigger]').forEach((b) => b.setAttribute('aria-expanded', String(isOpen)));
  });

  /* ---------- init ---------- */
  fp.setAttribute('inert', '');
  try {
    // without the Availability filter, the switch remembers its state in this browser
    if (localStorage.getItem(SOLD_KEY) === '1') {
      const local = $('[data-plp-stock-local]');
      if (local) {
        local.setAttribute('aria-checked', 'true');
        html.classList.add('edge-hide-soldout');
      }
    }
  } catch (_) {}
  size();
  if (window.requestIdleCallback) window.requestIdleCallback(applyAllDesigners, { timeout: 1500 });
  else setTimeout(applyAllDesigners, 200);

  /* An old or shared filter link (?filter.p.vendor=X) moves to the brand's own page when that page exists. */
  (function toBrandPage() {
    const sel = $$('[data-plp-opt][data-single][aria-pressed="true"][data-brand-url]');
    const u = new URL(location.href);
    if (sel.length !== 1 || u.searchParams.getAll(sel[0].dataset.param).length !== 1) return;
    const to = new URL(sel[0].dataset.brandUrl, location.origin);
    if (to.pathname === u.pathname) return;
    u.searchParams.delete(sel[0].dataset.param);
    u.searchParams.delete('page');
    u.searchParams.forEach((v, k) => to.searchParams.append(k, v));
    location.replace(to.pathname + to.search);
  })();
})();
