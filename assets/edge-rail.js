/* v3 vellum */
/**
 * Commune edge rail: tools panel (Menu / Filter / Cart / Try-on), search and the PLP filter swap.
 * Cart lines come from /cart.js, try-on lines from the Alpine store $store.tryOnList (try-on-list.js).
 */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const panel = $('[data-edge-panel]');
  if (!panel) return;
  const scrim = $('[data-edge-scrim]');
  const plus = $('[data-edge-open="menu"]') || $('[data-edge-search]') || $('[data-edge-open="cart"]');
  const bar = $('[data-edge-searchbar]');
  const input = $('[data-edge-input]');
  const results = $('[data-edge-results]');
  const WINDOW_LABELS = { menu: 'Menu', filter: 'Filter', cart: 'Cart' };

  let cart = null;
  let lastTrigger = null;
  let isOpen = false;

  /* ---------- money ---------- */
  function money(cents, currency) {
    try {
      return new Intl.NumberFormat('en-CA', { style: 'currency', currency: currency || 'CAD' }).format(cents / 100);
    } catch (_) {
      return '$' + (cents / 100).toFixed(2);
    }
  }

  /* ---------- counts ---------- */
  const counts = { cart: Number((railRoot() || {}).dataset ? railRoot().dataset.cartCount : 0) || 0, try: 0 };
  function railRoot() {
    return $('[data-edge-rail]');
  }
  // One Cart for both lists: the label shows cart + try-on, and the button is hidden while both are empty
  function setCount(kind, n) {
    if (kind in counts) counts[kind] = n;
    $$('[data-edge-count="' + kind + '"]').forEach((el) => (el.textContent = n));
    $$('[data-edge-count="total"]').forEach((el) => (el.textContent = counts.cart + counts.try));
    syncCartVisibility();
  }
  function syncCartVisibility() {
    const empty = counts.cart + counts.try === 0;
    const keep = isOpen && panel.dataset.tab === 'cart';
    $$('[data-edge-open="cart"], [data-edge-tab="cart"]').forEach((el) => (el.hidden = empty && !keep));
  }
  function tryStore() {
    return window.Alpine && window.Alpine.store ? window.Alpine.store('tryOnList') : null;
  }
  function tryItems() {
    const s = tryStore();
    if (s) return s.items;
    try {
      return JSON.parse(localStorage.getItem('commune_try_on_list') || '[]') || [];
    } catch (_) {
      return [];
    }
  }

  /* ---------- panel ---------- */
  // Each rail button opens its own window: one pane per button, no tab row inside the panel
  function positionWindow(tab) {
    const btn = $('[data-edge-rail] [data-edge-open="' + tab + '"]');
    if (!btn || tab === 'cart' || tab === 'menu') {
      panel.style.removeProperty('--edge-win-top');
      return;
    }
    panel.style.setProperty('--edge-win-top', Math.max(0, Math.round(btn.getBoundingClientRect().top)) + 'px');
  }

  function setTab(tab) {
    const names = $$('[data-edge-pane]', panel).map((p) => p.dataset.edgePane);
    if (names.indexOf(tab) < 0) tab = names[0] || 'menu';
    panel.dataset.tab = tab;
    positionWindow(tab);
    panel.setAttribute('aria-label', WINDOW_LABELS[tab] || 'Tools');
    $$('[data-edge-pane]', panel).forEach((p) => (p.hidden = p.dataset.edgePane !== tab));
    if (tab === 'cart') {
      refreshCart();
      renderTry();
    }
    if (tab === 'filter') ensureGroupOpen();
    syncTriggers();
  }

  function syncTriggers() {
    const railEl = $('[data-edge-rail]');
    if (railEl) railEl.classList.toggle('is-open', isOpen);
    $$('[data-edge-open]', $('[data-edge-rail]')).forEach((b) => {
      const on = isOpen && panel.dataset.tab === b.dataset.edgeOpen;
      b.setAttribute('aria-expanded', on);
      b.classList.toggle('is-active', on);
    });
  }

  let pinned = false;
  let closeTimer = 0;

  function pin() {
    if (isOpen && !pinned) {
      pinned = true;
      document.documentElement.classList.add('edge-locked');
    }
  }

  function openPanel(tab, trigger, hover) {
    closeSearch();
    clearTimeout(closeTimer);
    lastTrigger = trigger || lastTrigger || plus;
    const wasOpen = isOpen;
    isOpen = true;
    if (!wasOpen) pinned = !hover;
    panel.hidden = false;
    scrim.hidden = false;
    if (!wasOpen) {
      panel.classList.add('is-entering');
      scrim.classList.add('is-entering');
      void panel.offsetWidth;
      // setTimeout, not requestAnimationFrame: rAF is paused in background tabs and would leave the panel off screen
      setTimeout(() => {
        panel.classList.remove('is-entering');
        scrim.classList.remove('is-entering');
      }, 20);
    }
    if (pinned) document.documentElement.classList.add('edge-locked');
    setTab(tab);
    if (!wasOpen && !hover) {
      const pane = $('[data-edge-pane]:not([hidden])', panel);
      const first = pane && pane.querySelector('a[href], button:not([disabled]), input');
      (first || panel).focus({ preventScroll: true });
    }
  }

  function closePanel(restoreFocus) {
    if (!isOpen) return;
    isOpen = false;
    pinned = false;
    panel.classList.add('is-entering');
    scrim.classList.add('is-entering');
    document.documentElement.classList.remove('edge-locked');
    syncTriggers();
    clearTimeout(closeTimer);
    closeTimer = setTimeout(
      () => {
        if (isOpen) return;
        panel.hidden = true;
        scrim.hidden = true;
        panel.classList.remove('is-entering');
        scrim.classList.remove('is-entering');
      },
      reduceMotion ? 0 : 220
    );
    syncCartVisibility();
    if (restoreFocus !== false) (lastTrigger || plus).focus();
  }

  function focusables() {
    const sel = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';
    return $$(sel, panel).filter((el) => !el.closest('[hidden]') && el.tabIndex >= 0).concat([plus]);
  }

  /* ---------- search ---------- */
  function setSearchLabel(open) {
    const l = $('[data-edge-search-label]');
    if (l) l.textContent = 'Search';
    const b = $('[data-edge-search]');
    if (b) b.setAttribute('aria-expanded', open);
  }
  function openSearch(trigger) {
    if (isOpen) {
      isOpen = false;
      panel.hidden = true;
      scrim.hidden = true;
      document.documentElement.classList.remove('edge-locked');
      syncTriggers();
    }
    lastTrigger = trigger;
    const sb = $('[data-edge-search]');
    if (sb) {
      const r = sb.getBoundingClientRect();
      bar.style.setProperty('--edge-win-top', Math.max(0, Math.round(r.top + r.height / 2 - 28)) + 'px');
    }
    bar.hidden = false;
    setSearchLabel(true);
    input.focus();
    renderResults(null);
  }
  function closeSearch() {
    if (bar.hidden) return;
    bar.hidden = true;
    setSearchLabel(false);
    results.innerHTML = '';
    input.value = '';
  }

  let sTimer = 0;
  let sSeq = 0;
  function renderResults(products) {
    if (products === null) {
      results.innerHTML = '';
    } else if (!products.length) {
      results.innerHTML = '<p class="edge-empty">&lt;No match&gt;</p>';
    } else {
      const cur = (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || 'CAD';
      results.innerHTML = products
        .map(
          (p) =>
            '<a class="edge-row edge-res" href="' + esc(p.url) + '"><span class="edge-res__img">' +
            (p.image ? '<img src="' + esc(p.image) + '" alt="" loading="lazy">' : '') + '</span><span class="edge-res__txt">' +
            (p.vendor ? '<span class="edge-res__v">' + esc(p.vendor) + '</span>' : '') +
            '<span class="edge-res__n">' + esc(p.title) + '</span></span><span class="edge-res__p">' +
            esc(money(parseFloat(p.price) * 100, cur)) + '</span></a>'
        )
        .join('');
    }
  }
  input.addEventListener('input', () => {
    clearTimeout(sTimer);
    const q = input.value.trim();
    if (!q) return renderResults(null);
    sTimer = setTimeout(async () => {
      const seq = ++sSeq;
      try {
        const res = await fetch(
          '/search/suggest.json?q=' + encodeURIComponent(q) +
            '&resources[type]=product&resources[limit]=6&resources[options][unavailable_products]=last',
          { headers: { Accept: 'application/json' } }
        );
        const data = await res.json();
        if (seq !== sSeq) return;
        renderResults((data.resources && data.resources.results && data.resources.results.products) || []);
      } catch (_) {
        if (seq === sSeq) renderResults([]);
      }
    }, 200);
  });

  /* ---------- cart ---------- */
  async function refreshCart() {
    try {
      const res = await fetch('/cart.js', { headers: { Accept: 'application/json' } });
      cart = await res.json();
    } catch (_) {
      return;
    }
    setCount('cart', cart.item_count);
    renderCart();
  }

  function lineRef(sku, variantTitle) {
    const parts = [];
    if (sku) parts.push('&lt;' + esc(sku) + '&gt;');
    if (variantTitle && !/default title/i.test(variantTitle)) parts.push('Size ' + esc(variantTitle));
    return parts.join(' · ');
  }

  function lineHTML(o, list, idx, moveLabel) {
    return (
      '<div class="edge-line"><a class="edge-line__img" href="' + esc(o.url) + '" tabindex="-1" aria-hidden="true">' +
      (o.image ? '<img src="' + esc(o.image) + '" alt="" loading="lazy">' : '') + '</a><div class="edge-line__txt">' +
      '<a class="edge-line__name" href="' + esc(o.url) + '">' + esc(o.title) + '</a>' +
      '<div class="edge-line__ref">' + o.ref + '</div>' +
      '<div class="edge-line__price">' + esc(o.price) + '</div>' +
      '<div class="edge-line__act"><button type="button" data-edge-act="move" data-list="' + list + '" data-idx="' + idx + '">' + moveLabel +
      '</button><button type="button" data-edge-act="remove" data-list="' + list + '" data-idx="' + idx + '">Remove</button></div></div></div>'
    );
  }

  function renderCart() {
    const host = $('[data-edge-list="cart"]');
    if (!host || !cart) return;
    if (!cart.items.length) {
      host.innerHTML = tryItems().length ? '' : '<div class="edge-body"><p class="edge-empty">Your cart is empty.</p></div>';
      return;
    }
    host.innerHTML = '<div class="edge-body">' +
      cart.items
        .map((i, n) =>
          lineHTML(
            {
              url: i.url, image: i.image, title: i.product_title,
              ref: lineRef(i.sku, i.variant_title) + (i.quantity > 1 ? ' · ×' + i.quantity : ''),
              price: money(i.final_line_price, cart.currency),
            },
            'cart', n, 'Move to try-on'
          )
        )
        .join('') +
      '<div class="edge-ledger"><span>Subtotal</span><span>&lt;' + esc(money(cart.items_subtotal_price, cart.currency)) + ' ' + esc(cart.currency) + '&gt;</span></div>' +
      '<div class="edge-foot"><a class="edge-pill edge-pill--primary" href="/checkout">Checkout</a></div></div>';
  }

  function renderTry() {
    const host = $('[data-edge-list="try"]');
    if (!host) return;
    const items = tryItems();
    setCount('try', items.length);
    const sec = $('[data-edge-try-sec]');
    if (sec) sec.hidden = !items.length;
    if (cart) renderCart();
    if (!items.length) {
      host.innerHTML = '';
      return;
    }
    host.innerHTML = '<div class="edge-body">' +
      items
        .map((i, n) =>
          lineHTML(
            { url: i.url, image: i.image, title: [i.vendor, i.title].filter(Boolean).join(' '), ref: lineRef(i.sku, i.variantTitle), price: i.price },
            'try', n, 'Move to cart'
          )
        )
        .join('') +
      '<div class="edge-foot"><a class="edge-pill edge-pill--secondary" href="/pages/book">Book a fitting</a></div></div>';
  }

  async function cartChange(line, qty) {
    const res = await fetch('/cart/change.js', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ line: line, quantity: qty }),
    });
    cart = await res.json();
    setCount('cart', cart.item_count);
    renderCart();
  }

  async function onAction(btn) {
    const list = btn.dataset.list;
    const idx = Number(btn.dataset.idx);
    const act = btn.dataset.edgeAct;
    if (list === 'cart') {
      const item = cart && cart.items[idx];
      if (!item) return;
      if (act === 'move') {
        const s = tryStore();
        if (s && !s.has(item.variant_id)) {
          s.add({
            variantId: item.variant_id, productId: item.product_id, title: item.product_title,
            variantTitle: /default title/i.test(item.variant_title || '') ? '' : item.variant_title || '',
            vendor: item.vendor, price: money(item.price, cart.currency), image: item.image || '',
            url: item.url, sku: item.sku || '',
          });
        }
      }
      await cartChange(idx + 1, 0);
    } else {
      const s = tryStore();
      const item = tryItems()[idx];
      if (!s || !item) return;
      if (act === 'move') {
        const res = await fetch('/cart/add.js', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ items: [{ id: item.variantId, quantity: 1 }] }),
        });
        if (!res.ok) {
          const host = $('[data-edge-list="try"]');
          host.insertAdjacentHTML('afterbegin', '<p class="edge-empty" role="alert">&lt;Sold out&gt; This piece can\'t be added to the cart.</p>');
          return;
        }
        s.remove(item.variantId);
        refreshCart();
      } else {
        s.remove(item.variantId);
      }
      renderTry();
    }
  }

  /* ---------- filter (swap the grid, keep the URL in sync) ---------- */
  function openGroupIndex() {
    return $$('[data-edge-group]').findIndex((g) => !$('.edge-group__list', g).hidden);
  }
  function setGroup(i) {
    $$('[data-edge-group]').forEach((g, n) => {
      const on = n === i;
      $('.edge-group__list', g).hidden = !on;
      $('[data-edge-group-toggle]', g).setAttribute('aria-expanded', on);
      $('.edge-group__s', g).textContent = on ? '−' : '+';
    });
  }
  function ensureGroupOpen() {
    if (openGroupIndex() < 0) setGroup(0);
  }

  let swapSeq = 0;
  async function applyUrl(url, push) {
    const seq = ++swapSeq;
    const gi = openGroupIndex();
    const active = document.activeElement;
    let focusPath = null;
    if (active && active.classList.contains('edge-opt')) {
      const g = active.closest('[data-edge-group]');
      focusPath = [$$('[data-edge-group]').indexOf(g), $$('.edge-opt', g).indexOf(active)];
    }
    document.documentElement.classList.add('edge-busy');
    try {
      const res = await fetch(url, { headers: { Accept: 'text/html' } });
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      if (seq !== swapSeq) return;
      [['#results', '#results'], ['[data-edge-filters]', '[data-edge-filters]'], ['.edge-strip__inner', '.edge-strip__inner'], ['#edge-tab-filter', '#edge-tab-filter']].forEach(
        ([from, to]) => {
          const a = $(from, doc);
          const b = $(to);
          if (a && b) b.innerHTML = a.innerHTML;
        }
      );
      if (push !== false) history.pushState({ edge: true }, '', url);
      syncLocalSwitch();
      setGroup(gi < 0 ? 0 : gi);
      if (focusPath && focusPath[0] > -1) {
        const g = $$('[data-edge-group]')[focusPath[0]];
        const el = g && $$('.edge-opt', g)[focusPath[1]];
        if (el) el.focus();
      }
      const live = $('#screenreader-announce');
      const n = $('[data-edge-foot="filter"] .edge-pill');
      if (live && n) live.textContent = n.textContent;
    } catch (_) {
      window.location.href = url;
    } finally {
      document.documentElement.classList.remove('edge-busy');
    }
  }
  window.addEventListener('popstate', () => {
    if ($('[data-edge-filters]')) applyUrl(location.href, false);
  });

  /* Hide sold out without the Availability filter: hide sold-out cards on the page */
  const SOLD_KEY = 'commune_hide_sold_out';
  function toggleLocalSwitch(btn) {
    const on = btn.getAttribute('aria-checked') !== 'true';
    btn.setAttribute('aria-checked', on);
    document.documentElement.classList.toggle('edge-hide-soldout', on);
    try { localStorage.setItem(SOLD_KEY, on ? '1' : '0'); } catch (_) {}
  }
  function syncLocalSwitch() {
    const btn = $('[data-edge-switch-local]');
    if (btn) btn.setAttribute('aria-checked', document.documentElement.classList.contains('edge-hide-soldout'));
  }
  function restoreLocalSwitch() {
    const btn = $('[data-edge-switch-local]');
    let on = false;
    try { on = localStorage.getItem(SOLD_KEY) === '1'; } catch (_) {}
    if (btn && on) toggleLocalSwitch(btn);
  }

  /* ---------- events ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target;
    const open = t.closest('[data-edge-open]');
    if (open) {
      // no x button any more: the open button closes the panel again
      if (isOpen && pinned && panel.dataset.tab === open.dataset.edgeOpen) return closePanel();
      pin();
      return openPanel(open.dataset.edgeOpen, open);
    }
    if (t.closest('[data-edge-search]')) return openSearch(t.closest('[data-edge-search]'));
    if (t.closest('[data-edge-search-close]')) {
      closeSearch();
      return lastTrigger && lastTrigger.focus();
    }
    if (t.closest('[data-edge-scrim]') || t.closest('[data-edge-close]')) return closePanel();
    const gt = t.closest('[data-edge-group-toggle]');
    if (gt) {
      const i = $$('[data-edge-group]').indexOf(gt.closest('[data-edge-group]'));
      return setGroup(i === openGroupIndex() ? -1 : i);
    }
    const opt = t.closest('.edge-opt');
    if (opt) return applyUrl(opt.dataset.edgeUrl);
    const clear = t.closest('[data-edge-clear]');
    if (clear) {
      e.preventDefault();
      return applyUrl(clear.href);
    }
    const local = t.closest('[data-edge-switch-local]');
    if (local) return toggleLocalSwitch(local);
    const sw = t.closest('[data-edge-switch]');
    if (sw) return applyUrl(sw.getAttribute('aria-checked') === 'true' ? sw.dataset.urlRemove : sw.dataset.urlAdd);
    const act = t.closest('[data-edge-act]');
    if (act) return onAction(act);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!bar.hidden) {
        closeSearch();
        if (lastTrigger) lastTrigger.focus();
      } else if (isOpen) closePanel();
      return;
    }
    if (e.key === 'Tab' && isOpen) {
      const f = focusables();
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* PDP: Add to cart opens the Cart tab, Try in-store opens the Try-on tab */
  document.body.addEventListener('baseline:cart:afteradditem', () => {
    refreshCart().then(() => openPanel('cart', $('[data-edge-open="cart"]') || plus));
  });
  window.addEventListener('open-try-on', () => openPanel('cart', $('[data-edge-open="cart"]') || plus));
  window.addEventListener('storage', renderTry);

  /* ---------- hover to open (desktop) ---------- */
  const rail = $('[data-edge-rail]');
  const hoverMQ = window.matchMedia('(hover: hover) and (min-width: 768px)');
  let overRail = false;
  let overPanel = false;
  let leaveTimer = 0;
  const hoverEnabled = () => rail && rail.dataset.hover !== 'false' && hoverMQ.matches && bar.hidden;
  function scheduleLeave() {
    if (pinned || !isOpen) return;
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (!overRail && !overPanel && !pinned) closePanel(false);
    }, 250);
  }
  if (rail) {
    rail.addEventListener('mouseover', (e) => {
      if (!hoverEnabled()) return;
      overRail = true;
      clearTimeout(leaveTimer);
      if (e.target.closest('[data-edge-search]')) return;
      const o = e.target.closest('[data-edge-open]');
      const tab = o ? o.dataset.edgeOpen : 'menu';
      if (isOpen && (pinned || panel.dataset.tab === tab)) return;
      openPanel(tab, o || plus, true);
    });
    rail.addEventListener('mouseleave', () => {
      overRail = false;
      scheduleLeave();
    });
  }
  panel.addEventListener('mouseenter', () => {
    overPanel = true;
    clearTimeout(leaveTimer);
  });
  panel.addEventListener('mouseleave', () => {
    overPanel = false;
    scheduleLeave();
  });
  panel.addEventListener('pointerdown', pin);
  panel.addEventListener('focusin', (e) => {
    if (e.target.matches('input')) pin();
  });

  /* after a newsletter sign-up the page reloads with ?customer_posted=true: show the result */
  if (/customer_posted=true/.test(location.search) && $('[data-edge-news-ok]')) openPanel('menu', plus);

  window.addEventListener('resize', () => {
    if (isOpen) positionWindow(panel.dataset.tab);
  });

  /* ---------- init ---------- */
  restoreLocalSwitch();
  setCount('try', tryItems().length);
  fetch('/cart.js', { headers: { Accept: 'application/json' } })
    .then((r) => r.json())
    .then((c) => { cart = c; setCount('cart', c.item_count); })
    .catch(() => {});

  document.addEventListener('alpine:initialized', () => {
    const s = tryStore();
    if (s && window.Alpine.effect) {
      window.Alpine.effect(() => {
        s.items.map((i) => i.variantId);
        renderTry();
      });
    } else renderTry();
  });
})();
