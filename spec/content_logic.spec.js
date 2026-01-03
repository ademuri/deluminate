import * as logic from '../content_logic.js';
import { expect } from 'expect';
import { JSDOM } from 'jsdom';

describe("Content Logic", () => {
  let dom;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body><p id="p1">Hello World</p></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.NodeFilter = dom.window.NodeFilter;
    
    // Mock getContext before any colorToRGBA calls
    dom.window.HTMLCanvasElement.prototype.getContext = function(type) {
        if (type === '2d') {
            return {
                clearRect: () => {},
                fillRect: () => {},
                getImageData: () => ({
                    data: global.mockImageData || [0, 0, 0, 255]
                })
            };
        }
        return null;
    };

    // Mock getBoundingClientRect
    dom.window.Element.prototype.getBoundingClientRect = function() {
        return {
            width: 100,
            height: 20,
            top: 0,
            left: 0,
            bottom: 20,
            right: 100
        };
    };

    global.getComputedStyle = (el) => {
        return {
            color: el.style.color || 'black',
            visibility: el.style.visibility || 'visible',
            display: el.style.display || 'block'
        };
    };

    // Clear the cache
    if (logic.colorToRGBA._cache) {
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

  it("containsAny correctly identifies substrings", () => {
    expect(logic.containsAny("hello world", ["world", "foo"])).toBe(true);
    expect(logic.containsAny("hello world", ["bar", "foo"])).toBe(false);
  });

  it("colorValenceRaw classifies colors correctly", () => {
    // Light
    expect(logic.colorValenceRaw(255, 255, 255, 255)).toBe(1);
    // Dark
    expect(logic.colorValenceRaw(0, 0, 0, 255)).toBe(-1);
    // Gray / Ambiguous
    expect(logic.colorValenceRaw(128, 128, 128, 255)).toBe(0);
  });

  it("colorToRGBA handles basic colors (mocked context)", () => {
    global.mockImageData = [255, 0, 0, 255];
    const rgba = logic.colorToRGBA("red-test"); // Unique color to avoid cache
    expect(rgba).toEqual([255, 0, 0, 255]);
  });

  it("classifyTextColor detects light text", () => {
    global.mockImageData = [255, 255, 255, 255]; // White
    const p = document.getElementById("p1");
    p.style.color = "white-test"; // Unique color to avoid cache
    
    expect(logic.classifyTextColor(document)).toBe("light");
  });

  it("classifyTextColor detects dark text", () => {
    global.mockImageData = [0, 0, 0, 255]; // Black
    const p = document.getElementById("p1");
    p.style.color = "black-test"; // Unique color to avoid cache
    
    expect(logic.classifyTextColor(document)).toBe("dark");
  });

  it("markCssImages detects background image types", () => {
    const div = document.createElement('div');
    const originalGetComputedStyle = window.getComputedStyle;
    
    // PNG
    window.getComputedStyle = () => ({ 'background-image': 'url("image.png")' });
    logic.markCssImages(div);
    expect(div.getAttribute('deluminate_imageType')).toBe('png');

    // JPG
    window.getComputedStyle = () => ({ 'background-image': 'url("image.jpg")' });
    logic.markCssImages(div);
    expect(div.getAttribute('deluminate_imageType')).toBe('jpg');

    // SVG
    window.getComputedStyle = () => ({ 'background-image': 'url("data:image/svg+xml;base64,...")' });
    logic.markCssImages(div);
    expect(div.getAttribute('deluminate_imageType')).toBe('svg');

    // Unknown
    window.getComputedStyle = () => ({ 'background-image': 'url("unknown.xyz")' });
    logic.markCssImages(div);
    expect(div.getAttribute('deluminate_imageType')).toBe('unknown');

    // None
    window.getComputedStyle = () => ({ 'background-image': 'none' });
    logic.markCssImages(div);
    expect(div.hasAttribute('deluminate_imageType')).toBe(false);

    window.getComputedStyle = originalGetComputedStyle;
  });

  it("classifyTextColor uses TreeWalker when few paragraphs found", () => {
    // Clear paragraphs
    document.body.innerHTML = '<div><span>Lots of text here to trigger the TreeWalker logic. </span></div>'.repeat(100);
    global.mockImageData = [255, 255, 255, 255]; // White text
    
    global.getComputedStyle = (el) => {
        return {
            color: 'white-test',
            visibility: 'visible',
            display: 'block'
        };
    };

    expect(logic.classifyTextColor(document)).toBe("light");
  });

  it("checksPreferredScheme detects media query", () => {
    // Mock document.styleSheets
    Object.defineProperty(document, 'styleSheets', {
        value: [{
            media: ['(prefers-color-scheme: dark)'],
            rules: []
        }],
        configurable: true
    });
    expect(logic.checksPreferredScheme()).toBe(true);

    // Mock document.styleSheets with rules
    Object.defineProperty(document, 'styleSheets', {
        value: [{
            media: [],
            rules: [{
                media: ['(prefers-color-scheme: dark)']
            }]
        }],
        configurable: true
    });
    expect(logic.checksPreferredScheme()).toBe(true);

    // Mock document.styleSheets with no match
    Object.defineProperty(document, 'styleSheets', {
        value: [{
            media: [],
            rules: []
        }],
        configurable: true
    });
    expect(logic.checksPreferredScheme()).toBe(false);
  });
});