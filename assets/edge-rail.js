/* v3 vellum */
/**
 * Commune edge rail: tools panel (Menu / Cart / Try-on). The filter, search and sold-out switch live in plp-filter.js.
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
  const plus = $('[data-edge-open="menu"]') || $('[data-edge-open="cart"]');
  const WINDOW_LABELS = { menu: 'Menu', cart: 'Cart' };

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
  // Size the join between the rail label and its window (CSS ::before on the window)
  function positionJoin(el, btn) {
    if (!el || !btn) return;
    const b = btn.getBoundingClientRect();
    const p = el.getBoundingClientRect();
    const top = Math.max(0, b.top - p.top);
    const bottom = Math.min(p.height, b.bottom - p.top);
    el.style.setProperty('--edge-join-top', Math.round(top) + 'px');
    el.style.setProperty('--edge-join-h', Math.max(0, Math.round(bottom - top)) + 'px');
  }
  function syncJoin() {
    if (isOpen) positionJoin(panel, $('[data-edge-rail] [data-edge-open="' + panel.dataset.tab + '"]'));
  }

  function setTab(tab) {
    const names = $$('[data-edge-pane]', panel).map((p) => p.dataset.edgePane);
    if (names.indexOf(tab) < 0) tab = names[0] || 'menu';
    panel.dataset.tab = tab;
    panel.setAttribute('aria-label', WINDOW_LABELS[tab] || 'Tools');
    $$('[data-edge-pane]', panel).forEach((p) => (p.hidden = p.dataset.edgePane !== tab));
    if (tab === 'cart') {
      refreshCart();
      renderTry();
    }
    syncTriggers();
    syncJoin();
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
      panel.focus({ preventScroll: true });
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
      '<a class="edge-line__name" href="' + esc(o.url) + '">' + (o.vendor ? '<span class="edge-line__vendor">' + esc(o.vendor) + '</span>' : '') +
      '<span class="edge-line__title">' + esc(o.title) + '</span></a>' +
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
      host.innerHTML = tryItems().length ? '' : '<h3 class="edge-sec__h">Cart [0]</h3><div class="edge-body"><p class="edge-empty">Your cart is empty.</p></div>';
      return;
    }
    host.innerHTML = '<h3 class="edge-sec__h">Cart [' + cart.item_count + ']</h3><div class="edge-body">' +
      cart.items
        .map((i, n) =>
          lineHTML(
            {
              url: i.url, image: i.image, vendor: i.vendor, title: i.product_title,
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

  // "Book a fitting" goes straight to the Calendly page. The answer to the second question lists the pieces as "Brand Title (Size)".
  const CAL_BASE = 'https://calendly.com/commune237/showroomappointment';
  function calendlyUrl(items) {
    const params = new URLSearchParams();
    const pieces = items
      .map((i) => [i.vendor, i.title].filter(Boolean).join(' ') + (i.variantTitle && !/default title/i.test(i.variantTitle) ? ' (' + i.variantTitle + ')' : ''))
      .join(', ');
    if (pieces) params.set('a2', pieces);
    const rail = document.querySelector('[data-edge-rail]');
    if (rail && rail.dataset.customerEmail) {
      if (rail.dataset.customerName) params.set('name', rail.dataset.customerName);
      params.set('email', rail.dataset.customerEmail);
    }
    const q = params.toString();
    return CAL_BASE + (q ? '?' + q : '');
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
            { url: i.url, image: i.image, vendor: i.vendor, title: i.title, ref: lineRef(i.sku, i.variantTitle), price: i.price },
            'try', n, 'Move to cart'
          )
        )
        .join('') +
      '<div class="edge-foot"><a class="edge-pill edge-pill--secondary" href="' + esc(calendlyUrl(items)) + '" target="_blank" rel="noopener">Book a fitting</a></div></div>';
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
    if (t.closest('[data-edge-scrim]') || t.closest('[data-edge-close]')) return closePanel();
    const act = t.closest('[data-edge-act]');
    if (act) return onAction(act);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (isOpen) closePanel();
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
  const hoverEnabled = () => rail && rail.dataset.hover !== 'false' && hoverMQ.matches;
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
      const o = e.target.closest('[data-edge-open]');
      if (!o) return; // blank space on the rail does not open anything: only hovering a label does
      const tab = o.dataset.edgeOpen;
      if (isOpen && (pinned || panel.dataset.tab === tab)) return;
      openPanel(tab, o, true);
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

  window.addEventListener('resize', syncJoin);
  // the Cart window changes height as its lines load: keep the join on the Cart label
  if (window.ResizeObserver) new ResizeObserver(syncJoin).observe(panel);

  // the PLP gallery adds a product to the cart: show it in the Cart window
  document.addEventListener('edge:cart-added', () => {
    refreshCart().then(() => openPanel('cart', $('[data-edge-open="cart"]') || plus));
  });

  /* ---------- init ---------- */
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
