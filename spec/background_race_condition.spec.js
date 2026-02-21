import { describe, it, beforeEach, afterEach } from 'mocha';
import assert from 'node:assert';
import { resetSiteSchemes, api } from '../common.js';

class FakeStorage {
  constructor() {
    this.store = {};
  }
  async set(items) {
    Object.assign(this.store, items);
  }
  async get(keys) {
    if (typeof keys === 'undefined') {
      return this.store;
    } else if (typeof keys === 'string') {
      keys = [keys];
    }
    const result = {};
    for (const key of keys) {
      result[key] = this.store[key];
    }
    return result;
  }
  async remove(keys) {
    if (typeof keys === 'undefined') {
      return;
    }
    if (typeof keys === 'string') {
      keys = [keys];
    }
    for (const key of keys) {
      delete this.store[key];
    }
  }
  clear() {
    this.store = {};
  }
}

describe('Background Script Injection Logic', () => {
  let listeners = {};
  let executeScriptCalls = [];
  let sendMessageCalls = [];
  let chromeMock;

  let originalChrome, originalWindow, originalNavigator;

  beforeEach(async () => {
    listeners = {};
    executeScriptCalls = [];
    sendMessageCalls = [];

    // Save originals
    originalChrome = global.chrome;
    originalWindow = global.window;
    originalNavigator = Object.getOwnPropertyDescriptor(global, 'navigator');

    // Mock chrome global
    chromeMock = {
      tabs: {
        onUpdated: {
          addListener: (cb) => {
            listeners['onUpdated'] = cb;
          },
        },
        onReplaced: {
          addListener: (cb) => {
            listeners['onReplaced'] = cb;
          },
        },
        sendMessage: (tabId, msg, opts, cb) => {
          sendMessageCalls.push({ tabId, msg, opts, cb });
          // Default behavior: success (no lastError)
          // Tests can set chrome.runtime.lastError before calling cb if needed
          if (cb) cb({});
        },
        query: (opts, cb) => {
          if (cb) cb([]);
          return Promise.resolve([]);
        },
      },
      runtime: {
        id: 'fake-id',
        onMessage: {
          addListener: (cb) => {
            listeners['onMessage'] = cb;
          },
        },
        onInstalled: {
          addListener: (cb) => {
            listeners['onInstalled'] = cb;
          },
        },
        lastError: null,
        getManifest: () => ({ version: '1.0' }),
        getURL: (path) => path,
        sendMessage: (msg) => Promise.resolve(),
      },
      storage: {
        sync: new FakeStorage(),
        local: {
          get: () => Promise.resolve({ migrationComplete: 2 }),
          set: () => Promise.resolve(),
        },
        onChanged: {
          addListener: (cb) => {
            listeners['storage.onChanged'] = cb;
          },
        },
      },
      scripting: {
        executeScript: (opts) => {
          executeScriptCalls.push(opts);
          return Promise.resolve([{ result: null }]);
        },
        insertCSS: () => Promise.resolve(),
      },
      windows: {
        getAll: (opts, cb) => {
          if (cb) cb([]);
          return Promise.resolve([]);
        },
      },
      action: {
        setTitle: () => {},
      },
      commands: {
        onCommand: {
          addListener: (cb) => {
            listeners['onCommand'] = cb;
          },
        },
      },
      offscreen: {
        createDocument: () => Promise.resolve(),
      },
    };

    global.chrome = chromeMock;

    // Patch api.storage if api exists (was imported)
    // If common.js loaded before, api is {}, we patch it.
    // If common.js loads now, it uses global.chrome, so it uses chromeMock.storage (FakeStorage).
    if (api) {
      api.storage = chromeMock.storage;
    }

    global.window = {}; // needed for common.js possibly? No, it checks typeof chrome

    // global.navigator might be read-only
    try {
      global.navigator = { appVersion: 'Linux' };
    } catch (e) {
      Object.defineProperty(global, 'navigator', {
        value: { appVersion: 'Linux' },
        writable: true,
        configurable: true,
      });
    }

    // Reset modules
    // Since we are using ESM, we can't easily "unload" the module.
    // However, we can re-import it with a query string to force re-evaluation if the environment supports it,
    // or we just have to rely on the fact that `init()` runs on import.
    // But `background.js` executes `init()` at top level.
    // We need to re-import `background.js` for each test to get fresh listeners.
    // A trick is to use a timestamp.
    const backgroundPath = '../background.js?t=' + Date.now();
    await import(backgroundPath);
  });

  afterEach(async () => {
    // Clean up common.js state
    try {
      await resetSiteSchemes();
    } catch (e) {
      console.error('Failed to reset site schemes:', e);
    }

    // Restore originals
    if (originalChrome) global.chrome = originalChrome;
    else delete global.chrome;
    if (originalWindow) global.window = originalWindow;
    else delete global.window;

    if (originalNavigator) {
      Object.defineProperty(global, 'navigator', originalNavigator);
    } else {
      // If it didn't exist or we can't restore perfectly, at least try to delete if configurable
      // or just leave it if it was default.
      // Assuming deletion is what we want if it wasn't there.
      try {
        delete global.navigator;
      } catch (e) {}
    }
  });

  it('should attempt injection when tab status is loading', async () => {
    const onUpdated = listeners['onUpdated'];
    assert.ok(onUpdated, 'onUpdated listener should be registered');

    // Simulate tab update "loading"
    const tabId = 123;
    const changeInfo = { status: 'loading' };
    const tab = { id: tabId, url: 'https://example.com' };

    // Set lastError to simulate content script NOT present, so ping fails
    chrome.runtime.lastError = { message: 'No receiver' };

    // We need to intercept the ping call to trigger the callback with error
    let pingCalled = false;
    chrome.tabs.sendMessage = (tid, msg, opts, cb) => {
      if (tid === tabId && msg.pingTab) {
        pingCalled = true;
        cb(); // chrome.runtime.lastError is set globally
      }
    };

    onUpdated(tabId, changeInfo, tab);

    assert.ok(pingCalled, 'Should have pinged the tab');

    // Wait for async injection logic
    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.strictEqual(executeScriptCalls.length, 1, 'Should have called executeScript');
    assert.deepStrictEqual(executeScriptCalls[0].files, ['content_logic.js', 'deluminate.js']);
  });

  it('should attempt injection when tab status is complete', async () => {
    const onUpdated = listeners['onUpdated'];
    assert.ok(onUpdated, 'onUpdated listener should be registered');

    // Simulate tab update "complete"
    const tabId = 456;
    const changeInfo = { status: 'complete' }; // Only status, no URL
    const tab = { id: tabId, url: 'https://example.com' };

    chrome.runtime.lastError = { message: 'No receiver' };

    let pingCalled = false;
    chrome.tabs.sendMessage = (tid, msg, opts, cb) => {
      if (tid === tabId && msg.pingTab) {
        pingCalled = true;
        cb();
      }
    };

    onUpdated(tabId, changeInfo, tab);

    assert.strictEqual(pingCalled, true, 'Should have pinged the tab');

    // Wait for async injection logic
    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.strictEqual(executeScriptCalls.length, 1, 'Should have called executeScript');
  });

  it('should attempt injection when ping response is missing (ghost script)', async () => {
    const onUpdated = listeners['onUpdated'];
    assert.ok(onUpdated, 'onUpdated listener should be registered');

    const tabId = 789;
    const changeInfo = { status: 'complete' };
    const tab = { id: tabId, url: 'https://example.com' };

    // lastError is null (simulating successful message delivery but no response)
    chrome.runtime.lastError = null;

    let pingCalled = false;
    chrome.tabs.sendMessage = (tid, msg, opts, cb) => {
      if (tid === tabId && msg.pingTab) {
        pingCalled = true;
        // Callback with no response (undefined)
        cb();
      }
    };

    onUpdated(tabId, changeInfo, tab);

    assert.strictEqual(pingCalled, true, 'Should have pinged the tab');

    // Wait for async injection logic
    await new Promise((resolve) => setTimeout(resolve, 10));

    assert.strictEqual(
      executeScriptCalls.length,
      1,
      'Should have called executeScript because response was missing',
    );
  });
});
