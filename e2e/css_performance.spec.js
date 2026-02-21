import { test, expect } from './fixtures.js';

test.describe('CSS Performance Benchmark', () => {
  test('measures style recalculation cost with complex selectors', async ({ page, server }) => {
    // Navigate to a basic page
    await page.goto(`${server}/basic.html`);

    // 1. Setup the DOM with elements that trigger the expensive selectors
    // We want elements that match [style*="url"], img, video, etc., nested within each other.
    await page.evaluate(() => {
      const container = document.createElement('div');
      container.id = 'perf-container';

      // Create 1000 complex items
      // The CSS has rules like: [style*="url"] :is([style*="url"], img, video)
      // So we want nesting.
      for (let i = 0; i < 1000; i++) {
        const wrapper = document.createElement('div');
        wrapper.style.backgroundImage = 'url("pixel.png")'; // Matches [style*="url"]
        wrapper.className = 'complex-wrapper';

        const nestedImg = document.createElement('img');
        nestedImg.src = 'pixel.png'; // Matches img

        const nestedBg = document.createElement('div');
        nestedBg.style.backgroundImage = 'url("pixel2.png")'; // Nested [style*="url"]

        const nestedVideo = document.createElement('video'); // Matches video

        // Nest them
        wrapper.appendChild(nestedImg);
        wrapper.appendChild(nestedBg);
        wrapper.appendChild(nestedVideo);

        // Nesting level 2
        const deepNested = document.createElement('div');
        deepNested.style.backgroundImage = 'url("pixel3.png")';
        nestedBg.appendChild(deepNested);

        container.appendChild(wrapper);
      }

      document.body.appendChild(container);
    });

    // Ensure layout is settled
    await page.evaluate(() => document.body.offsetHeight);

    // 2. Measure time to apply the 'delumine-smart' attribute
    // This triggers the browser to match all those new complex CSS rules against the DOM.
    const duration = await page.evaluate(async () => {
      const start = performance.now();

      // Apply the attribute that activates the CSS rules
      document.documentElement.setAttribute('hc', 'delumine-smart');

      // Force a synchronous style calc / layout
      const height = document.body.offsetHeight;

      const end = performance.now();
      return end - start;
    });

    console.log(`Style Recalculation Time (1000 items): ${duration.toFixed(2)}ms`);

    // We expect it to be reasonable. If it's > 500ms, that's a jank.
    // Setting a soft assertion here. If the regression is huge, this might be 1000ms+.
    // For now, just logging it is useful, but let's assert it's under a "sanity" threshold
    // so we fail if it's catastrophic.
    expect(duration).toBeLessThan(2000);
  });
});
