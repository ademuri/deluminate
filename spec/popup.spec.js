import {
  api,
  getSiteSettings,
  setSiteScheme,
  addSiteModifier,
  resetSiteSchemes,
  changedFromDefault
} from '../common.js';
import { init } from '../popup.js';
import { expect } from 'expect';
import { JSDOM } from 'jsdom';
import fs from 'fs';

class FakeStorage {
	constructor() {
		this.store = {};
	}
	async set(key, value) {
		this.store[key] = value;
	}
	async get(keys) {
		if (typeof keys === "undefined") {
			return this.store;
		} else if (typeof keys === "string") {
			keys = [keys];
		}
		const result = {};
		for (const key of keys) {
			result[key] = this.store[key];
		}
		return result;
	}
	remove(keys) {
		if (typeof keys === "undefined") {
			return;
		}
		if (typeof keys === "string") {
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

// Mock chrome API
api.storage = {local: new FakeStorage(), sync: new FakeStorage()};
global.chrome = {
  ...api,
  runtime: {
    ...api.runtime,
    getURL: (path) => path,
    id: 'test-extension-id',
    sendMessage: async () => ({})
  },
  extension: {
    getBackgroundPage: function() {
      return {
        updateTabs: function() {}
      };
    },
    isAllowedFileSchemeAccess: async () => true
  },
  windows: {
      getLastFocused: async () => ({
          tabs: [{
              active: true,
              url: 'https://popup.deluminate.github.io/some/path'
          }]
      })
  },
  tabs: {
      create: () => {}
  }
};

describe("Popup options", () => {
  let dom;

  beforeEach(async () => {
    const popupHtml = fs.readFileSync(new URL("../popup.html", import.meta.url));
    dom = new JSDOM(popupHtml, {
        url: "https://popup.deluminate.github.io/some/path"
    });
    global.document = dom.window.document;
    global.window = dom.window;
    
    await resetSiteSchemes();
    await init();
  });

  it("can set the current site settings as the default", async function() {
    // Simulate changing settings via UI to trigger update()
    const allRadio = dom.window.document.querySelector('input[value="all"]');
    allRadio.click();
    
    const lowContrastCheckbox = dom.window.document.getElementById('low_contrast');
    lowContrastCheckbox.click();

    await new Promise(resolve => setTimeout(resolve, 0));

    // Verify state in common.js
    expect(getSiteSettings("popup.deluminate.github.io").filter).toEqual('all');
    expect([...getSiteSettings("popup.deluminate.github.io").mods]).toContain('low_contrast');
    
    // Simulate clicking "Make Default"
    const makeDefaultBtn = dom.window.document.getElementById('make_default');
    expect(makeDefaultBtn.disabled).toBe(false);
    makeDefaultBtn.click();
    
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(getSiteSettings().filter).toEqual('all');
    const defaultMods = [...getSiteSettings().mods];
    expect(defaultMods).toContain('low_contrast');
  });

  it("reports site settings unchanged by default", function() {
    const makeDefaultBtn = dom.window.document.getElementById('make_default');
    expect(makeDefaultBtn.disabled).toBe(true);
    expect(changedFromDefault("popup.deluminate.github.io")).toBe(false);
  });

  it("reports site settings changed when a scheme is changed", async function() {
    const normalRadio = dom.window.document.querySelector('input[value="normal"]');
    normalRadio.click();
    
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(changedFromDefault("popup.deluminate.github.io")).toBe(true);
    const makeDefaultBtn = dom.window.document.getElementById('make_default');
    expect(makeDefaultBtn.disabled).toBe(false);
  });

  it("reports site settings changed when a modifier is changed", async function() {
    const lowContrastCheckbox = dom.window.document.getElementById('low_contrast');
    lowContrastCheckbox.click();

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(changedFromDefault("popup.deluminate.github.io")).toBe(true);
    const makeDefaultBtn = dom.window.document.getElementById('make_default');
    expect(makeDefaultBtn.disabled).toBe(false);
  });
});