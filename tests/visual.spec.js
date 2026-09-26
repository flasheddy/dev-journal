const { test, expect } = require('@playwright/test');

const CORE_PAGES = [
  { name: 'home', path: '/' },
  { name: 'blog', path: '/blog/' },
  { name: 'article', path: '/blog/building-ensub/' },
  { name: 'tags', path: '/tags/' },
  { name: 'tag-rust', path: '/tags/rust/' },
];

test.describe('core page rendering health', () => {
  for (const pageInfo of CORE_PAGES) {
    test(`${pageInfo.name} renders without errors or overflow`, async ({ page }) => {
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
        path: `.visual/screenshots/${pageInfo.name}.png`,
        fullPage: true,
      });

      expect(pageErrors).toEqual([]);
    });
  }

  test('theme toggle switches mocha <-> latte and captures light screenshot', async ({ page }) => {
    await page.goto('/');

    const initial = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.locator('[data-theme-toggle]').click();
    const toggled = await page.evaluate(() => document.documentElement.dataset.theme);
    expect(toggled).not.toBe(initial);
    expect(['mocha', 'latte']).toContain(toggled);

    await page.screenshot({
      path: '.visual/screenshots/home-light.png',
      fullPage: true,
    });
  });
});
