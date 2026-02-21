import * as fs from 'fs';
import * as path from 'path';
import { expect } from 'expect';
import { JSDOM } from 'jsdom';

describe('Reproduction: Dark Site Detection', () => {
  let dom;
  let logic;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      runScripts: 'dangerously',
      resources: 'usable',
    });

    global.window = dom.window;
    global.document = dom.window.document;
    global.NodeFilter = dom.window.NodeFilter;

    const scriptContent = fs.readFileSync(path.resolve('content_logic.js'), 'utf8');
    const scriptEl = dom.window.document.createElement('script');
    scriptEl.textContent = scriptContent;
    dom.window.document.body.appendChild(scriptEl);

    logic = dom.window.deluminateLogic;
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.NodeFilter;
  });

  it("checksPreferredScheme should NOT return true for 'prefers-color-scheme: light'", () => {
    Object.defineProperty(document, 'styleSheets', {
      value: [
        {
          media: ['(prefers-color-scheme: light)'],
          rules: [],
        },
      ],
      configurable: true,
    });
    // This currently fails (returns true) because it only checks for the presence of "prefers-color-scheme"
    expect(logic.checksPreferredScheme()).toBe(false);
  });

  it("checksPreferredScheme should return true only for 'prefers-color-scheme: dark'", () => {
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
  });

  it('classifyTextColor should ignore light text on a light background', () => {
    // Add a paragraph with white text on white background (e.g. hidden or decorative)
    document.body.innerHTML =
      '<p id="p1" style="color: white; background-color: white;">Hidden Text</p>';

    // We need to mock getComputedStyle for the specific elements
    global.getComputedStyle = (el) => {
      return {
        color: el.style.color || 'black',
        backgroundColor: el.style.backgroundColor || 'white',
        visibility: el.style.visibility || 'visible',
        display: el.style.display || 'block',
      };
    };

    // It should NOT be detected as "light" because the background is also light.
    // Given the current implementation, it will probably return "dark" or null.
    expect(logic.classifyTextColor(document)).not.toBe('light');
  });
});
