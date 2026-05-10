/**
 * Theme Editor support
 */

window.theme.designMode = window.theme.designMode || {};
window.theme.designMode.selected = '';

document.addEventListener('shopify:section:select', (e) => {
  window.theme.designMode.selected = e.detail.sectionId;
});

document.addEventListener('shopify:section:deselect', () => {
  window.theme.designMode.selected = '';
});

/**
 * XR Button management
 */

document.addEventListener('shopify:section:load', (e) => {
  if (!e.target.querySelector('[data-shopify-xr-hidden]')) return;

  document
    .querySelectorAll('[data-shopify-xr-hidden]')
    .forEach((element) => element.classList.add('hidden'));
});

/**
 * Slideshow management
 */

document.addEventListener('shopify:block:select', (e) => {
  if (!e.target.matches('.splide__slide')) return;

  const slideIndex = Array.from(
    e.target.closest('.splide__list').children
  ).indexOf(e.target);

  const splideRoot = e.target.closest('.splide');

  splideRoot.dispatchEvent(
    new CustomEvent('slideshow-go', { detail: slideIndex })
  );

  if (splideRoot.hasAttribute('data-start')) {
    splideRoot.setAttribute('data-start-initial', splideRoot.dataset.start);
  }

  splideRoot.setAttribute('data-start', slideIndex + 1);
});

document.addEventListener('shopify:block:deselect', (e) => {
  if (!e.target.matches('.splide__slide')) return;

  const splideRoot = e.target.closest('.splide');

  if (splideRoot.hasAttribute('data-start-initial')) {
    splideRoot.setAttribute('data-start', splideRoot.dataset.startInitial);
    splideRoot.removeAttribute('data-start-initial');
  } else {
    splideRoot.removeAttribute('data-start');
  }
});
