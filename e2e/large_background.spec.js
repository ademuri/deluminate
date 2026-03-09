import { test, expect } from './fixtures.js';

test('Avoid re-inverting large background elements', async ({ page, server }) => {
  // Navigate to the repro page
  await page.goto(`${server}/large_background.html`);

  // Ensure Deluminate is injected and active
  // Wait for the HTML attribute 'hc' to be set
  await expect(page.locator('html')).toHaveAttribute('hc', /delumine-smart/);

  const bgLayer = page.locator('.bg-layer');
  const content = page.locator('.content');
  const profilePhoto = page.locator('.profile-photo');

  // Add an element with style*="url" to test the CSS override
  await page.evaluate(() => {
    const div = document.createElement('div');
    div.id = 'style-url-test';
    div.style.backgroundImage = 'url("bg.webp")';
    div.style.width = '100vw';
    div.style.height = '100vh';
    div.style.position = 'fixed';
    div.style.top = '0';
    div.style.zIndex = '-2';
    document.body.appendChild(div);
  });

  const styleUrlTest = page.locator('#style-url-test');

  // Verify that small content images (like profile photos) still get re-inverted
  await expect(profilePhoto).toHaveAttribute('deluminate_imageType', 'jpg', { timeout: 10000 });

  // Verify that large background elements are NOT marked for re-inversion
  await expect(bgLayer).not.toHaveAttribute('deluminate_imageType');
  await expect(bgLayer).toHaveAttribute('deluminate_re_invert', 'false');

  // Verify that the style-url-test element (which would normally be re-inverted by CSS [style*="url"])
  // is ALSO correctly marked and NOT re-inverted thanks to the override
  await expect(styleUrlTest).toHaveAttribute('deluminate_re_invert', 'false', { timeout: 10000 });

  const bgComputedFilter = await bgLayer.evaluate((el) => window.getComputedStyle(el).filter);
  const profileComputedFilter = await profilePhoto.evaluate(
    (el) => window.getComputedStyle(el).filter,
  );
  const styleUrlTestFilter = await styleUrlTest.evaluate(
    (el) => window.getComputedStyle(el).filter,
  );
  const contentColor = await content.evaluate((el) => window.getComputedStyle(el).color);
  const htmlFilter = await page.evaluate(
    () => window.getComputedStyle(document.documentElement).filter,
  );

  console.log('HTML Filter:', htmlFilter);
  console.log('BG Layer Filter:', bgComputedFilter);
  console.log('Profile Photo Filter:', profileComputedFilter);
  console.log('Style URL Test Filter:', styleUrlTestFilter);
  console.log('Content Color:', contentColor);

  // HTML filter should be something like "invert(1) hue-rotate(180deg)"
  expect(htmlFilter).toContain('invert(1)');

  // Large background element should NOT have a re-inversion filter.
  expect(bgComputedFilter).not.toContain('invert(1)');
  expect(styleUrlTestFilter).not.toContain('invert(1)');

  // Small content element SHOULD have a re-inversion filter to look natural.
  expect(profileComputedFilter).toContain('invert(1)');
});

test('White text on re-inverted background (white-on-white)', async ({ page, server }) => {
  // Use a fixture file instead of setContent for more reliable extension injection
  await page.goto(`${server}/white_on_white.html`);

  // Wait for injection
  await expect(page.locator('html')).toHaveAttribute('hc', /delumine-smart/);

  const bgLayer = page.locator('.bg-layer');
  const content = page.locator('.content');

  // Verify that bg-layer is NOT re-inverted even though it has role="img"
  await expect(bgLayer).toHaveAttribute('deluminate_re_invert', 'false', { timeout: 10000 });

  const bgComputedFilter = await bgLayer.evaluate((el) => window.getComputedStyle(el).filter);
  const contentColor = await content.evaluate((el) => window.getComputedStyle(el).color);

  // BG Layer should stay inverted (black)
  expect(bgComputedFilter).not.toContain('invert(1)');
  // Content color should be black (which will look white visually due to HTML inversion)
  expect(contentColor).toBe('rgb(0, 0, 0)');

  // Visually: White text on Black background. Success.
});
