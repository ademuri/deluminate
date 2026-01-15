import { test, expect } from './fixtures.js';

test.describe('Smart Image Inversion', () => {
  test('correctly reinverts JPG and WebP images but leaves PNGs inverted', async ({ page, server }) => {
    // 1. Navigate to the test page
    await page.goto(`${server}/images.html`);
    
    const html = page.locator('html');
    
    // 2. Ensure the extension is active (check for global attribute)
    // Default mode is usually smart invert
    await expect(html).toHaveAttribute('hc', /delumine-smart/);

    // 3. Verify IMG tags
    const jpgImg = page.locator('#jpg-img');
    const pngImg = page.locator('#png-img');
    const webpImg = page.locator('#webp-img');

    // JPG should be re-inverted (filter applied)
    await expect(jpgImg).toHaveCSS('filter', /invert\((100%|1)\)/);
    
    // WebP should be re-inverted
    await expect(webpImg).toHaveCSS('filter', /invert\((100%|1)\)/);

    // PNG should NOT be re-inverted (filter is none, so it stays inverted by global html filter)
    await expect(pngImg).toHaveCSS('filter', 'none');

    // 4. Verify Background Images
    const jpgBg = page.locator('#jpg-bg');
    const pngBg = page.locator('#png-bg');

    // Background images rely on deluminate.js detecting them and adding attributes
    // Wait for the attribute to be applied
    await expect(jpgBg).toHaveAttribute('deluminate_imageType', 'jpg');
    await expect(pngBg).toHaveAttribute('deluminate_imageType', 'png');

    // JPG Background should be re-inverted
    await expect(jpgBg).toHaveCSS('filter', /invert\((100%|1)\)/);

    // PNG Background should NOT be re-inverted
    await expect(pngBg).toHaveCSS('filter', 'none');
  });
});
