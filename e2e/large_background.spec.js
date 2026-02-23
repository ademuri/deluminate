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

  // Verify that small content images (like profile photos) still get re-inverted
  await expect(profilePhoto).toHaveAttribute('deluminate_imageType', 'jpg', { timeout: 10000 });

  // Verify that large background elements are NOT marked for re-inversion
  await expect(bgLayer).not.toHaveAttribute('deluminate_imageType');

  const bgComputedFilter = await bgLayer.evaluate(el => window.getComputedStyle(el).filter);
  const profileComputedFilter = await profilePhoto.evaluate(el => window.getComputedStyle(el).filter);
  const contentColor = await content.evaluate(el => window.getComputedStyle(el).color);
  const htmlFilter = await page.evaluate(() => window.getComputedStyle(document.documentElement).filter);

  console.log('HTML Filter:', htmlFilter);
  console.log('BG Layer Filter:', bgComputedFilter);
  console.log('Profile Photo Filter:', profileComputedFilter);
  console.log('Content Color:', contentColor);

  // HTML filter should be something like "invert(1) hue-rotate(180deg)"
  expect(htmlFilter).toContain('invert(1)');

  // Large background element should NOT have a re-inversion filter.
  // This allows it to stay inverted (e.g., black) and avoids white-on-white text.
  expect(bgComputedFilter).not.toContain('invert(1)');

  // Small content element SHOULD have a re-inversion filter to look natural.
  expect(profileComputedFilter).toContain('invert(1)');

  // Confirm that the text remains readable (visually white-on-black)
});
