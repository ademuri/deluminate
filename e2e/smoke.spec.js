import { test, expect } from './fixtures.js';

test('Popup loads and renders correctly', async ({ page, extensionId }) => {
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(page.locator('#toggle')).toBeVisible();
  await expect(page.locator('input[value="normal"]')).toBeVisible();
  await expect(page.locator('input[value="smart"]')).toBeVisible();
});
