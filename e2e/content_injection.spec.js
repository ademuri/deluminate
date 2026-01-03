import { test, expect } from './fixtures.js';

test.describe('Content Injection', () => {
  test('injects styles into a basic page', async ({ page, server }) => {
    await page.goto(`${server}/basic.html`);

    // Wait for the "hc" attribute to appear on the html element.
    // This indicates deluminate.js has run and applied settings.
    const html = page.locator('html');
    await expect(html).toHaveAttribute('hc', /.+/);

    // Verify computed styles are applied.
    // Deluminate applies filters based on the 'hc' attribute via deluminate.css
    await expect(html).toHaveCSS('filter', /invert/);
  });
});
