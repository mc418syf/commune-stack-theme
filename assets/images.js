class ImageWithPlaceholder extends HTMLElement {
  constructor() {
    super();

    this.imageEl = this.querySelector('img');

    if (!this.imageEl) {
      return;
    }

    // A deferred image (data-defer-image) has no source yet: keep the placeholder until it is loaded
    this.loaded = this.imageEl.complete && !this.imageEl.hasAttribute('data-defer-image');

    if (this.loaded === false) {
      this.imageEl.addEventListener('load', this.imageLoadedHandler.bind(this));
    }
  }

  get loaded() {
    return this._loaded;
  }

  set loaded(value) {
    this._loaded = value;

    this.imageEl.classList.toggle('is-complete', value);
  }

  imageLoadedHandler(e) {
    this.loaded = this.imageEl.complete;
    this.imageEl.removeEventListener('load', this.imageLoadedHandler);
  }
}

customElements.define('image-with-placeholder', ImageWithPlaceholder);

/**
 * Deferred images. A product card on phones carries up to four swipe slides, but only the first one is on screen.
 * The others are rendered without a source (data-src / data-srcset) so they cost nothing until the visitor
 * touches or swipes that card; then the whole card is loaded at once.
 */
(function () {
  const TRACK = '.plp-snap-track';

  function load(img) {
    if (!img.hasAttribute('data-defer-image')) return;
    img.removeAttribute('data-defer-image');
    img.addEventListener('load', () => img.classList.add('is-complete'), { once: true });
    if (img.dataset.srcset) img.srcset = img.dataset.srcset;
    if (img.dataset.src) img.src = img.dataset.src;
  }

  function loadIn(el) {
    const track = el && el.closest ? el.closest(TRACK) : null;
    if (track) track.querySelectorAll('img[data-defer-image]').forEach(load);
  }

  // touching a card starts the download before the swipe has moved
  document.addEventListener('touchstart', (e) => loadIn(e.target), { passive: true, capture: true });
  document.addEventListener('pointerdown', (e) => loadIn(e.target), { passive: true, capture: true });
  // scroll does not bubble: listen in the capture phase. Covers trackpads, keyboards and scripted scrolling.
  document.addEventListener('scroll', (e) => {
    const t = e.target;
    if (t && t.nodeType === 1 && t.matches(TRACK) && t.scrollLeft > 0) loadIn(t);
  }, { passive: true, capture: true });
})();
