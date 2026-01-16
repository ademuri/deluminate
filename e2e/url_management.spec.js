import { test, expect } from './fixtures.js';

test.describe('URL Management', () => {
  test('applies domain-wide settings', async ({ page, context, server, extensionId }) => {
    // 1. Open content page
    await page.goto(`${server}/basic.html`);
    const html = page.locator('html');
    
    // Default: Inverted
    await expect(html).toHaveAttribute('hc', /.+/); 

    // 2. Open Popup
    const popupPage = await context.newPage();
    const targetUrl = encodeURIComponent(`${server}/basic.html`);
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html?tabUrl=${targetUrl}`);
    
    // 3. Verify selector is present
    const domainSpan = popupPage.locator('#selector #domain');
    await expect(domainSpan).toBeVisible();
    
    // 4. Select "Normal" (disable inversion) for the domain
    // By default, the domain should be selected (ending at the domain root)
    await expect(domainSpan).toHaveClass(/end/);
    await popupPage.locator('input[value="normal"]').click();

    // 5. Check content page
    await expect(html).not.toHaveAttribute('hc');
    
    // 6. Navigate to another page on same domain
    await page.goto(`${server}/images.html`);
    const html2 = page.locator('html');
    await expect(html2).not.toHaveAttribute('hc');
  });

  test('applies path-specific settings', async ({ page, context, server, extensionId }) => {
    // 1. Open content page
    await page.goto(`${server}/basic.html`);
    const html = page.locator('html');
    
    // Default: Inverted
    await expect(html).toHaveAttribute('hc', /.+/); 

    // 2. Open Popup
    const popupPage = await context.newPage();
    const targetUrl = encodeURIComponent(`${server}/basic.html`);
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html?tabUrl=${targetUrl}`);
    
    // 3. Select the specific page path
    // The selector renders paths as spans with class 'path'
    // For `.../basic.html`, we expect a path span with text `basic.html`
    const pathSpan = popupPage.locator('#selector').getByText('basic.html');
    await expect(pathSpan).toBeVisible();
    await pathSpan.click();
    
    // Verify it is selected (should have 'end' class or similar, logic is tricky)
    // UrlSelector logic: clicking path adds 'end' to it.
    await expect(pathSpan).toHaveClass(/end/);

    // 4. Select "Normal" for this path
    await popupPage.locator('input[value="normal"]').click();

    // 5. Check content page (basic.html) is normal
    await expect(html).not.toHaveAttribute('hc');

    // 6. Navigate to another page (images.html)
    // Should still be inverted because we only disabled basic.html
    await page.goto(`${server}/images.html`);
    const html2 = page.locator('html');
    await expect(html2).toHaveAttribute('hc', /.+/);
  });
});
