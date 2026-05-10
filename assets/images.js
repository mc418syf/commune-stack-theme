class ImageWithPlaceholder extends HTMLElement {
  constructor() {
    super();

    this.imageEl = this.querySelector('img');

    if (!this.imageEl) {
      return;
    }

    this.loaded = this.imageEl.complete;

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
