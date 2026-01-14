
import { describe, it, beforeEach, afterEach } from 'mocha';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// We need to load the modules. Since they are ES modules, we can import them directly 
// if we were running in a browser, but in Node/Mocha we are loading them into JSDOM.
// For unit testing specific functions, we can rely on how spec/content_logic.spec.js does it,
// or import the source files if they are pure JS.
// checking spec/content_logic.spec.js might be useful first, but I'll try to import directly for the cache test.

import { colorToRGBA } from '../content_logic.js';

const deluminatePath = path.resolve('deluminate.js');
const deluminateCode = fs.readFileSync(deluminatePath, 'utf8');

describe('Performance & Resource Usage', () => {

  describe('Memory Leaks', () => {
    it('colorToRGBA cache should not grow unbounded', () => {
      const initialSize = Object.keys(colorToRGBA._cache).length;
      
      // Simulate processing many distinct colors
      for (let i = 0; i < 10000; i++) {
        colorToRGBA(`rgb(${i % 255}, ${Math.floor(i / 255) % 255}, 0)`);
      }

      const finalSize = Object.keys(colorToRGBA._cache).length;
      // Ideally, a cache should have a limit. 10,000 unique keys is a lot for a color cache 
      // if the page has dynamic content.
      // Let's assert that it has a reasonable limit, say 1000 (arbitrary but safe).
      // If it fails, we know it's unbounded.
      assert.ok(finalSize < 2000, `Cache size ${finalSize} is too large, indicating a memory leak.`);
    });
  });

  describe('Layout Thrashing (Smart Inversion)', () => {
    let dom;
    let window;
    let document;
    
    beforeEach(() => {
      dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
        url: 'https://example.com/',
        runScripts: 'dangerously',
        resources: 'usable'
      });
      window = dom.window;
      document = window.document;
      
      // Mock chrome API
      window.chrome = {
        runtime: {
          id: 'fake-id',
          onMessage: { addListener: () => {} },
          sendMessage: (msg, opts, cb) => {
             // Respond as if Smart Inversion is enabled
             const response = { 
               enabled: true, 
               scheme: 'delumine-smart', // Triggers image processing
               modifiers: [], 
               settings: {} 
             };
             if (cb) setTimeout(() => cb(response), 0);
             else if (opts) setTimeout(() => opts(response), 0);
          },
          getURL: (path) => 'chrome-extension://fake-id/' + path,
          lastError: null
        }
      };
      
      // Mock window.deluminateLogic needed by deluminate.js
      window.deluminateLogic = {
         getBgImageType: (tag) => {
            // Real implementation calls getComputedStyle
            return window.getComputedStyle(tag)['background-image'] ? 'unknown' : null;
         },
         markCssImages: (tag) => {
            // Real implementation calls getComputedStyle
            window.getComputedStyle(tag)['background-image'];
         },
         classifyTextColor: () => {},
         checksPreferredScheme: () => {}
      };
    });

    afterEach(() => {
      delete global.window;
      delete global.document;
    });

    it('should verify getComputedStyle usage during bulk insertion', (done) => {
      // Spy on getComputedStyle
      let styleCallCount = 0;
      const originalGetComputedStyle = window.getComputedStyle;
      window.getComputedStyle = (elt, pseudo) => {
        styleCallCount++;
        return originalGetComputedStyle(elt, pseudo);
      };

      // Inject deluminate
      window.eval(deluminateCode);

      // Allow init to finish
      setTimeout(() => {
        // Reset count after init
        styleCallCount = 0;

        // Simulate adding a feed of items (e.g., 100 items)
        const container = document.createElement('div');
        for(let i=0; i<100; i++) {
          const item = document.createElement('div');
          item.className = 'feed-item';
          item.innerHTML = '<span>Text</span><img src="icon.png">';
          container.appendChild(item);
        }
        
        // Append to body - this triggers MutationObserver
        document.body.appendChild(container);

        // Wait for MutationObserver (microtask/next loop)
        setTimeout(() => {
           // With 100 items + children, how many times is getComputedStyle called?
           // The observer queries *:not([style*="url"]).
           // Structure: div(container) -> 100 * [div(item) -> span, img]
           // MutationObserver sees the container.
           // inner loop: queries container.querySelectorAll(...)
           // For each item (3 nodes per item: div, span, img), it calls markCssImages.
           // Expected: ~300 calls.
           
           // console.log(`getComputedStyle called ${styleCallCount} times for 100 items.`);
           
           // If we are strictly checking for performance, we might want to ensure we aren't 
           // calling it more than necessary.
           // For now, this test is informational, but we can assert a baseline.
           // If it was 0, the feature isn't working. If it's huge, it's thrashing.
           assert.ok(styleCallCount > 0, "Should attempt to style images");
           
           // If we were batching or optimizing, we might expect fewer.
           // But currently we expect O(N) where N is total nodes.
           
           done();
        }, 50);
      }, 50);
    });
  });
});
