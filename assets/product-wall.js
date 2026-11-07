(() => {
  'use strict';

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
  const FINE_POINTER = matchMedia('(hover: hover) and (pointer: fine)');
  const MAX_SPEED = 1600;

  const mod = (n, m) => ((n % m) + m) % m;
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sized = (src, w) => src + (src.includes('?') ? '&' : '?') + 'width=' + w;

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  async function loadProducts(collection) {
    const out = [];
    const seen = new Set();
    for (let page = 1; page <= 8; page++) {
      const res = await fetch(`/collections/${collection}/products.json?limit=250&page=${page}`);
      if (!res.ok) break;
      const batch = (await res.json()).products;
      for (const p of batch) {
        if (!p.images.length || seen.has(p.handle)) continue;
        seen.add(p.handle);
        out.push({
          handle: p.handle,
          title: p.title,
          vendor: p.vendor,
          price: p.variants[0].price,
          available: p.variants.some((v) => v.available),
          image: p.images[0].src,
          w: p.images[0].width,
          h: p.images[0].height,
        });
      }
      if (batch.length < 250) break;
    }
    return out;
  }

  function mount(root) {
    const cfg = root.dataset;
    const host = root.querySelector('[data-product-wall-rows]');
    const abort = new AbortController();
    const on = { signal: abort.signal };
    let frameId = 0;
    let observer;
    let resizer;

    const perRow = Math.max(4, parseInt(cfg.perRow, 10) || 28);
    const speedScale = parseFloat(cfg.speed);
    const hideSold = cfg.hideSoldOut === 'true';
    const money = new Intl.NumberFormat(document.documentElement.lang || undefined, {
      style: 'currency', currency: cfg.currency || 'USD', maximumFractionDigits: 0,
    });

    function cardHTML(p, eager) {
      const ar = p.w && p.h ? (p.w / p.h).toFixed(4) : 0.75;
      return `<a class="product-wall__card${p.available ? '' : ' is-sold'}" href="/products/${p.handle}" style="--ar:${ar}" draggable="false">
        <img class="product-wall__img" draggable="false" alt="${esc(p.title)}" width="${p.w || 300}" height="${p.h || 400}"
          ${eager ? '' : 'loading="lazy" decoding="async"'}
          src="${sized(p.image, 360)}" srcset="${sized(p.image, 360)} 1x, ${sized(p.image, 720)} 2x">
        <span class="product-wall__meta">
          <span class="product-wall__vendor">${esc(p.vendor)}</span>
          <span class="product-wall__price">${p.available ? money.format(parseFloat(p.price)) : esc(cfg.soldOutText)}</span>
          <span class="product-wall__title">${esc(p.title)}</span>
        </span>
      </a>`;
    }

    function buildRows(products) {
      const count = Math.max(4, Math.ceil(products.length / perRow));
      const buckets = Array.from({ length: count }, () => []);
      shuffle(products.slice()).forEach((p, i) => buckets[i % count].push(p));

      return buckets.filter((items) => items.length).map((items, i) => {
        const el = document.createElement('div');
        el.className = 'product-wall__row';
        el.style.setProperty('--i', i);
        el.innerHTML = `<div class="product-wall__track"><div class="product-wall__set">${items.map((p, n) => cardHTML(p, i < 4 && n < 8)).join('')}</div></div>`;
        host.appendChild(el);

        const dir = i % 2 ? 1 : -1;
        const speed = REDUCED.matches ? 0 : 16 + ((i * 37) % 6) * 7;
        return {
          el, dir,
          track: el.firstChild,
          set: el.querySelector('.product-wall__set'),
          base: dir * speed,
          gain: dir * (0.55 + ((i * 53) % 5) * 0.2),
          depth: 0.4 + ((i * 29) % 7) / 7,
          o: Math.random() * 4000,
          v: dir * speed,
          px: 0, ptx: 0, snap: 0, w: 0,
          hover: false, dragging: false, moved: false, focused: false, visible: true,
        };
      });
    }

    function run(products) {
      const rows = buildRows(products);
      const state = { nx: 0.5, lastX: null, lastY: null, scrollY: scrollY };

      function measure() {
        for (const r of rows) {
          r.w = r.set.getBoundingClientRect().width;
          if (!r.w) continue;
          const want = Math.max(2, Math.ceil(innerWidth / r.w) + 1);
          while (r.track.children.length < want) {
            const copy = r.set.cloneNode(true);
            copy.setAttribute('aria-hidden', 'true');
            copy.querySelectorAll('a').forEach((a) => (a.tabIndex = -1));
            r.track.appendChild(copy);
          }
        }
      }
      measure();
      resizer = new ResizeObserver(measure);
      resizer.observe(root);

      observer = new IntersectionObserver((entries) => {
        for (const e of entries) rows.find((r) => r.el === e.target).visible = e.isIntersecting;
      }, { rootMargin: '120px 0px' });
      rows.forEach((r) => observer.observe(r.el));

      // Pointer: every row reacts a little differently, so the wall shuffles.
      addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse') return;
        state.nx = e.clientX / innerWidth;
        if (state.lastX !== null && !REDUCED.matches) {
          const dx = e.clientX - state.lastX;
          const dy = e.clientY - state.lastY;
          for (const r of rows) {
            if (r.dragging) continue;
            r.v = clamp(r.v + dx * 3.2 * r.gain + Math.abs(dy) * 0.8 * r.dir, -MAX_SPEED, MAX_SPEED);
          }
        }
        state.lastX = e.clientX;
        state.lastY = e.clientY;
      }, { passive: true, signal: abort.signal });

      // Page scroll gives each row a push in its own direction.
      addEventListener('scroll', () => {
        const dy = scrollY - state.scrollY;
        state.scrollY = scrollY;
        if (REDUCED.matches) return;
        for (const r of rows) r.v = clamp(r.v + dy * 3 * r.dir, -MAX_SPEED, MAX_SPEED);
      }, { passive: true, signal: abort.signal });

      for (const r of rows) {
        r.el.addEventListener('mouseenter', () => (r.hover = true), on);
        r.el.addEventListener('mouseleave', () => (r.hover = false), on);

        r.el.addEventListener('focusin', (e) => {
          r.focused = true;
          const card = e.target.closest('.product-wall__card');
          if (!card) return;
          const b = card.getBoundingClientRect();
          if (b.left < 0 || b.right > innerWidth) r.snap = innerWidth / 2 - (b.left + b.width / 2);
        }, on);
        r.el.addEventListener('focusout', () => (r.focused = false), on);

        r.el.addEventListener('wheel', (e) => {
          const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
          if (Math.abs(dx) <= Math.abs(e.deltaY) && !(e.shiftKey && e.deltaY)) return;
          e.preventDefault();
          r.o -= dx;
        }, { passive: false, signal: abort.signal });

        // Drag / swipe along a row; vertical gestures stay native (touch-action: pan-y).
        let sx = 0, sy = 0, lx = 0, lt = 0, id = null, armed = false, vel = 0;

        r.el.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return;
          id = e.pointerId;
          sx = lx = e.clientX; sy = e.clientY; lt = e.timeStamp;
          armed = true; vel = 0; r.moved = false;
        }, on);

        addEventListener('pointermove', (e) => {
          if (e.pointerId !== id || !armed) return;
          const dx = e.clientX - sx, dy = e.clientY - sy;
          if (!r.dragging) {
            if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
            r.dragging = true; r.moved = true;
            r.el.classList.add('is-dragging');
          }
          const step = e.clientX - lx;
          const dt = Math.max(1, e.timeStamp - lt);
          r.o += step;
          vel = vel * 0.6 + (step / dt * 1000) * 0.4;
          lx = e.clientX; lt = e.timeStamp;
        }, { passive: true, signal: abort.signal });

        const release = (e) => {
          if (e.pointerId !== id) return;
          id = null; armed = false;
          if (r.dragging) {
            r.dragging = false;
            r.el.classList.remove('is-dragging');
            r.v = clamp(vel, -MAX_SPEED, MAX_SPEED);
          }
        };
        addEventListener('pointerup', release, on);
        addEventListener('pointercancel', release, on);

        // A drag must not become a click on the card underneath.
        r.el.addEventListener('click', (e) => {
          if (r.moved) { e.preventDefault(); e.stopPropagation(); r.moved = false; }
        }, { capture: true, signal: abort.signal });
      }

      let last = performance.now();
      function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const ease = 1 - Math.exp(-dt * 1.6);
        const pEase = 1 - Math.exp(-dt * 5);
        const sEase = 1 - Math.exp(-dt * 8);

        for (const r of rows) {
          if (!r.dragging) {
            const target = r.base * speedScale * (r.hover || r.focused ? 0.12 : 1);
            r.v += (target - r.v) * ease;
            r.o += r.v * dt;
          }
          if (r.snap) {
            const s = r.snap * sEase;
            r.o += s; r.snap -= s;
            if (Math.abs(r.snap) < 0.5) r.snap = 0;
          }
          if (FINE_POINTER.matches && !REDUCED.matches) r.ptx = (state.nx - 0.5) * -180 * r.depth * r.dir;
          r.px += (r.ptx - r.px) * pEase;

          if (!r.visible || !r.w) continue;
          const x = mod(r.o + r.px, r.w) - r.w;
          r.track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
        }
        frameId = requestAnimationFrame(frame);
      }
      frameId = requestAnimationFrame(frame);

      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-ready')));
    }

    loadProducts(cfg.collection)
      .then((list) => run(hideSold ? list.filter((p) => p.available) : list))
      .catch(() => {});

    return () => {
      abort.abort();
      cancelAnimationFrame(frameId);
      if (observer) observer.disconnect();
      if (resizer) resizer.disconnect();
    };
  }

  // One teardown per section instance, so the theme editor can reload a section cleanly.
  const mounted = new WeakMap();
  function mountAll(scope) {
    scope.querySelectorAll('[data-product-wall]').forEach((el) => {
      if (!mounted.has(el)) mounted.set(el, mount(el));
    });
  }
  function unmountAll(scope) {
    scope.querySelectorAll('[data-product-wall]').forEach((el) => {
      const stop = mounted.get(el);
      if (stop) { stop(); mounted.delete(el); }
    });
  }

  mountAll(document);
  document.addEventListener('shopify:section:load', (e) => mountAll(e.target));
  document.addEventListener('shopify:section:unload', (e) => unmountAll(e.target));
})();
