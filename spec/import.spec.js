import {
  api,
  getSiteSettings,
  getEnabled,
  resetSiteSchemes,
} from '../common.js';
import { onImport, init } from '../options.js';
import { expect } from 'expect';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import { FakeStorage } from './options.spec.js';

api.storage = {local: new FakeStorage(), sync: new FakeStorage()};
global.chrome = {
    ...api,
    runtime: {
        ...api.runtime,
        getURL: (path) => path,
        sendMessage: async () => ({})
    }
};

describe("Import functionality", () => {
  let dom;
  const originalSetTimeout = global.setTimeout;

  beforeEach(async () => {
    const optionsHtml = fs.readFileSync(
      new URL("../options.html", import.meta.url), 'utf-8');
    dom = new JSDOM(optionsHtml, {
        url: "chrome://extensions/options.html"
    });
    global.window = dom.window;
    global.document = dom.window.document;
    
    // Mock setTimeout to suppress the 1s UI refresh timer
    global.setTimeout = (cb, delay, ...args) => {
        if (delay > 100) {
            return 0;
        }
        return originalSetTimeout(cb, delay, ...args);
    };

    await resetSiteSchemes();
    // Ensure import elements exist in the DOM (they are in options.html now)
    await init();
  });

  afterEach(() => {
    global.setTimeout = originalSetTimeout;
    delete global.window;
    delete global.document;
  });

  it("imports V1 legacy settings correctly", async function() {
    const legacyData = {
        "enabled": "true",
        "scheme": "delumine-smart",
        "sitemodifiers": "{\"example.com\": \"low_contrast\"}",
        "siteschemes": "{\"example.com\": \"delumine-no-invert\"}"
    };
    
    const textarea = dom.window.document.getElementById('import_data');
    textarea.value = JSON.stringify(legacyData);
    
    await onImport();

    // Verify global settings
    expect(getEnabled()).toBe(true);

    // Verify site settings
    const siteSettings = getSiteSettings("example.com");
    expect(siteSettings.filter).toBe("normal");
    expect(siteSettings.mods).toContain("low_contrast");
  });

  it("imports V2 settings correctly", async function() {
      const v2Data = {
          "version": 2,
          "enabled": false,
          "sites": [
              ["test.com", "dim1", "killbg"]
          ]
      };

      const textarea = dom.window.document.getElementById('import_data');
      textarea.value = JSON.stringify(v2Data);

      await onImport();

      expect(getEnabled()).toBe(false);

      const siteSettings = getSiteSettings("test.com");
      expect(siteSettings.filter).toBe("dim1");
      expect(siteSettings.mods).toContain("killbg");
  });

  it("handles invalid JSON gracefully", async function() {
      const textarea = dom.window.document.getElementById('import_data');
      textarea.value = "INVALID JSON";
      
      const status = dom.window.document.getElementById('import_status');
      
      // Spy on console.error to avoid polluting output
      const consoleSpy = { error: () => {} };
      const originalConsole = global.console;
      global.console = { ...originalConsole, ...consoleSpy };

      try {
        await onImport();
        expect(status.textContent).toContain("Error");
      } finally {
          global.console = originalConsole;
      }
  });

  it("handles empty input gracefully", async function() {
    const textarea = dom.window.document.getElementById('import_data');
    textarea.value = "   ";
    
    await onImport();
    
    const status = dom.window.document.getElementById('import_status');
    expect(status.textContent).toContain("Error: No data provided");
  });
});
