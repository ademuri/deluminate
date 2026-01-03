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
});