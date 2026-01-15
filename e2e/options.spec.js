import { test, expect } from './fixtures.js';

test.describe('Options Page', () => {
  test('persists global animation setting', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    
    // 1. Check default state
    const select = page.locator('#detect_animation');
    await expect(select).toHaveValue('disabled');

    // 2. Change setting
    await select.selectOption('enabled');

    // 3. Reload page to verify persistence
    await page.reload();
    await expect(select).toHaveValue('enabled');
    
    // 4. Verify storage (optional, but good for confirmation)
    const storageValue = await page.evaluate(async () => {
      const data = await chrome.storage.sync.get('settings');
      return data.settings?.detect_animation;
    });
    expect(storageValue).toBe('enabled');
  });

  test('displays and deletes saved site settings', async ({ page, extensionId }) => {
    const site = 'example.com';
    
    // 1. Pre-seed storage with a site setting
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.evaluate(async (domain) => {
      // mimic setSiteScheme logic or just write to storage directly if we know the structure
      // Structure: sites: [[url, filter, ...modifiers]]
      const sites = [[domain, 'dim']];
      await chrome.storage.sync.set({ sites });
    }, site);

    // 2. Reload to see the changes
    await page.reload();

    // 3. Verify site is listed
    const settingsList = page.locator('#settings');
    await expect(settingsList).toContainText(site);
    await expect(settingsList).toContainText('dim');

    // 4. Click delete button
    const deleteBtn = page.locator('.delete-button').first();
    await deleteBtn.click();

    // 5. Verify it disappears from UI
    await expect(settingsList).not.toContainText(site);

    // 6. Verify it is gone from storage
    const storedSites = await page.evaluate(async () => {
        const data = await chrome.storage.sync.get('sites');
        return data.sites || [];
    });
    expect(storedSites).toHaveLength(0);
  });
});
