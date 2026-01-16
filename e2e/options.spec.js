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
      // Wait for background migration to finish to prevent overwrites
      await new Promise(resolve => {
        const check = () => {
          chrome.storage.local.get(['migrationComplete'], (res) => {
            if (res.migrationComplete === 2) resolve();
            else setTimeout(check, 100);
          });
        };
        check();
      });
      
      // mimic setSiteScheme logic or just write to storage directly if we know the structure
      // Structure: sites: [[url, filter, ...modifiers]]
      const sites = [[domain, 'dim1']];
      await chrome.storage.sync.set({ sites });
      const check = await chrome.storage.sync.get('sites');
      if (!check.sites || check.sites.length === 0) throw new Error('Failed to set storage');
    }, site);

    // 2. Reload to see the changes
    await page.waitForTimeout(500);
    await page.reload();

    // 3. Verify site is listed
    const settingsList = page.locator('#settings');
    await expect(settingsList).toContainText(site);
    await expect(settingsList).toContainText('dim1');

    // 4. Click delete button
    const deleteBtn = page.locator('.delete-button').first();
    await deleteBtn.click();

    // 5. Verify it disappears from UI
    await expect(settingsList).not.toContainText(site);

    // 6. Verify it is gone from storage
    await expect.poll(async () => {
        const storedSites = await page.evaluate(async () => {
            const data = await chrome.storage.sync.get('sites');
            return data.sites || [];
        });
        // Filter out the default setting (empty URL) which might be persisted
        return storedSites.filter(s => s[0] !== "");
    }).toHaveLength(0);
  });
});
