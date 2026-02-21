import { test, expect } from './fixtures.js';

test.describe('Dynamic Dark Site Detection', () => {
  test('should NOT detect a light site as dark even if it mentions prefers-color-scheme', async ({ page, context, server, extensionId }) => {
    // 1. Create a light page that mentions prefers-color-scheme
    // We'll use a data URL or just rely on a new fixture if needed, but for now let's try a data URL for simplicity if possible,
    // though Playwright's extension testing works better with the server.
    // Let's use the server and a new fixture.
    
    await page.goto(`${server}/light_with_query.html`);
    const html = page.locator('html');

    // 2. Enable "Avoid Inverting Dark Sites" (dynamic) in popup
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    
    // Ensure we are in smart mode
    await popupPage.locator('input[value="smart"]').click();
    // Toggle dynamic (if not already on)
    const dynamicCheckbox = popupPage.locator('input#dynamic');
    const isChecked = await dynamicCheckbox.isChecked();
    if (!isChecked) {
      await dynamicCheckbox.click();
    }

    // 3. Check if it's inverted (it SHOULD be, because it's a light site)
    // If it's NOT inverted, it means 'looks-dark' was set.
    await page.bringToFront();
    
    // We might need to wait a bit for detection to run
    await expect(html).toHaveAttribute('hc', /delumine-smart/);
    await expect(html).toHaveAttribute('hc', /dynamic/);
    
    // If detection wrongly thinks it's dark, it will set 'looks-dark'
    // and the CSS will NOT apply the inversion filter to the body.
    await expect(html).not.toHaveAttribute('looks-dark');
  });

  test('should detect a truly dark site as dark', async ({ page, context, server, extensionId }) => {
    await page.goto(`${server}/dark_site.html`);
    const html = page.locator('html');

    // Enable dynamic in popup
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.locator('input[value="smart"]').click();
    const dynamicCheckbox = popupPage.locator('input#dynamic');
    if (!await dynamicCheckbox.isChecked()) {
      await dynamicCheckbox.click();
    }

    await page.bringToFront();
    // It SHOULD have 'looks-dark' attribute
    await expect(html).toHaveAttribute('looks-dark', '');
  });
});
