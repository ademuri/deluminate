import { test, expect } from './fixtures.js';

test.describe('Reload Resilience', () => {
  test('extension remains injected after page reload', async ({ page, server }) => {
    await page.goto(`${server}/basic.html`);

    const html = page.locator('html');
    // Initial load
    await expect(html).toHaveAttribute('hc', /.+/);
    
    // Reload the page
    await page.reload();

    // Verify injection happens again
    // If the race condition prevents "loading" injection and we didn't handle "complete", 
    // this might fail (flakily) without the fix, and pass consistently with the fix.
    await expect(html).toHaveAttribute('hc', /.+/);
    await expect(html).toHaveCSS('filter', /invert/);
  });
});
