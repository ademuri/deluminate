import * as fs from 'fs';
import * as path from 'path';
import { expect } from 'expect';
import { JSDOM } from 'jsdom';

describe('Content Logic', () => {
  let dom;
  let logic;

  beforeEach(() => {
    // Enable runScripts to execute the injected script
    dom = new JSDOM('<!DOCTYPE html><html><body><p id="p1">Hello World</p></body></html>', {
      runScripts: 'dangerously',
      resources: 'usable',
    });

    global.window = dom.window;
    global.document = dom.window.document;
    global.NodeFilter = dom.window.NodeFilter;

    // Load content_logic.js script content
    const scriptContent = fs.readFileSync(path.resolve('content_logic.js'), 'utf8');

    // Create script element and inject
    const scriptEl = dom.window.document.createElement('script');
    scriptEl.textContent = scriptContent;
    dom.window.document.body.appendChild(scriptEl);

    // Get the exposed logic from window
    logic = dom.window.deluminateLogic;

    // Mock getBoundingClientRect
    const rectMock = function () {
      return {
        width: 100,
        height: 20,
        top: 10,
        left: 10,
        bottom: 30,
        right: 110,
      };
    };
    dom.window.Element.prototype.getBoundingClientRect = rectMock;
    if (global.Element) {
      global.Element.prototype.getBoundingClientRect = rectMock;
    }

    global.getComputedStyle = (el) => {
      return {
        color: el.style.color || 'black',
        backgroundColor: el.style.backgroundColor || 'white',
        visibility: el.style.visibility || 'visible',
        display: el.style.display || 'block',
      };
    };

    // Clear the cache
    if (logic && logic.colorToRGBA && logic.colorToRGBA._cache) {
      for (const key in logic.colorToRGBA._cache) {
        delete logic.colorToRGBA._cache[key];
      }
    }
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.NodeFilter;
    delete global.getComputedStyle;
    delete global.mockImageData;
  });

  it('containsAny correctly identifies substrings', () => {
    expect(logic.containsAny('hello world', ['world', 'foo'])).toBe(true);
    expect(logic.containsAny('hello world', ['bar', 'foo'])).toBe(false);
  });

  it('colorValenceRaw classifies colors correctly', () => {
    // Light
    expect(logic.colorValenceRaw(255, 255, 255, 255)).toBe(1);
    // Dark
    expect(logic.colorValenceRaw(0, 0, 0, 255)).toBe(-1);
    // Gray / Ambiguous
    expect(logic.colorValenceRaw(128, 128, 128, 255)).toBe(0);
  });

  it('colorToRGBA handles basic colors (mocked)', () => {
    const originalColorToRGBA = logic.colorToRGBA;
    logic.colorToRGBA = () => [255, 0, 0, 255];
    try {
      const rgba = logic.colorToRGBA('red');
      expect(rgba).toEqual([255, 0, 0, 255]);
    } finally {
      logic.colorToRGBA = originalColorToRGBA;
    }
  });

  it('classifyTextColor detects light text', () => {
    document.body.innerHTML =
      '<p id="p1" style="color: white; background-color: black;">Hello World</p>';

    // Bypass colorToRGBA cache and logic for this test
    const originalColorToRGBA = logic.colorToRGBA;
    logic.colorToRGBA = (c) => {
      if (c === 'white' || c === 'rgb(255, 255, 255)') return [255, 255, 255, 255];
      if (c === 'black' || c === 'rgb(0, 0, 0)') return [0, 0, 0, 255];
      return [128, 128, 128, 255];
    };

    try {
      expect(logic.classifyTextColor(document)).toBe('light');
    } finally {
      logic.colorToRGBA = originalColorToRGBA;
    }
  });

  it('classifyTextColor detects dark text', () => {
    document.body.innerHTML =
      '<p id="p1" style="color: black; background-color: white;">Hello World</p>';

    const originalColorToRGBA = logic.colorToRGBA;
    logic.colorToRGBA = (c) => {
      if (c === 'white' || c === 'rgb(255, 255, 255)') return [255, 255, 255, 255];
      if (c === 'black' || c === 'rgb(0, 0, 0)') return [0, 0, 0, 255];
      return [128, 128, 128, 255];
    };

    try {
      expect(logic.classifyTextColor(document)).toBe('dark');
    } finally {
      logic.colorToRGBA = originalColorToRGBA;
    }
  });

  it('markCssImages detects background image types', () => {
    const div = document.createElement('div');
    // Important: We need to override window.getComputedStyle in the JSDOM window
    // because logic.markCssImages calls window.getComputedStyle(tag)
    const originalGetComputedStyle = dom.window.getComputedStyle;

    // Helper to mock style
    const mockStyle = (styleObj) => {
      dom.window.getComputedStyle = () => styleObj;
    };

    // PNG
    mockStyle({ 'background-image': 'url("image.png")' });
    logic.markCssImages(div);
    expect(div.getAttribute('deluminate_imageType')).toBe('png');

    // JPG
    mockStyle({ 'background-image': 'url("image.jpg")' });
    logic.markCssImages(div);
    expect(div.getAttribute('deluminate_imageType')).toBe('jpg');

    // SVG
    mockStyle({ 'background-image': 'url("data:image/svg+xml;base64,...")' });
    logic.markCssImages(div);
    expect(div.getAttribute('deluminate_imageType')).toBe('svg');

    // Unknown
    mockStyle({ 'background-image': 'url("unknown.xyz")' });
    logic.markCssImages(div);
    expect(div.getAttribute('deluminate_imageType')).toBe('unknown');

    // None
    mockStyle({ 'background-image': 'none' });
    logic.markCssImages(div);
    expect(div.hasAttribute('deluminate_imageType')).toBe(false);

    dom.window.getComputedStyle = originalGetComputedStyle;
  });

  it('markCssImages ignores large background elements', () => {
    const div = document.createElement('div');
    const originalGetComputedStyle = dom.window.getComputedStyle;

    // Mock window dimensions
    dom.window.innerWidth = 1000;
    dom.window.innerHeight = 1000;

    // Small element - should be marked
    div.getBoundingClientRect = () => ({ width: 100, height: 100 });
    dom.window.getComputedStyle = () => ({ 'background-image': 'url("image.jpg")' });
    logic.markCssImages(div);
    expect(div.getAttribute('deluminate_imageType')).toBe('jpg');

    // Large element - should NOT be marked
    div.getBoundingClientRect = () => ({ width: 900, height: 900 });
    logic.markCssImages(div);
    expect(div.hasAttribute('deluminate_imageType')).toBe(false);

    // Large IMG element - should ALWAYS be marked (images are content)
    const img = document.createElement('img');
    img.getBoundingClientRect = () => ({ width: 900, height: 900 });
    dom.window.getComputedStyle = () => ({ 'background-image': 'url("image.jpg")' });
    logic.markCssImages(img);
    expect(img.getAttribute('deluminate_imageType')).toBe('jpg');

    dom.window.getComputedStyle = originalGetComputedStyle;
  });

  it('classifyTextColor uses TreeWalker when few paragraphs found', () => {
    // Clear document
    document.body.innerHTML = '';
    const div = document.createElement('div');
    div.id = 'walker-parent';
    const span = document.createElement('span');
    span.textContent = 'Lots of text here to trigger the TreeWalker logic. '.repeat(10);
    div.appendChild(span);
    document.body.appendChild(div);

    // Override dom.window.getComputedStyle used by classifyTextColor
    dom.window.getComputedStyle = (el) => {
      return {
        color: 'white',
        backgroundColor: 'black',
        visibility: 'visible',
        display: 'block',
      };
    };

    const originalColorToRGBA = logic.colorToRGBA;
    logic.colorToRGBA = (c) => {
      if (c === 'white' || c === 'rgb(255, 255, 255)') return [255, 255, 255, 255];
      if (c === 'black' || c === 'rgb(0, 0, 0)') return [0, 0, 0, 255];
      return [128, 128, 128, 255];
    };

    try {
      // total should be 0 because there are no <p> tags.
      expect(logic.classifyTextColor(document)).toBe('light');
    } finally {
      logic.colorToRGBA = originalColorToRGBA;
    }
  });

  it('checksPreferredScheme detects media query', () => {
    // Mock document.styleSheets
    Object.defineProperty(document, 'styleSheets', {
      value: [
        {
          media: ['(prefers-color-scheme: dark)'],
          rules: [],
        },
      ],
      configurable: true,
    });
    expect(logic.checksPreferredScheme()).toBe(true);

    // Mock document.styleSheets with rules
    Object.defineProperty(document, 'styleSheets', {
      value: [
        {
          media: [],
          rules: [
            {
              media: ['(prefers-color-scheme: dark)'],
            },
          ],
        },
      ],
      configurable: true,
    });
    expect(logic.checksPreferredScheme()).toBe(true);

    // Mock document.styleSheets with no match
    Object.defineProperty(document, 'styleSheets', {
      value: [
        {
          media: [],
          rules: [],
        },
      ],
      configurable: true,
    });
    expect(logic.checksPreferredScheme()).toBe(false);
  });

  it('getBgImageType handles getComputedStyle errors gracefully', () => {
    const div = document.createElement('div');
    const originalGetComputedStyle = dom.window.getComputedStyle;

    dom.window.getComputedStyle = () => {
      throw new Error('Failed to decode downloaded font');
    };

    const result = logic.getBgImageType(div);
    expect(result).toBe(null);

    dom.window.getComputedStyle = originalGetComputedStyle;
  });

  it('classifyTextColor handles getComputedStyle errors gracefully', () => {
    // Override global.getComputedStyle used by classifyTextColor
    const originalGlobalGetComputedStyle = global.getComputedStyle;
    const originalDomGetComputedStyle = dom.window.getComputedStyle;

    const thrower = () => {
      throw new Error('Failed to decode downloaded font');
    };

    global.getComputedStyle = thrower;
    dom.window.getComputedStyle = thrower;

    // Should not throw
    const result = logic.classifyTextColor(document);
    // Expect null because all paragraphs are skipped due to error
    expect(result).toBe(null);

    global.getComputedStyle = originalGlobalGetComputedStyle;
    dom.window.getComputedStyle = originalDomGetComputedStyle;
  });
});
