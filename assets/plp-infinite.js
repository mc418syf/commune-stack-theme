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

  // Pages already fetched in this tab are kept for a few minutes (only the product list and the next link, not the whole page),
  // so coming back from a product does not download them all again
  const PAGE_TTL = 10 * 60 * 1000;
  const cacheKey = (href) => 'plp-page:v3:' + withPreview(href);
  function readCached(href) {
    try {
      const hit = JSON.parse(sessionStorage.getItem(cacheKey(href)));
      if (hit && Date.now() - hit.t < PAGE_TTL) return new DOMParser().parseFromString(hit.h, 'text/html');
    } catch (e) { /* storage blocked */ }
    return null;
  }
  function writeCached(href, doc) {
    try {
      const list = doc.querySelector('#results ul.collection-list');
      if (!list) return;
      const next = nextHrefIn(doc);
      const h = '<div id="results">' + list.outerHTML + (next ? '<div data-plp-pagination><a rel="next" href="' + next.replace(/"/g, '&quot;') + '"></a></div>' : '') + '</div>';
      sessionStorage.setItem(cacheKey(href), JSON.stringify({ t: Date.now(), h: h }));
    } catch (e) { /* storage full or blocked: just not cached */ }
  }

  async function fetchPage(href) {
    const cached = readCached(href);
    if (cached) return cached;
    const res = await fetch(withPreview(href), { credentials: 'same-origin' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    writeCached(href, doc);
    return doc;
  }

  function append(target, doc, page) {
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
      const node = document.importNode(li, true);
      if (page) node.dataset.plpPage = page;
      frag.appendChild(node);
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
      const loadedPage = parseInt(new URL(href, location.origin).searchParams.get('page'), 10) || feed.last + 1;
      append(feed.grid, doc, loadedPage);
      feed.last = loadedPage;
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
    // Five requests at a time, each retried once, so a slow connection or rate limit does not drop pages
    const fetchWithRetry = (u) => fetchPage(u).catch(() => new Promise((r) => setTimeout(r, 400)).then(() => fetchPage(u))).catch(() => null);
    const docs = new Array(pages.length).fill(null);
    let cursor = 0;
    const worker = async () => {
      while (cursor < pages.length) {
        const i = cursor++;
        docs[i] = await fetchWithRetry(pages[i]);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker(), worker()]);
    for (let i = 0; i < docs.length; i++) {
      if (!docs[i]) break; // stop at the first missing page so the list never has a hole
      append(feed.grid, docs[i], feed.last + 1);
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

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---- Instant return: remember tile heights, restore placeholders, fill in the products afterwards ----

  const realTiles = () => [...feed.grid.children].filter((li) => !li.matches(PLACEHOLDER) && !li.dataset.plpGhost);

  // The exact height of every tile, and how many came from each page
  function captureLayout() {
    if (!feed.grid) return null;
    const tiles = [...feed.grid.children].filter((li) => !li.matches(PLACEHOLDER));
    const counts = {};
    tiles.forEach((li) => { const p = li.dataset.plpPage || startPage(); counts[p] = (counts[p] || 0) + 1; });
    return {
      vw: innerWidth,
      heights: tiles.map((li) => Math.round(li.getBoundingClientRect().height * 100) / 100),
      counts,
      next: feed.next,
    };
  }

  // Placeholders with the saved heights, so the page is as tall as it was and the scroll position can be set at once
  function restoreGhosts(saved) {
    const L = saved.layout;
    if (!L || L.vw !== innerWidth || !Array.isArray(L.heights) || !L.counts) return null;
    const sample = realTiles()[0];
    if (!sample) return null;
    let index = realTiles().length;
    const pages = [];
    for (let p = feed.last + 1; p <= saved.lastPage; p++) {
      const n = L.counts[p];
      if (!n) return null;
      pages.push([p, n]);
    }
    const total = pages.reduce((sum, [, n]) => sum + n, 0);
    if (!total || index + total > L.heights.length) return null;

    feed.grid.querySelectorAll(':scope > ' + PLACEHOLDER).forEach((li) => li.remove());
    const frag = document.createDocumentFragment();
    for (const [p, n] of pages) {
      for (let i = 0; i < n; i++) {
        const ghost = document.createElement('li');
        ghost.className = sample.className + ' plp-ghost';
        ghost.dataset.plpGhost = '1';
        ghost.dataset.plpPage = p;
        ghost.setAttribute('aria-hidden', 'true');
        ghost.style.height = L.heights[index++] + 'px';
        frag.appendChild(ghost);
      }
    }
    feed.grid.appendChild(frag);
    return pages.map(([p]) => p);
  }

  // Swap each page's placeholders for the real tiles, the page nearest the clicked product first
  async function hydrateGhosts(saved, pages, userMoved) {
    const base = feed.next;
    const urlFor = (p) => {
      const u = new URL(base, location.origin);
      u.searchParams.set('page', p);
      return u.pathname + u.search;
    };
    const anchorPage = (saved.anchor && saved.anchor.page) || pages[0];
    const queue = pages.slice().sort((a, b) => Math.abs(a - anchorPage) - Math.abs(b - anchorPage));
    const fetchWithRetry = (u) => fetchPage(u).catch(() => sleep(400).then(() => fetchPage(u))).catch(() => null);
    const docs = {};

    const swap = (p, doc) => {
      const ghosts = [...feed.grid.querySelectorAll('li[data-plp-ghost="1"][data-plp-page="' + p + '"]')];
      const incoming = doc.querySelector('#results ul.collection-list');
      if (!ghosts.length || !incoming) { ghosts.forEach((g) => g.remove()); return; }
      const seen = new Set([...feed.grid.querySelectorAll(PRODUCT_LINK)].map(productPath));
      const frag = document.createDocumentFragment();
      for (const li of incoming.children) {
        if (li.matches(PLACEHOLDER)) { if (p === saved.lastPage) frag.appendChild(document.importNode(li, true)); continue; }
        const link = li.querySelector(PRODUCT_LINK);
        if (link) {
          const path = productPath(link);
          if (seen.has(path)) continue;
          seen.add(path);
        }
        const node = document.importNode(li, true);
        node.dataset.plpPage = p;
        frag.appendChild(node);
      }
      ghosts[0].before(frag);
      ghosts.forEach((g) => g.remove());
      // Same heights, so nothing should move; keep the clicked product exact if it has not been touched
      if (!userMoved() && saved.anchor) scrollToSaved(saved);
    };

    const worker = async () => {
      while (queue.length) {
        const p = queue.shift();
        const doc = await fetchWithRetry(urlFor(p));
        if (doc) { docs[p] = doc; swap(p, doc); }
        else feed.grid.querySelectorAll('li[data-plp-ghost="1"][data-plp-page="' + p + '"]').forEach((g) => g.remove());
      }
    };
    await Promise.all([worker(), worker(), worker(), worker(), worker()]);

    feed.last = saved.lastPage;
    feed.next = docs[saved.lastPage] ? nextHrefIn(docs[saved.lastPage]) : (saved.layout && saved.layout.next) || null;
  }

  // Images close to the saved spot: once they have their size, nothing above the viewport will move any more
  function imagesNearViewport() {
    const limit = innerHeight * 1.3;
    return [...feed.grid.querySelectorAll('img')].filter((img) => {
      const r = img.getBoundingClientRect();
      return r.bottom > -limit && r.top < innerHeight + limit;
    });
  }

  const imagesReady = (imgs, ms) => Promise.race([
    Promise.all(imgs.map((img) => (img.complete ? null : new Promise((done) => {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    })))),
    sleep(ms),
  ]);

  // Keeps the listing hidden until the position is final, so the page lands once instead of
  // landing and then shifting as fonts and images arrive
  async function settleLayout(saved) {
    let moved = false;
    const mark = () => { moved = true; };
    ['wheel', 'touchstart', 'keydown'].forEach((t) => addEventListener(t, mark, { once: true, passive: true }));
    // Not the whole page 'load' (that waits for every image and third-party script): the fonts, briefly, then the images by the saved spot
    if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, sleep(400)]);
    scrollToSaved(saved);
    for (let pass = 0; pass < 2 && !moved; pass++) {
      const imgs = imagesNearViewport().filter((img) => !img.complete);
      if (!imgs.length) break;
      await imagesReady(imgs, 500);
      if (moved) break;
      scrollToSaved(saved);
      await Promise.race([new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), sleep(120)]);
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
    [...g.children].forEach((li) => { if (!li.matches(PLACEHOLDER)) li.dataset.plpPage = feed.last; });
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
    let ghostPages = null;
    if (saved && saved.lastPage > feed.last) ghostPages = restoreGhosts(saved);

    if (saved && !ghostPages && saved.lastPage > feed.last) {
      // Can't rebuild instantly (window size changed, or nothing saved): fetch the pages while the listing is hidden
      try {
        await restore(saved);
      } catch (e) { /* fall back to the first page */ }
    }

    if (saved) {
      try {
        scrollToSaved(saved);
        if (!ghostPages) await settleLayout(saved);
      } catch (e) { /* show the listing wherever it ended up */ }
    }
    html.classList.remove('plp-restoring');

    if (ghostPages) {
      // Shown straight away; the products fill in behind it
      let moved = false;
      const mark = () => { moved = true; };
      ['wheel', 'touchstart', 'keydown'].forEach((t) => addEventListener(t, mark, { once: true, passive: true }));
      await hydrateGhosts(saved, ghostPages, () => moved);
    }

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
      anchor: { href: productPath(link), top: Math.round(li ? li.getBoundingClientRect().top : 0), page: li ? Number(li.dataset.plpPage) || undefined : undefined },
      y: Math.round(scrollY),
      lastPage: feed.last || startPage(),
      layout: captureLayout(),
    }, true);
  }, true);

  addEventListener('pagehide', () => write({ y: Math.round(scrollY), lastPage: feed.last || startPage(), layout: captureLayout() }, true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') write({ y: Math.round(scrollY), lastPage: feed.last || startPage(), layout: captureLayout() }, true);
  });
  // A tile swiped to its second image (phones) must not stay there when the page is shown again from the back button
  const resetTiles = () => document.querySelectorAll('.plp-snap-track').forEach((t) => {
    if (t.scrollLeft) { t.style.scrollBehavior = 'auto'; t.scrollLeft = 0; }
  });
  addEventListener('pagehide', resetTiles);
  addEventListener('pageshow', (e) => { if (e.persisted) resetTiles(); });

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
