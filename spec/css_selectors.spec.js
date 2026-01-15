import * as fs from 'fs';
import * as path from 'path';
import { expect } from 'expect';
import { JSDOM } from 'jsdom';

describe("CSS Selector Logic", () => {
  let dom;
  let document;
  let styleSheet;

  before(() => {
    // specific setup to verify if JSDOM supports the selectors we use
    const cssContent = fs.readFileSync(path.resolve('deluminate.css'), 'utf8');
    dom = new JSDOM(`<!DOCTYPE html>
      <html hc="delumine-smart">
        <body>
            <img id="jpg-img" src="image.jpg">
            <img id="png-img" src="image.png">
            <img id="gif-img" src="image.gif">
            <img id="webp-img" src="image.webp">
            <div id="jpg-bg" deluminate_imageType="jpg"></div>
            <div id="png-bg" deluminate_imageType="png"></div>
        </body>
      </html>`, {
        resources: 'usable',
        runScripts: 'dangerously' // needed if we were running scripts, but for CSS maybe not
    });
    document = dom.window.document;
    
    // Inject CSS
    const style = document.createElement('style');
    style.textContent = cssContent;
    document.head.appendChild(style);
    
    // Force style computation (JSDOM does not fully implement cascading style sheets visual checks but matches() works if selector is valid)
    // However, getComputedStyle in JSDOM handles basic CSS. 
    // The critical part is if matches() works with :-webkit-any
  });

  it("should match JPG images for reinversion", () => {
    const img = document.getElementById('jpg-img');
    // We are looking for the rule that reinverts images.
    // The selector is massive.
    // html[hc*="delumine-smart"]:not([hc*="dynamic"][looks-dark]) body :-webkit-any(...)
    
    // Instead of checking computed style (which JSDOM might not calculate perfectly for complex selectors),
    // we can try to find the rule in the stylesheet or use matches().
    
    // But JSDOM's matches() implementation relies on nwsapi which might not support :-webkit-any
    
    // Let's try to see if the element matches the selector string extracted from CSS?
    // That's fragile.
    
    // Let's check computed style 'filter'.
    // JSDOM only supports computed styles if the style engine supports the selectors.
    
    const style = dom.window.getComputedStyle(img);
    // If matched, it should have filter: hue-rotate(180deg) invert(100%);
    // Note: The global html filter inverts everything. The rule for img reinverts it (double inversion = normal).
    // Wait, the rule says: filter: hue-rotate(180deg) invert(100%);
    // This applies to the IMG.
    
    // If JSDOM parses it, we get the value.
    // console.log('JPG Filter:', style.filter);
    
    // We expect it to be set.
    expect(style.filter).toContain('invert(100%)');
  });

  it("should NOT match PNG images for reinversion (they stay inverted)", () => {
    const img = document.getElementById('png-img');
    const style = dom.window.getComputedStyle(img);
    // console.log('PNG Filter:', style.filter);
    
    // Should NOT have the reinversion filter
    expect(style.filter).toBe(''); 
  });
});
