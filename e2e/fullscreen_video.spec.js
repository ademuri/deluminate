import { test, expect } from './fixtures.js';

test('video handling in fullscreen', async ({ page, server }) => {
  await page.goto(server + '/video.html');

  // Verify extension is working (html has attribute)
  await expect(page.locator('html')).toHaveAttribute('hc', /delumine/);

  const video = page.locator('#vid');

  // Helper to get computed filter
  const getFilter = async (loc) => {
    return await loc.evaluate((el) => {
      return window.getComputedStyle(el).filter;
    });
  };

  // Initially, the video should be un-inverted (have the filter applied to counteract root inversion)
  // The CSS rule applies: filter: hue-rotate(180deg) invert(100%);
  const initialFilter = await getFilter(video);
  expect(initialFilter).not.toBe('none');
  expect(initialFilter).toContain('invert(1)');

  // Enter fullscreen
  await video.evaluate(async (el) => {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
    }
  });

  // Wait for fullscreen
  await page.waitForFunction(() => document.fullscreenElement !== null);

  // Check filter again
  const fullscreenFilter = await getFilter(video);

  // If the bug is fixed, fullscreenFilter should be 'none' (or at least not have invert).
  // Currently, it HAS invert(1), which makes it look inverted because the root filter is gone.
  expect(fullscreenFilter).toBe('none');
});