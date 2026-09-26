const { test, expect } = require('@playwright/test');

const CORE_PAGES = [
  { name: 'home', path: '/' },
  { name: 'blog', path: '/blog/' },
  { name: 'article', path: '/blog/offline-visual-verification/' },
  { name: 'tags', path: '/tags/' },
  { name: 'tag-playwright', path: '/tags/playwright/' },
];

function viewportMode(page) {
  const viewport = page.viewportSize();
  return viewport && viewport.width <= 640 ? 'mobile' : 'desktop';
}

test.describe('core page rendering health', () => {
  for (const pageInfo of CORE_PAGES) {
    test(`${pageInfo.name} renders without errors or overflow`, async ({ page }) => {
      const mode = viewportMode(page);
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(String(err)));

      const response = await page.goto(pageInfo.path);
      expect(response && response.status()).toBe(200);

      await expect(page.locator('#main-content')).toBeVisible();
      await expect(page.locator('header.site-header')).toBeVisible();
      await expect(page.locator('footer.site-footer')).toBeVisible();

      const overflowPx = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflowPx, 'no horizontal overflow').toBeLessThanOrEqual(1);

      await page.screenshot({
        path: `.visual/screenshots/${mode}-${pageInfo.name}.png`,
        fullPage: true,
      });

      expect(pageErrors).toEqual([]);
    });
  }

  test('theme toggle swaps moon/sun icon with theme state', async ({ page }) => {
    await page.goto('/');

    // Fresh context defaults to Mocha (dark): Moon visible, Sun hidden.
    await expect(page.locator('[data-theme-icon="moon"]')).toBeVisible();
    await expect(page.locator('[data-theme-icon="sun"]')).toBeHidden();

    await page.locator('[data-theme-toggle]').click();
    const theme = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(theme).toBe('latte');

    // Latte (light): Sun visible, Moon hidden.
    await expect(page.locator('[data-theme-icon="sun"]')).toBeVisible();
    await expect(page.locator('[data-theme-icon="moon"]')).toBeHidden();

    const mode = viewportMode(page);
    await page.screenshot({
      path: `.visual/screenshots/${mode}-home-light.png`,
      fullPage: true,
    });
  });
});
