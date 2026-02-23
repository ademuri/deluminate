(function () {
  if (window.deluminateInjected) return;
  window.deluminateInjected = true;

  let scheme_prefix;
  let backdrop;
  let animGifHandler;
  let newImageHandler;
  let darkDetectionHandler;
  let darkDetectionTimer;
  let rootWatcher;
  const rootAttribute = 'hc';

  const { getBgImageType, classifyTextColor, checksPreferredScheme } = window.deluminateLogic || {};

  function onExtensionMessage(request, sender, sendResponse) {
    if (chrome.runtime.lastError) {
      console.log(`Failed to communicate init request`);
    }
    if (request.target === 'offscreen') return;
    if (request.pingTab) {
      if (sendResponse) sendResponse(true);
      return;
    }
    if (request['manual_css']) {
      addCSSLink();
      return;
    }
    if (rootWatcher) {
      rootWatcher.disconnect();
    }
    if (request.enabled && request.scheme != 'normal') {
      const hc = scheme_prefix + request.scheme + ' ' + request.modifiers.join(' ');
      document.documentElement.setAttribute(rootAttribute, hc);
      rootWatcher = new MutationObserver((mutationList) => {
        if (checkDisconnected()) return;
        for (const mutation of mutationList) {
          if (mutation.type === 'attributes' && mutation.attributeName === rootAttribute) {
            const newValue = document.documentElement.getAttribute(rootAttribute);
            if (newValue === null) {
              document.documentElement.setAttribute(rootAttribute, hc);
            }
          }
        }
      });
      rootWatcher.observe(document.documentElement, { attributes: true });
      setupFullscreenWorkaround();
    } else {
      document.documentElement.removeAttribute(rootAttribute);
      removeFullscreenWorkaround();
    }
    // Enable advanced image recognition on invert modes except "invert all
    // images" mode.
    if (
      request.enabled &&
      request.scheme.indexOf('delumine') >= 0 &&
      request.scheme.indexOf('delumine-all') < 0 &&
      request.modifiers.indexOf('ignorebg') < 0
    ) {
      afterDomLoaded(restartDeepImageProcessing);
      newImageHandler.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    } else {
      newImageHandler.disconnect();
    }
    if (request.modifiers.indexOf('ignorebg') >= 0) {
      newImageHandler.disconnect();
      afterDomLoaded(() => {
        for (const elem of document.querySelectorAll('[deluminate_imageType]')) {
          elem.removeAttribute('deluminate_imageType');
        }
      });
    }
    if (
      request.enabled &&
      request.scheme.indexOf('delumine') >= 0 &&
      request.modifiers.indexOf('dynamic') >= 0
    ) {
      afterDomLoaded(() => {
        detectAlreadyDark();
        backdrop.style.display = 'none';
        if (darkDetectionHandler) {
          darkDetectionHandler.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class'],
          });
        }
      });
    } else {
      if (darkDetectionHandler) {
        darkDetectionHandler.disconnect();
      }
      document.documentElement.removeAttribute('looks-dark');
      if (request.enabled) {
        afterDomLoaded(() => {
          backdrop.style.display = 'none';
        });
      }
    }
    if (
      request.enabled &&
      request.settings.detect_animation === 'enabled' &&
      request.scheme == 'delumine-smart'
    ) {
      afterDomLoaded(() => {
        Array.prototype.forEach.call(
          document.querySelectorAll('img[src*=".gif"], img[src*=".GIF"]'),
          detectAnimatedGif,
        );
        animGifHandler.observe(document.documentElement, {
          childList: true,
          subtree: true,
        });
      });
    } else {
      animGifHandler.disconnect();
    }
    if (sendResponse) {
      sendResponse();
    }
  }

  function currentPageSettings() {
    return new Set(
      (document.documentElement.getAttribute(rootAttribute) ?? '').split(' ').slice(1),
    );
  }

  function addCSSLink() {
    /* Add CSS in a way that still works on chrome URLs. */
    const cssURL = chrome.runtime.getURL('deluminate.css');
    const selector = 'link[href="' + cssURL + '"]';
    if (document.querySelector(selector) !== null) {
      return; // Don't re-add if it's already there.
    }
    const link = document.createElement('link');
    link.href = cssURL;
    link.rel = 'stylesheet';
    link.media = 'screen';
    document.documentElement.insertBefore(link, null);
  }

  function setupFullscreenWorkaround() {
    // Skip adding this in nested iframes
    if (window != window.top) return;
    if (document.getElementById('deluminate_backdrop') == null) {
      addBackdrop();
    }
  }

  function addBackdrop() {
    // This results in a more instant, if imperfect, inversion. Injected CSS
    // apparently takes a moment to be processed.
    backdrop.style.background = 'black';
    backdrop.style.position = 'fixed';
    backdrop.style.top = 0;
    backdrop.style.left = 0;
    backdrop.style.height = '100vh';
    backdrop.style.width = '100vw';
    backdrop.style.pointerEvents = 'none';
    backdrop.style['z-index'] = 2147483647;

    /* Adding to the root node rather than body so it is not subject to absolute
     * positioning of the body. */
    document.documentElement.appendChild(backdrop);
    afterDomLoaded(() => {
      // If in dynamic mode, let the dynamic handler remove this page blocker.
      if (!currentPageSettings().has('dynamic')) {
        backdrop.style.display = 'none';
      }
    });
  }

  function removeFullscreenWorkaround() {
    removeById('deluminate_backdrop');
  }

  function removeById(id) {
    const element = document.getElementById(id);
    if (element !== null) {
      element.remove();
    }
  }

  function onEvent(evt) {
    if (checkDisconnected()) return true;
    if (evt.keyCode == 122 /* F11 */ && evt.shiftKey) {
      chrome.runtime.sendMessage({ toggle_global: true });
      evt.stopPropagation();
      evt.preventDefault();
      return false;
    }
    if (evt.keyCode == 123 /* F12 */ && evt.shiftKey) {
      chrome.runtime.sendMessage({ toggle_site: true });
      evt.stopPropagation();
      evt.preventDefault();
      return false;
    }
    return true;
  }

  function detectAnimatedGif(tag) {
    if (checkDisconnected()) return;
    chrome.runtime.sendMessage({ detect_gif: true, src: tag.src }, {}, function (result) {
      if (chrome.runtime.lastError) {
        console.log(`Failed to request gif detection`);
      }
      if (result) {
        tag.setAttribute('deluminate_imageType', 'animated gif');
      }
    });
  }

  let deepImageProcessingComplete = false;
  function processElements(elements) {
    if (!getBgImageType) return;
    const types = Array.prototype.map.call(elements, getBgImageType);
    const vWidth = window.innerWidth;
    const vHeight = window.innerHeight;

    for (let i = 0; i < elements.length; i++) {
      const tag = elements[i];
      let imageType = types[i];
      if (imageType && tag.tagName !== 'IMG' && tag.tagName !== 'VIDEO') {
        const rect = tag.getBoundingClientRect();
        if (rect.width >= vWidth * 0.5 && rect.height >= vHeight * 0.5) {
          tag.setAttribute('deluminate_re_invert', 'false');
          imageType = null;
        } else {
          tag.removeAttribute('deluminate_re_invert');
        }
      }
      if (imageType) {
        tag.setAttribute('deluminate_imageType', imageType);
      } else {
        tag.removeAttribute('deluminate_imageType');
      }
    }
  }

  const processingQueue = new Set();
  let processingScheduled = false;

  function scheduleProcessing() {
    if (processingScheduled) return;
    processingScheduled = true;

    const callback =
      window.requestIdleCallback ||
      ((cb) =>
        setTimeout(() => {
          cb({
            didTimeout: false,
            timeRemaining: () => 50,
          });
        }, 1));

    callback((deadline) => {
      processingScheduled = false;
      if (processingQueue.size === 0) return;

      const elements = Array.from(processingQueue);
      const chunkSize = 20; // Process in small chunks
      let processedCount = 0;

      while (
        processedCount < elements.length &&
        (deadline.timeRemaining() > 0 || deadline.didTimeout)
      ) {
        const chunk = elements.slice(processedCount, processedCount + chunkSize);
        processElements(chunk);
        for (const el of chunk) {
          processingQueue.delete(el);
        }
        processedCount += chunk.length;
      }

      if (processingQueue.size > 0) {
        scheduleProcessing();
      }
    });
  }

  function queueForProcessing(elements) {
    if (!elements || elements.length === 0) return;
    for (let i = 0; i < elements.length; i++) {
      processingQueue.add(elements[i]);
    }
    scheduleProcessing();
  }

  function deepImageProcessing() {
    if (deepImageProcessingComplete) return;
    // Use the queue for initial processing too to avoid freezing immediately
    queueForProcessing(document.querySelectorAll('body *'));
    deepImageProcessingComplete = true;
  }

  function restartDeepImageProcessing() {
    deepImageProcessingComplete = false;
    deepImageProcessing();
  }

  function detectAlreadyDark() {
    const textColor = classifyTextColor();
    if (textColor === 'light') {
      // Light text means dark mode... probably.
      document.documentElement.setAttribute('looks-dark', '');
    } else if (textColor !== 'dark' && checksPreferredScheme()) {
      document.documentElement.setAttribute('looks-dark', '');
    } else {
      document.documentElement.removeAttribute('looks-dark');
    }
  }

  function afterDomLoaded(cb) {
    if (document.readyState !== 'loading') {
      cb();
    } else {
      document.addEventListener('DOMContentLoaded', cb);
    }
  }

  function log() {
    if (checkDisconnected()) return;
    const msg = Array.prototype.slice.call(arguments).join(' ');
    chrome.runtime.sendMessage({ log: msg });
  }

  function init() {
    if (window == window.top) {
      scheme_prefix = '';
    } else {
      scheme_prefix = 'nested_';
    }
    log('Initializing.', scheme_prefix);

    backdrop = document.createElement('div');
    backdrop.id = scheme_prefix + 'deluminate_backdrop';

    animGifHandler = new MutationObserver(function (mutations) {
      if (checkDisconnected()) return;
      for (let i = 0; i < mutations.length; ++i) {
        for (let j = 0; j < mutations[i].addedNodes.length; ++j) {
          const newTag = mutations[i].addedNodes[j];
          if (newTag.querySelectorAll) {
            Array.prototype.forEach.call(
              newTag.querySelectorAll('img[src*=".gif"], img[src*=".GIF"]'),
              detectAnimatedGif,
            );
          }
        }
      }
    });

    newImageHandler = new MutationObserver(function (mutations) {
      if (checkDisconnected()) return;
      const elementsToProcess = [];
      for (let i = 0; i < mutations.length; ++i) {
        for (let j = 0; j < mutations[i].addedNodes.length; ++j) {
          const newTag = mutations[i].addedNodes[j];
          if (newTag.querySelectorAll) {
            if (newTag.nodeType === Node.ELEMENT_NODE) {
              elementsToProcess.push(newTag);
            }
            const descendants = newTag.querySelectorAll('*');
            for (let k = 0; k < descendants.length; k++) {
              elementsToProcess.push(descendants[k]);
            }
          }
        }
      }
      if (elementsToProcess.length > 0) {
        queueForProcessing(elementsToProcess);
      }
    });

    darkDetectionHandler = new MutationObserver(function () {
      if (checkDisconnected()) return;
      clearTimeout(darkDetectionTimer);
      darkDetectionTimer = setTimeout(detectAlreadyDark, 500);
    });

    chrome.runtime.onMessage.addListener(onExtensionMessage);
    chrome.runtime.sendMessage(
      { init: true, url: window.document.baseURI },
      {},
      onExtensionMessage,
    );
    document.addEventListener('keydown', onEvent, false);

    setupFullscreenWorkaround();
  }

  function unloadAll() {
    const watchers = [animGifHandler, newImageHandler, darkDetectionHandler, rootWatcher];
    for (const watcher of watchers) {
      if (watcher?.disconnect) {
        watcher.disconnect();
      }
    }
    clearTimeout(darkDetectionTimer);
    document.removeEventListener('keydown', onEvent, false);
  }

  function checkDisconnected() {
    if (!chrome.runtime?.id) {
      unloadAll();
      return true;
    }
    return false;
  }

  init();
})();
