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
});