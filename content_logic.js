export function containsAny(haystack, needleList) {
  for (let i = 0; i < needleList.length; ++i) {
    if (haystack.indexOf(needleList[i]) >= 0) {
      return true;
    }
  }
  return false;
}

export const colorToRGBA = (function() {
  // Use a canvas to normalize colors for computing.
  // Note: In a test environment, document might be provided by JSDOM.
  let canvas;
  let ctx;

  const cache = {};
  function memoize(f) {
    const memoized = (key) => {
      if (!(key in cache)) {
        // Simple LRU-ish: if too big, clear half.
        const keys = Object.keys(cache);
        if (keys.length > 1000) {
          for (let i = 0; i < 500; ++i) {
            delete cache[keys[i]];
          }
        }
        cache[key] = f(key);
      }
      return cache[key];
    };
    memoized._cache = cache;
    return memoized;
  }

  return memoize(function(c) {
    if ((!canvas || (typeof document !== 'undefined' && canvas.ownerDocument !== document)) &&
        typeof document !== 'undefined') {
      canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      ctx = canvas.getContext('2d', {willReadFrequently: true});
    }
    if (!ctx) return [0, 0, 0, 0];
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data];
  });
})();

const grayMargin = 64;
const alphaFactor = (255 + grayMargin) / 255;

export function colorValenceRaw(r, g, b, a) {
  // Simple YIQ luminance calculation, scaled to (255 * 3) for convenience.
  const lum = ((r*229)+(g*449)+(b*87))/255;
  // Alpha transparency widens the effective gray range from the middle third
  // (gray margin excluded) at 100% opaque to the whole range at 0% opaque.
  const alphaRange = a * alphaFactor;
  const grayMin = alphaRange, grayMax = (255 * 3) - alphaRange;
  return lum < grayMin ? -1
    : lum > grayMax ? 1
    : 0
    ;
}

export function colorValence(color) {
  return colorValenceRaw(...colorToRGBA(color));
}

export function getBgImageType(tag) {
  const bgImage = window.getComputedStyle(tag)['background-image'];
  if (containsAny(bgImage, ['data:image/png', '.png', '.PNG'])) {
    return 'png';
  } else if (containsAny(bgImage, ['.gif', '.GIF'])) {
    return 'gif';
  } else if (containsAny(bgImage,
      ['data:image/jpeg', '.jpg', '.JPG', '.jpeg', '.JPEG'])) {
    return 'jpg';
  } else if (containsAny(bgImage,
      ['data:image/svg', '.svg', '.SVG'])) {
    return 'svg';
  } else if (containsAny(bgImage,
      ['data:image/webp', '.webp'])) {
    return 'webp';
  } else if (containsAny(bgImage, ['url', 'data:image'])) {
    return 'unknown';
  }
  return null;
}

export function markCssImages(tag) {
  const imageType = getBgImageType(tag);
  if (imageType) {
    tag.setAttribute('deluminate_imageType', imageType);
  } else {
    tag.removeAttribute('deluminate_imageType');
  }
}

export function classifyTextColor(rootNode = document) {
  const paras = new Set(rootNode.querySelectorAll('p:not(footer *)'));
  // Text with line breaks is *probably* basic writing and not fancy labels.
  for (const br of rootNode.querySelectorAll('br:not(footer *)')) {
    paras.add(br.parentElement);
  }
  const windowHeight = window.innerHeight;
  const charTypes = [0, 0, 0];
  let total = 0;
  for (const p of paras) {
    const {color, display, visibility} = getComputedStyle(p);
    if (!color || display === "none" || visibility !== "visible") continue;
    const {width = 0, height = 0, top = 0} = p.getBoundingClientRect();
    if (width * height <= 0 || top > windowHeight) continue;
    const text = p.textContent;
    charTypes[colorValence(color) + 1] += text.length;
    total += text.length;
    // Arbitrarily chosen good-enough threshold.
    if (total > 4096) break;
  }

  // If the previous selectors didn't find much of the page's text, use a
  // treeWalker.
  if (total <= 4096
      && total < (rootNode.documentElement?.textContent.length || 0) * 0.1
  ) {
    const treeWalker = document.createTreeWalker(
      rootNode.querySelector("body") || rootNode,
      NodeFilter.SHOW_TEXT,
    );

    while (treeWalker.nextNode()) {
      const text = treeWalker.currentNode;
      const elem = text.parentElement;
      const {color, display, visibility} = getComputedStyle(elem);
      if (!color || display === "none" || visibility !== "visible") continue;
      const {width = 0, height = 0, top = 0} = elem.getBoundingClientRect();
      if (width * height <= 0 || top > windowHeight) continue;
      charTypes[colorValence(color) + 1] += text.length;
      total += text.length;
      // Arbitrarily chosen good-enough threshold.
      if (total > 4096) break;
    }
  }
  // If light text is a supermajority of the text, we'll say this page uses
  // light text overall.
  return (charTypes[2] > charTypes[0] + charTypes[1]) ? "light"
    : (charTypes[0] > charTypes[1] + charTypes[2]) ? "dark"
    : null
    ;
}

export function checksPreferredScheme() {
  for (const css of document?.styleSheets ?? []) {
    try {
      for (const m of css.media ?? []) {
        if (m.includes("prefers-color-scheme")) {
          return true;
        }
      }
      const cssRules = css.rules;
      for (const rule of cssRules) {
        for (const m of rule.media ?? []) {
          if (m.includes("prefers-color-scheme")) {
            return true;
          }
        }
      }
    } catch {
      // Exceptions thrown here for CORS security errors..
    }
  }
  return false;
}

if (typeof window !== 'undefined') {
  window.deluminateLogic = {
    containsAny,
    colorToRGBA,
    colorValenceRaw,
    colorValence,
    getBgImageType,
    markCssImages,
    classifyTextColor,
    checksPreferredScheme
  };
}
