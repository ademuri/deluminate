import {
  api,
  setSiteScheme,
  addSiteModifier,
  changedFromDefault,
  resetSiteSchemes,
} from '../common.js';
import { onForget, init } from '../options.js';
import { expect } from 'expect';
import { JSDOM } from 'jsdom';
import fs from 'fs';

export class FakeStorage {
	constructor() {
		this.store = {};
	}
	async set(items) {
		Object.assign(this.store, items);
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

api.storage = {local: new FakeStorage(), sync: new FakeStorage()};
global.chrome = {
    ...api,
    runtime: {
        ...api.runtime,
        getURL: (path) => path,
        sendMessage: async () => ({})
    }
};

describe("Available options", () => {
  let dom;
  beforeEach(async () => {
    const optionsHtml = fs.readFileSync(
      new URL("../options.html", import.meta.url), 'utf-8');
    dom = new JSDOM(optionsHtml, {
        url: "chrome://extensions/options.html"
    });
    global.window = dom.window;
    global.document = dom.window.document;
    
    await resetSiteSchemes();
    await init();
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
  });

  it("can forget all site-specific settings", async function() {
    setSiteScheme("options.deluminate.github.io", 'normal');
    addSiteModifier("options.deluminate.github.io", 'low_contrast');

    expect(changedFromDefault("options.deluminate.github.io")).toBe(true);

    const forgetButton = dom.window.document.getElementById('forget');
    forgetButton.click();
    
    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(changedFromDefault("options.deluminate.github.io")).toBe(false);
  });

  it("renders saved site settings in the list", async function() {
    await setSiteScheme("example.com", "dim1");
    await init(); // re-init to load settings

    const settingsDiv = dom.window.document.getElementById('settings');
    // We expect a row for the heading + a row for example.com
    // The implementation creates divs directly in #settings, not a table.
    // Heading: #settings-heading.
    // Row: div with 4 spans/buttons.
    
    // Check if "example.com" text is present
    expect(settingsDiv.textContent).toContain("example.com");
    expect(settingsDiv.textContent).toContain("dim1");
  });

  it("deletes a site setting via the UI delete button", async function() {
    await setSiteScheme("todelete.com", "smart");
    await init();

    const settingsDiv = dom.window.document.getElementById('settings');
    const deleteButtons = settingsDiv.getElementsByClassName('delete-button');
    expect(deleteButtons.length).toBeGreaterThan(0);

    // Click the first delete button (should correspond to our site as it's the only one added)
    deleteButtons[0].click();

    // Wait for async operations (storage update)
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify it's gone from storage
    expect(changedFromDefault("todelete.com")).toBe(false);
    
    // Verify it's removed from DOM
    expect(settingsDiv.textContent).not.toContain("todelete.com");
  });
});

  