
import { describe, it, beforeEach, afterEach } from 'mocha';
import assert from 'node:assert';
import { api } from '../common.js';

class FakeStorage {
	constructor() {
		this.store = {};
	}
	async set(items) {
		Object.assign(this.store, items);
	}
	async get(keys) {
        // Simulate a hang by returning a promise that never resolves (or resolves after a long time)
        // But for the test to finish, we want it to timeout. 
        // Our background.js timeout is 10s. We don't want to wait 10s in a test.
        // We can mock the timeout behavior or the Promise.race logic? No, `background.js` has hardcoded 10000.
        // We can use fake timers?
        return new Promise(() => {}); // Never resolves
	}
	async remove(keys) {
	}
    clear() {}
}

describe('Initialization Timeout', () => {
  let listeners = {};
  let injectCalls = [];
  let originalChrome;
  let originalApiStorage;
  let clock;

  beforeEach(async () => {
    listeners = {};
    injectCalls = [];
    originalChrome = global.chrome;
    originalApiStorage = api ? api.storage : undefined;
    
    global.chrome = {
      runtime: {
        id: 'fake-id',
        onMessage: { addListener: () => {} },
        onInstalled: { addListener: () => {} },
        lastError: null,
        getManifest: () => ({ version: '1.0' }),
        getURL: (path) => path,
      },
      tabs: {
        onUpdated: { addListener: () => {} },
        onReplaced: { addListener: () => {} },
        query: () => Promise.resolve([]),
      },
      windows: {
        getAll: () => Promise.resolve([{ tabs: [{ id: 1, url: 'https://example.com' }] }])
      },
      scripting: {
        executeScript: (opts) => {
            injectCalls.push(opts);
            return Promise.resolve();
        },
        insertCSS: () => Promise.resolve()
      },
      storage: {
          sync: new FakeStorage(), // This one hangs
          local: { get: () => Promise.resolve({}), set: () => Promise.resolve() },
          onChanged: { addListener: () => {} }
      },
      commands: { onCommand: { addListener: () => {} } },
      action: { setTitle: () => {} }
    };

    if (api) api.storage = global.chrome.storage;
    
    // We can't easily mock the 10s timeout inside background.js without fake timers.
    // However, Mocha doesn't support fake timers for native Promises easily unless we swap global.setTimeout.
    
    // Let's swap global.setTimeout
    const originalSetTimeout = global.setTimeout;
    global.setTimeout = (cb, ms) => {
        if (ms === 10000) {
            // Immediately trigger the timeout callback for the test
            cb();
            return 123;
        }
        return originalSetTimeout(cb, ms);
    };
    global.setTimeout.original = originalSetTimeout;

    // Mock navigator
    global.navigator = { appVersion: 'Linux' };
  });

  afterEach(() => {
    if (api && originalApiStorage) {
        api.storage = originalApiStorage;
    }
    delete global.navigator;
    if (global.setTimeout.original) {
        global.setTimeout = global.setTimeout.original;
    }
    global.chrome = originalChrome;
  });

  it('should proceed to injection even if sync hangs', async () => {
    // Import background.js to trigger init()
    // Use query string to force re-import
    await import('../background.js?t=' + Date.now());

    // Wait a bit for the async logic to settle
    await new Promise(resolve => setTimeout(resolve, 50));

    // Check if injection happened
    assert.strictEqual(injectCalls.length, 1, 'Should have attempted injection despite sync hang');
  });
});
