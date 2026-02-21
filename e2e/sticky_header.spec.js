import { test, expect } from './fixtures.js';

test.describe('Options Page Sticky Header', () => {
  test('header stays visible when scrolling', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/options.html`);

    // 1. Populate many sites to trigger scroll
    await page.evaluate(async () => {
      const sites = [];
      for (let i = 0; i < 50; i++) {
        sites.push([`site${i}.com`, 'smart']);
      }
      await chrome.storage.sync.set({ sites });
    });

    // 2. Reload to see sites
    await page.reload();

    const settingsDiv = page.locator('#settings');
    const header = page.locator('#settings-heading > span:has-text("Website")');

    // Check initial position of header
    const initialBox = await header.boundingBox();
    expect(initialBox.y).toBeGreaterThan(0);

    // 3. Scroll down in the #settings div
    await settingsDiv.evaluate((el) => (el.scrollTop = 500));

    // 4. Verify header position is still the same relative to the viewport
    const scrolledBox = await header.boundingBox();

    // The header should still be at the top of the scroll container.
    // If it wasn't sticky, it would have scrolled up and out of view.
    expect(scrolledBox.y).toBeCloseTo(initialBox.y, 1);

    // 5. Verify it's still visible
    await expect(header).toBeVisible();
  });
});
