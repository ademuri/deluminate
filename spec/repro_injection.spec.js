
import { describe, it, beforeEach, afterEach } from 'mocha';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

const contentLogicPath = path.resolve('content_logic.js');
const deluminatePath = path.resolve('deluminate.js');
const contentLogicCode = fs.readFileSync(contentLogicPath, 'utf8');
const deluminateCode = fs.readFileSync(deluminatePath, 'utf8');

describe('Deluminate Injection Safety', () => {
  let dom;
  let window;
  let document;
  let listenerCount = 0;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
      url: 'https://music.youtube.com/',
      runScripts: 'dangerously',
      resources: 'usable'
    });
    window = dom.window;
    document = window.document;

    // Mock chrome API
    window.chrome = {
      runtime: {
        id: 'fake-id',
        onMessage: {
          addListener: () => {}
        },
        sendMessage: (msg, opts, cb) => {
           const response = { enabled: true, scheme: 'normal', modifiers: [], settings: {} };
           if (cb) setTimeout(() => cb(response), 0);
           else if (opts) setTimeout(() => opts(response), 0);
        },
        getURL: (path) => 'chrome-extension://fake-id/' + path
      }
    };

    // Mock addEventListener to count
    const originalAddEventListener = document.addEventListener;
    document.addEventListener = function(type, listener, options) {
      if (type === 'keydown') {
        listenerCount++;
      }
      return originalAddEventListener.call(this, type, listener, options);
    };
    
    // Setup initial environment (content_logic)
    // content_logic.js expects to run as module or script, but here we eval it.
    // It uses `export` syntax which eval doesn't like if treated as script.
    // However, content_logic.js in the repo is:
    // "export function ..."
    // We need to handle that. 
    // Actually, looking at content_logic.js, it has:
    // if (typeof window !== 'undefined') { window.deluminateLogic = ... }
    // So we can just mock window.deluminateLogic or strip exports.
    // Simpler: Just mock window.deluminateLogic since that's what deluminate.js consumes.
    
    window.deluminateLogic = {
      markCssImages: () => {},
      classifyTextColor: () => {},
      checksPreferredScheme: () => {}
    };
  });

  afterEach(() => {
    listenerCount = 0;
  });

  it('should duplicate listeners when injected multiple times without guard', () => {
    // First injection
    window.eval(deluminateCode);
    assert.strictEqual(listenerCount, 1);

    // Second injection
    window.eval(deluminateCode);
    assert.strictEqual(listenerCount, 1, 'Should prevent duplicate listeners');
  });
});
