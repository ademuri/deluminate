import { test, expect } from './fixtures.js';

test.describe('Settings Interaction', () => {
  test('updates content when settings change', async ({ page, context, server, extensionId }) => {
    // 1. Open content page
    await page.goto(`${server}/basic.html`);
    const html = page.locator('html');
    
    // Default might depend on previous state or default settings, but usually it's enabled.
    // If not, we might need to enable it first. Assuming default is enabled or we can toggle it.
    // Let's assume default is "Smart Invert" or similar.
    await expect(html).toHaveAttribute('hc', /.+/); 

    // 2. Open Popup in a new page (tab)
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    
    // 3. Select "Normal" (disable inversion)
    await popupPage.locator('input[value="normal"]').click();

    // 4. Check content page
    // The change should be immediate via chrome.tabs.sendMessage
    await expect(html).not.toHaveAttribute('hc');
    
    // 5. Re-enable "Smart Invert"
    await popupPage.locator('input[value="smart"]').click();
    await expect(html).toHaveAttribute('hc', /delumine-smart/);
  });
});
