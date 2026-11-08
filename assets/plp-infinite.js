(() => {
  'use strict';

  const html = document.documentElement;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');

  const PLACEHOLDER = 'li[aria-hidden="true"][role="presentation"]';
  const PRODUCT_LINK = 'a[href*="/products/"]';

  // The settings live on a marker element that is re-rendered with the section, so read them fresh
  const config = () => document.getElementById('plp-config');
  const isInfinite = () => !!config() && config().dataset.infinite === 'true';
  const wantsTop = () => !!config() && config().dataset.top === 'true';

  // One saved position per listing (collection + filters + sort), not per page.
  const stateKey = () => {
    const u = new URL(location.href);
    u.searchParams.delete('page');
    return 'plp-state:' + u.pathname + u.search;
  };
  const read = () => {
    try {
      const fromSession = JSON.parse(sessionStorage.getItem(stateKey()));
      if (fromSession) return fromSession;
    } catch (e) { /* storage blocked */ }
    // Fallback: the history entry itself remembers it, which also works in in-app browsers
    return (history.state && history.state.plpState) || null;
  };
  // The history entry is only updated at moments that matter (click, leaving the page): browsers rate-limit replaceState
  const write = (patch, toHistory = false) => {
    const next = Object.assign(read() || {}, patch);
    try { sessionStorage.setItem(stateKey(), JSON.stringify(next)); } catch (e) { /* private mode */ }
    if (toHistory) {
      try { history.replaceState(Object.assign({}, history.state, { plpState: next }), ''); } catch (e) { /* not allowed here */ }
    }
  };

  const startPage = () => parseInt(new URLSearchParams(location.search).get('page'), 10) || 1;
  const productPath = (a) => a.getAttribute('href').split('?')[0];

  const isBackForward = () => {
    const nav = performance.getEntriesByType('navigation')[0];
    return !!nav && nav.type === 'back_forward';
  };

  // Keep Shopify's preview parameters on our fetches, so pages come from the theme being previewed or edited
  const PREVIEW_PARAMS = ['preview_theme_id', '_fd', 'pb', '_ab', '_bt'];
  function withPreview(href) {
    const url = new URL(href, location.origin);
    const current = new URLSearchParams(location.search);
    PREVIEW_PARAMS.forEach((k) => { if (current.has(k) && !url.searchParams.has(k)) url.searchParams.set(k, current.get(k)); });
    return url.pathname + url.search;
  }

  // We restore the position ourselves, because the extra pages are not in the HTML the browser reloads
  if (isInfinite() && 'scrollRestoration' in history) history.scrollRestoration = 'manual';

  const grid = () => document.querySelector('#results ul.collection-list');
  const pagination = () => document.querySelector('#results [data-plp-pagination]');
  const nextHrefIn = (root) => {
    const a = root.querySelector('#results [data-plp-pagination] a[rel="next"]');
    return a ? a.getAttribute('href') : null;
  };

  async function fetchPage(href) {
    const res = await fetch(withPreview(href), { credentials: 'same-origin' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return new DOMParser().parseFromString(await res.text(), 'text/html');
  }

  function append(target, doc) {
    const incoming = doc.querySelector('#results ul.collection-list');
    if (!incoming) return;
    // The trailing filler cells only belong at the very end, so replace them each time
    target.querySelectorAll(':scope > ' + PLACEHOLDER).forEach((li) => li.remove());
    const seen = new Set([...target.querySelectorAll(PRODUCT_LINK)].map(productPath));
    const frag = document.createDocumentFragment();
    for (const li of incoming.children) {
      const link = li.querySelector(PRODUCT_LINK);
      if (link && !li.matches(PLACEHOLDER)) {
        const path = productPath(link);
        if (seen.has(path)) continue;
        seen.add(path);
      }
      frag.appendChild(document.importNode(li, true));
    }
    target.appendChild(frag);
  }

  // ---- Infinite scroll -------------------------------------------------------------------------

  let restoredOnce = false;
  const feed = { grid: null, next: null, last: 1, loading: false, observer: null, sentinel: null, status: null };

  async function loadNext() {
    if (feed.loading || !feed.next || !feed.grid || !feed.grid.isConnected) return;
    feed.loading = true;
    feed.status.hidden = false;
    try {
      const href = feed.next;
      const doc = await fetchPage(href);
      append(feed.grid, doc);
      feed.last = parseInt(new URL(href, location.origin).searchParams.get('page'), 10) || feed.last + 1;
      feed.next = nextHrefIn(doc);
      write({ lastPage: feed.last });
    } catch (e) {
      /* leave feed.next as it is, so scrolling again retries */
    } finally {
      feed.loading = false;
      feed.status.hidden = true;
    }
    if (!feed.next) { stopFeed(); return; }
    // If the sentinel is still on screen (short pages), observe it again to trigger the next load
    feed.observer.unobserve(feed.sentinel);
    feed.observer.observe(feed.sentinel);
  }

  function stopFeed() {
    if (feed.observer) feed.observer.disconnect();
    if (feed.sentinel) feed.sentinel.remove();
    if (feed.status) feed.status.remove();
    feed.observer = feed.sentinel = feed.status = null;
  }

  async function restore(saved) {
    const first = feed.next;
    if (!first || !saved.lastPage || saved.lastPage <= feed.last) return;
    const pages = [];
    for (let p = feed.last + 1; p <= saved.lastPage; p++) {
      const url = new URL(first, location.origin);
      url.searchParams.set('page', p);
      pages.push(url.pathname + url.search);
    }
    // Two requests at a time, each retried once, so a slow connection or rate limit does not drop pages
    const fetchWithRetry = (u) => fetchPage(u).catch(() => new Promise((r) => setTimeout(r, 400)).then(() => fetchPage(u))).catch(() => null);
    const docs = new Array(pages.length).fill(null);
    let cursor = 0;
    const worker = async () => {
      while (cursor < pages.length) {
        const i = cursor++;
        docs[i] = await fetchWithRetry(pages[i]);
      }
    };
    await Promise.all([worker(), worker()]);
    for (let i = 0; i < docs.length; i++) {
      if (!docs[i]) break; // stop at the first missing page so the list never has a hole
      append(feed.grid, docs[i]);
      feed.last = feed.last + 1;
      feed.next = nextHrefIn(docs[i]);
    }
  }

  function scrollToSaved(saved) {
    const target = saved.anchor && [...feed.grid.querySelectorAll(PRODUCT_LINK)].find((a) => productPath(a) === saved.anchor.href);
    const li = target && target.closest('li');
    if (li) {
      window.scrollTo(0, li.getBoundingClientRect().top + scrollY - saved.anchor.top);
    } else if (typeof saved.y === 'number') {
      window.scrollTo(0, saved.y);
    }
  }

  async function setupFeed() {
    const g = grid();
    const pager = pagination();

    // Turned off in the settings (or the section was swapped): put things back as they were
    if (!isInfinite()) {
      if (feed.grid) { stopFeed(); feed.grid = null; }
      if (pager) pager.style.display = '';
      return;
    }
    if (!g || !pager || g === feed.grid) return;
    stopFeed();

    feed.grid = g;
    feed.last = startPage();
    feed.next = nextHrefIn(document);
    feed.loading = false;

    // Page numbers stay in the HTML for crawlers and no-JS visitors, but are hidden here
    pager.style.display = 'none';

    feed.status = document.createElement('p');
    feed.status.className = 'plp-status';
    feed.status.textContent = 'Loading';
    feed.status.hidden = true;
    feed.status.setAttribute('role', 'status');
    feed.sentinel = document.createElement('div');
    feed.sentinel.setAttribute('aria-hidden', 'true');
    g.after(feed.sentinel);
    feed.sentinel.after(feed.status);

    feed.observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) loadNext();
    }, { rootMargin: '1200px 0px' });

    // Only on the first build after the page loads: the theme editor re-renders the section later on,
    // and that must not jump the preview back to an old position
    const saved = !restoredOnce && isBackForward() ? read() : null;
    restoredOnce = true;
    if (saved && saved.lastPage > feed.last) {
      try {
        await restore(saved);
      } catch (e) { /* fall back to the first page */ }
    }
    if (saved) {
      scrollToSaved(saved);
      // Images above the anchor can still change the layout, so settle once more unless the visitor has scrolled
      let moved = false;
      const mark = () => { moved = true; };
      ['wheel', 'touchstart', 'keydown'].forEach((t) => addEventListener(t, mark, { once: true, passive: true }));
      const settle = () => { if (!moved) scrollToSaved(saved); };
      if (document.readyState === 'complete') setTimeout(settle, 300);
      else addEventListener('load', () => setTimeout(settle, 150), { once: true });
      setTimeout(settle, 900);
    }
    html.classList.remove('plp-restoring');

    if (feed.observer && feed.next) feed.observer.observe(feed.sentinel);
    else stopFeed();
  }

  // ---- Remember what was clicked, so Back lands on the same product ----------------------------

  let saveTimer;
  const saveScroll = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => write({ y: Math.round(scrollY), lastPage: feed.last || startPage() }), 150);
  };

  document.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('#results ' + PRODUCT_LINK);
    if (!link) return;
    const li = link.closest('li');
    write({
      anchor: { href: productPath(link), top: Math.round(li ? li.getBoundingClientRect().top : 0) },
      y: Math.round(scrollY),
      lastPage: feed.last || startPage(),
    }, true);
  }, true);

  addEventListener('pagehide', () => write({ y: Math.round(scrollY), lastPage: feed.last || startPage() }, true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') write({ y: Math.round(scrollY), lastPage: feed.last || startPage() }, true);
  });
  addEventListener('pageshow', (e) => {
    if (!e.persisted || !feed.grid) return;
    const saved = read();
    if (saved && scrollY < 50 && typeof saved.y === 'number' && saved.y > 200) scrollToSaved(saved);
  });

  // ---- Back to top ------------------------------------------------------------------------------

  let topButton = null;
  const updateTop = () => {
    if (topButton && topButton.isConnected) topButton.classList.toggle('is-visible', scrollY > innerHeight * 1.2);
  };

  function setupTop() {
    if (!wantsTop()) {
      if (topButton) { topButton.remove(); topButton = null; }
      return;
    }
    if (topButton && topButton.isConnected) return;
    const host = document.getElementById('filterable') || document.body;
    topButton = document.createElement('button');
    topButton.type = 'button';
    topButton.className = 'plp-top';
    topButton.setAttribute('aria-label', 'Back to top');
    topButton.innerHTML = '<span aria-hidden="true">&uarr;</span>';
    topButton.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: REDUCED.matches ? 'auto' : 'smooth' });
    });
    host.appendChild(topButton);
    updateTop();
  }

  addEventListener('scroll', () => { updateTop(); saveScroll(); }, { passive: true });

  // ---- Boot, and re-boot when filters, sorting or the theme editor replace the results ---------

  function boot() {
    setupTop();
    setupFeed();
  }

  let watcher = null;
  function watch() {
    if (watcher) watcher.disconnect();
    const results = document.getElementById('results');
    if (!results) return;
    // Filtering and sorting swap the contents of #results, which drops our sentinel and grid reference
    watcher = new MutationObserver(() => {
      if (feed.grid && !feed.grid.isConnected) { stopFeed(); feed.grid = null; }
      boot();
    });
    watcher.observe(results.parentElement || results, { childList: true, subtree: true });
  }

  function init() {
    if (!config()) return;
    boot();
    watch();
  }

  init();

  // The theme editor re-renders the whole section when a setting changes
  document.addEventListener('shopify:section:load', () => { stopFeed(); feed.grid = null; topButton = null; init(); });
  document.addEventListener('shopify:section:unload', () => { stopFeed(); feed.grid = null; if (watcher) watcher.disconnect(); });
})();
