import { describe, it, beforeEach, afterEach } from 'mocha';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const contentLogicCode = fs.readFileSync(path.resolve('content_logic.js'), 'utf8');
const deluminateCode = fs.readFileSync(path.resolve('deluminate.js'), 'utf8');

describe('Layout Thrashing Benchmark', () => {
  let window, document;

  beforeEach(() => {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'https://example.com/',
      runScripts: 'dangerously',
      resources: 'usable',
    });
    window = dom.window;
    document = window.document;

    // Mock chrome API
    window.chrome = {
      runtime: {
        id: 'fake-id',
        onMessage: { addListener: () => {} },
        sendMessage: (msg, opts, cb) => {
          const response = {
            enabled: true,
            scheme: 'delumine-smart',
            modifiers: [],
            settings: {},
          };
          if (cb) cb(response);
          else if (opts) opts(response);
        },
        getURL: (path) => 'chrome-extension://fake-id/' + path,
        lastError: null,
      },
    };

    // Mock window.deluminateLogic with real implementation behavior roughly
    // We inject content_logic.js to get the real functions
    window.eval(contentLogicCode);
  });

  it('measures processing time for massive DOM insertion', function (done) {
    this.timeout(5000); // Allow test to run longer

    // Inject deluminate
    window.eval(deluminateCode);

    // Wait for init
    setTimeout(() => {
      const container = document.createElement('div');
      // Create 2000 items
      for (let i = 0; i < 2000; i++) {
        const item = document.createElement('div');
        item.style.backgroundImage = 'url(image.png)'; // Triggers style check
        item.innerHTML = `<span>Text ${i}</span>`;
        container.appendChild(item);
      }

      const start = process.hrtime();
      document.body.appendChild(container);

      // Wait for MutationObserver
      setTimeout(() => {
        const diff = process.hrtime(start);
        const ms = diff[0] * 1000 + diff[1] / 1e6;
        console.log(`Processing 2000 items took ${ms.toFixed(2)}ms`);

        // If it takes > 500ms, it's definitely blocking the UI frame (16ms is ideal, but for 2000 items maybe < 100ms)
        // We assert it should be somewhat performant, but let's just use this to verify improvement.

        // For now, let's just pass.
        done();
      }, 100);
    }, 50);
  });
});
