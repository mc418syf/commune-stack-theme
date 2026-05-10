function wrap(el, tagName = 'div') {
  const wrapper = document.createElement(tagName);

  el.parentNode.insertBefore(wrapper, el);

  wrapper.appendChild(el);

  return wrapper;
}

function wrapAll(nodes, wrapper) {
  // Cache the current parent and previous sibling of the first node.
  var parent = nodes[0].parentNode;
  var previousSibling = nodes[0].previousSibling;

  // Place each node in wrapper.
  //  - If nodes is an array, we must increment the index we grab from
  //    after each loop.
  //  - If nodes is a NodeList, each node is automatically removed from
  //    the NodeList when it is removed from its parent with appendChild.
  for (var i = 0; nodes.length - i; wrapper.firstChild === nodes[0] && i++) {
    wrapper.appendChild(nodes[i]);
  }

  // Place the wrapper just after the cached previousSibling
  parent.insertBefore(wrapper, previousSibling.nextSibling);

  return wrapper;
}

function unwrap(wrapper) {
  // place childNodes in document fragment
  var docFrag = document.createDocumentFragment();
  while (wrapper.firstChild) {
    var child = wrapper.removeChild(wrapper.firstChild);
    docFrag.appendChild(child);
  }

  // replace wrapper with document fragment
  wrapper.parentNode.replaceChild(docFrag, wrapper);
}

function cartesian(...a) {
  return a.reduce((a, b) => a.flatMap((d) => b.map((e) => [d, e].flat())));
}

function loadScriptBySrc(scriptSrc) {
  if (
    document.head.querySelector(`script[src="${scriptSrc}"]`) ||
    document.body.querySelector(`script[src="${scriptSrc}"]`)
  )
    return;

  const scriptEl = document.createElement('script');
  scriptEl.src = scriptSrc;
  scriptEl.type = 'module';

  document.body.appendChild(scriptEl);

  return scriptEl;
}

function loadInlineScript(scriptContent) {
  console.time('inlineScriptDuplicatesCheck');

  const headScripts = document.head.querySelectorAll('script[type="module"]');
  const bodyScripts = document.body.querySelectorAll('script[type="module"]');

  const allScripts = Array.from(headScripts).concat(Array.from(bodyScripts));

  const scriptsWithSameContent = allScripts.filter(
    (script) =>
      !script.src &&
      script.textContent.replace(/\s/g, '') === scriptContent.replace(/\s/g, '')
  );

  console.timeEnd('inlineScriptDuplicatesCheck');

  if (scriptsWithSameContent.length > 0) {
    return;
  } else {
    const scriptEl = document.createElement('script');

    scriptEl.type = 'module';

    scriptEl.textContent = scriptContent;

    document.body.appendChild(scriptEl);

    return scriptEl;
  }
}

function loadThisScript(sourceScriptEl) {
  return new Promise((resolve, reject) => {
    if (sourceScriptEl.type !== 'module') {
      console.warn('Script not loaded, not a module', sourceScriptEl);
      reject();
    }

    if (sourceScriptEl.src) {
      const scriptEl = loadScriptBySrc(sourceScriptEl.src);

      if (scriptEl) {
        scriptEl.onload = () => {
          resolve();
        };

        scriptEl.onerror = () => {
          reject();
        };
      } else {
        resolve();
      }
    } else if (sourceScriptEl.textContent.trim() !== '') {
      const scriptEl = loadInlineScript(sourceScriptEl.textContent);

      resolve();
    }
  });
}

function loadTheseScripts(scriptEls) {
  const promises = [];

  for (scriptEl of scriptEls) {
    promises.push(loadThisScript(scriptEl));
  }

  return Promise.all(promises);
}

let touchDevice = false;

function isTouch() {
  return touchDevice;
}

document.addEventListener('touchstart', () => {
  touchDevice = true;
});

document.addEventListener('mousedown', () => {
  document.body.classList.add('user-using-mouse');
});

document.addEventListener('keydown', () => {
  document.body.classList.remove('user-using-mouse');
});

function themeHeaderEl() {
  return document.querySelector('[data-theme-header]');
}

function headerIsSticky() {
  const headerEl = themeHeaderEl();

  if (
    headerEl &&
    headerEl.hasAttribute('data-sticky-header') &&
    headerEl.dataset.stickyHeader === 'true'
  ) {
    return true;
  }

  return false;
}

function headerIsOverlaid() {
  const headerEl = themeHeaderEl();

  if (
    headerEl &&
    headerEl.hasAttribute('data-overlay-header') &&
    headerEl.dataset.overlayHeader === 'true'
  ) {
    return true;
  }

  return false;
}

function scrollToTopOf(element) {
  if (!element) return;

  let topOffset = element.getBoundingClientRect().top;

  if (headerIsSticky() || headerIsOverlaid()) {
    topOffset -=
      parseFloat(
        document.documentElement.style.getPropertyValue('--header-group-height')
      ) + 20;
  }

  window.scroll({
    top: window.scrollY + topOffset,
    ...(isMotionSafe() && { behavior: 'smooth' }),
  });
}

function objectHasNoKeys(obj) {
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) return false;
  }

  return true;
}

function nextOrFirst(array, currentItem) {
  if (!currentItem) return array[0];

  return array[array.indexOf(currentItem) + 1] || array[0];
}

function previousOrLast(array, currentItem) {
  if (!currentItem) return array[array.length - 1];

  return array[array.indexOf(currentItem) - 1] || array[array.length - 1];
}

function fetchConfigDefaults(acceptHeader = 'application/json') {
  return {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json;',
      Accept: acceptHeader,
    },
  };
}

function parseDOMFromString(htmlString) {
  window.___baselineDOMParser = window.___baselineDOMParser || new DOMParser();

  return window.___baselineDOMParser.parseFromString(htmlString, 'text/html');
}

function querySelectorInHTMLString(selector, htmlString) {
  return parseDOMFromString(htmlString).querySelector(selector);
}

/**
 * Light wrapper around fetch for making common
 * requests easier. Provides very basic caching.
 */

window.__fetchCache = window.__fetchCache || {};

const RESPONSE_TYPE_JSON = 0;
const RESPONSE_TYPE_TEXT = 1;

async function fetchAndCache(
  url,
  options,
  cacheTimeout = 5000,
  forceFresh = false,
  responseType
) {
  if (__fetchCache[url] && !forceFresh) {
    return __fetchCache[url];
  }

  const responseReader =
    responseType === RESPONSE_TYPE_TEXT
      ? Response.prototype.text
      : Response.prototype.json;

  const res = await fetch(url, options);
  const data = responseReader.call(res);

  if (cacheTimeout && cacheTimeout > 0) {
    __fetchCache[url] = data;

    setTimeout(() => {
      delete __fetchCache[url];
    }, cacheTimeout);
  }

  return data;
}

/**
 * fetchHTML and fetchJSON cache responses for 5 seconds
 * by default; if a fresh request is required, set
 * forceFresh to true or use the freshHTML and freshJSON
 * helper functions.
 */

async function fetchHTML(
  url,
  options,
  cacheTimeout = 5000,
  forceFresh = false
) {
  return fetchAndCache(
    url,
    options,
    cacheTimeout,
    forceFresh,
    RESPONSE_TYPE_TEXT
  );
}

function freshHTML(url, options) {
  return fetchHTML(url, options, 0, true);
}

async function fetchJSON(
  url,
  options,
  cacheTimeout = 5000,
  forceFresh = false
) {
  return fetchAndCache(
    url,
    options,
    cacheTimeout,
    forceFresh,
    RESPONSE_TYPE_JSON
  );
}

function freshJSON(url, options) {
  return fetchJSON(url, options, 0, true);
}

async function fetchHTMLFragment(url, selector) {
  const fetchedHTMLString = await fetchHTML(url);
  const fragment = querySelectorInHTMLString(selector, fetchedHTMLString);

  return fragment ? fragment.innerHTML : '';
}

function mdBreakpointMQL() {
  return window.matchMedia('(min-width: 768px)');
}

function isMdBreakpoint() {
  return window.mdBreakpointMQL().matches;
}

function maxLgBreakpointMQL() {
  return window.matchMedia('(max-width: 1023px)');
}

function isMaxLgBreakpoint() {
  return window.maxLgBreakpointMQL().matches;
}

function lgBreakpointMQL() {
  return window.matchMedia('(min-width: 1024px)');
}

function isLgBreakpoint() {
  return window.lgBreakpointMQL().matches;
}

function motionSafeMQL() {
  return window.matchMedia('(prefers-reduced-motion)');
}

function isMotionSafe() {
  return !window.motionSafeMQL().matches;
}

function showMobileSidebarNav() {
  if (window.alwaysShowMobileSidebarNav === true) {
    return true;
  }

  return !isMdBreakpoint();
}

function initTeleport(el) {
  if (!el) return;

  const teleportCandidates = el.querySelectorAll('[data-should-teleport]');

  if (teleportCandidates.length) {
    teleportCandidates.forEach((teleportCandidate) => {
      teleportCandidate.setAttribute(
        'x-teleport',
        teleportCandidate.dataset.shouldTeleport
      );
    });
  }
}

async function getModalLabel(modalSlotName, slotEl) {
  if (Alpine.store('modals')[modalSlotName].open) {
    await globalNextTick();

    const labelSourceEl = Array.from(slotEl.children).filter((el) =>
      el.hasAttribute('data-modal-label')
    )[0];

    if (labelSourceEl) {
      return labelSourceEl.dataset.modalLabel;
    }
  }

  return false;
}

function waitForContent(element) {
  return new Promise((resolve, reject) => {
    if (element.innerHTML.trim().length > 0) {
      resolve();
    }

    const mutationObserver = new MutationObserver((mutationsList, observer) => {
      if (element.innerHTML.trim().length > 0) {
        observer.disconnect();
        resolve();
      }
    });

    mutationObserver.observe(element, { childList: true });
  });
}

window.uniqueFilter = (element, index, array) =>
  array.indexOf(element) === index;

function shallowDiffKeys(object1, object2, meaningfulKeys = []) {
  function keysForDiff(object) {
    if (meaningfulKeys.length === 0) {
      return Object.keys(object);
    }

    return Object.keys(object).filter(
      (key) => meaningfulKeys.indexOf(key) !== -1
    );
  }

  const keys1 = keysForDiff(object1);
  const keys2 = keysForDiff(object2);

  let equal = true;

  const diffKeys = [];

  if (keys1.length !== keys2.length) {
    equal = false;
  }

  if (equal) {
    for (let key of keys1) {
      if (object1[key] !== object2[key]) {
        diffKeys.push(key);
        equal = false;
      }
    }
  }

  return { equal, diffKeys };
}

function shallowDiffKeysOnMultiple(arrayOfObjects, meaningfulKeys = []) {
  const results = [];
  const allDiffKeys = [];

  for (const array1 of arrayOfObjects) {
    for (const array2 of arrayOfObjects) {
      results.push(shallowDiffKeys(array1, array2, meaningfulKeys).equal);
      allDiffKeys.push(
        shallowDiffKeys(array1, array2, meaningfulKeys).diffKeys
      );
    }
  }

  const result = results.reduce((prev, curr) => prev && curr);

  const uniqueDiffKeys = allDiffKeys.flat().filter(uniqueFilter);

  return { result, uniqueDiffKeys };
}

function iFrameCommand(iFrameEl, commandString) {
  if (!iFrameEl || !commandString) return;

  iFrameEl.contentWindow.postMessage(
    JSON.stringify({
      event: 'command',
      func: commandString,
      args: '',
    }),
    '*'
  );
}

function iFrameMethod(iFrameEl, methodString) {
  if (!iFrameEl || !methodString) return;

  iFrameEl.contentWindow.postMessage(
    JSON.stringify({
      method: methodString,
    }),
    '*'
  );
}

function splideIsIdle(splideInstance) {
  if (!splideInstance) return;

  if (window.Splide && splideInstance) {
    if (splideInstance.state.is(window.Splide.STATES.IDLE)) {
      return true;
    }
  }

  return false;
}

function splideIsDestroyed(splideInstance) {
  if (!splideInstance) return;

  if (window.Splide && splideInstance) {
    if (splideInstance.state.is(window.Splide.STATES.DESTROYED)) {
      return true;
    }
  }

  return false;
}

function splideIsNotDestroyed(splideInstance) {
  if (!splideInstance) return;

  if (window.Splide && splideInstance) {
    if (!splideInstance.state.is(window.Splide.STATES.DESTROYED)) {
      return true;
    }
  }

  return false;
}

function getUrlWithVariant(url, id) {
  if (/variant=/.test(url)) {
    return url.replace(/(variant=)[^&]+/, '$1' + id);
  } else if (/\?/.test(url)) {
    return url.concat('&variant=').concat(id);
  }

  return url.concat('?variant=').concat(id);
}

function getSectionId(el) {
  if (!el._closestSectionId) {
    el._closestSectionId = el
      .closest('.shopify-section')
      .getAttribute('id')
      .replace('shopify-section-', '');
  }

  return el._closestSectionId;
}

function kebabCase(subject) {
  if ([' ', '_'].includes(subject)) return subject;
  return subject
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[_\s]/, '-')
    .toLowerCase();
}

function clearURLSearchParams(url) {
  for (const key of [...url.searchParams.keys()]) {
    url.searchParams.delete(key);
  }
}

/**
 * paramsInput can be a string, a sequence of pairs,
 * or a record, as per:
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams/URLSearchParams#examples
 *
 * It can also be an instance of URLSearchParams.
 *
 */

function _getURLByModifyingParams(
  urlString,
  paramsInput,
  clear = false,
  append
) {
  const url = new URL(urlString, window.location.origin);

  if (clear) {
    clearURLSearchParams(url);
  }

  const params = new URLSearchParams(paramsInput);

  const setOrAppendParam = append
    ? URLSearchParams.prototype.append
    : URLSearchParams.prototype.set;

  for (const [key, value] of params) {
    setOrAppendParam.call(url.searchParams, key, value);
  }

  return url;
}

function getURLWithParams(url, paramsInput, clear = false) {
  return _getURLByModifyingParams(url, paramsInput, clear, false);
}

function currentURLWithParams(paramsInput, clear = false) {
  return getURLWithParams(window.location.href, paramsInput, clear);
}

function getURLAddingParams(url, paramsInput, clear = false) {
  return _getURLByModifyingParams(url, paramsInput, clear, true);
}

function currentURLAddingParams(paramsInput, clear = false) {
  return getURLAddingParams(window.location.href, paramsInput, clear);
}

function formatDate(string) {
  const date = new Date(string);

  return date.toLocaleDateString(Shopify.locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function asyncTimeout(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function globalNextTick() {
  return new Promise((resolve) => {
    queueMicrotask(resolve);
  });
}

function hasWrappedChildren(el) {
  if (!el.children || el.children.length < 2) return false;

  const childEls = Array.from(el.children);

  let lastOffsetTop = childEls.shift().offsetTop;

  for (const childEl of childEls) {
    if (childEl.offsetTop !== lastOffsetTop) {
      return true;
    }

    lastOffsetTop = childEl.offsetTop;
  }

  return false;
}

function isBooleanString(string) {
  return string === 'true' || string === 'false' ? true : false;
}

function stringToBoolean(string) {
  return string === 'true' ? true : false;
}

function daysInMs(days) {
  return days * 24 * 60 * 60 * 1000;
}

function msInDays(ms) {
  return ms / 1000 / 60 / 60 / 24;
}

function isInTheFuture(msSinceEpoch) {
  return msSinceEpoch > Date.now();
}

function setExpiringStorageItem(key, value, expiresIn) {
  localStorage.setItem(
    key,
    JSON.stringify({ value, expires: Date.now() + expiresIn })
  );
}

function getExpiringStorageItem(key) {
  const value = localStorage.getItem(key);

  if (!value) {
    return null;
  }

  let valueObject;

  try {
    valueObject = JSON.parse(value);
  } catch (e) {}

  if (valueObject && valueObject.expires) {
    if (isInTheFuture(valueObject.expires)) {
      return valueObject.value;
    } else {
      localStorage.removeItem(key);
      return null;
    }
  }

  return null;
}
