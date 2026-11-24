import { test, expect } from '@playwright/test';

const CORE_PAGES = [
  { name: 'home', path: '/' },
  { name: 'blog', path: '/blog/' },
  { name: 'article', path: '/blog/offline-visual-verification/' },
  { name: 'article-dual-harness', path: '/blog/dual-harness-engineering/' },
  { name: 'tags', path: '/tags/' },
  { name: 'tag-playwright', path: '/tags/playwright/' },
  { name: 'tag-antigravity', path: '/tags/antigravity/' },
];

const FEED_PAGES = new Set(['home', 'blog', 'tag-playwright', 'tag-antigravity']);

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

      if (FEED_PAGES.has(pageInfo.name)) {
        const items = page.locator('.post-item');
        const itemCount = await items.count();
        expect(itemCount).toBeGreaterThan(0);

        const firstItem = items.first();
        const heading = firstItem.locator('h3');
        const meta = firstItem.locator('.post-item__meta');
        const description = firstItem.locator('p');
        const tags = firstItem.locator('.tag-list');

        await expect(meta).toBeVisible();
        await expect(meta).toHaveText(/^[A-Z][a-z]{2} [1-9]\d?, \d{4}$/);

        const styles = await meta.evaluate((el) => {
          const computed = getComputedStyle(el);
          return {
            textTransform: computed.textTransform,
            fontFamily: computed.fontFamily,
          };
        });
        expect(styles.textTransform).toBe('none');
        expect(styles.fontFamily).not.toMatch(/mono|consolas|menlo/i);

        const hBox = await heading.boundingBox();
        const mBox = await meta.boundingBox();
        expect(hBox.y).toBeLessThan(mBox.y);

        let prevY = mBox.y;
        if ((await description.count()) > 0) {
          const dBox = await description.boundingBox();
          expect(prevY).toBeLessThan(dBox.y);
          prevY = dBox.y;
        }
        if ((await tags.count()) > 0) {
          const tBox = await tags.boundingBox();
          expect(prevY).toBeLessThan(tBox.y);
        }
      }

      await page.screenshot({
        path: `.visual/screenshots/${mode}-${pageInfo.name}.png`,
        fullPage: true,
      });

      expect(pageErrors).toEqual([]);
    });
  }

  test('enhances code blocks with copy controls', async ({ page }) => {
    await page.goto('/blog/offline-visual-verification/');

    const button = page.locator('.prose .code-block .copy-button').first();
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('aria-label', 'Copy code');
  });

  test('adds copy-link anchors to article headings', async ({ page }) => {
    await page.goto('/blog/offline-visual-verification/');

    const anchor = page.locator('.prose h2 .heading-anchor').first();
    await expect(anchor).toBeVisible();
    await expect(anchor).toHaveAttribute('aria-label', /^Copy link to section:/);
  });

  test('tracks article reading progress and TOC position', async ({ page }) => {
    await page.goto('/blog/offline-visual-verification/');

    await expect(page.locator('.article-toc')).toHaveCount(1);
    await expect(page.locator('.toc-rail__link[aria-current="location"]')).toHaveCount(1);

    const bar = page.locator('[data-reading-progress-bar]');
    await expect(bar).toHaveCount(1);

    const transform = () => bar.evaluate((element) => element.style.transform);
    await expect.poll(transform).toBe('scaleX(0)');

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

    await expect.poll(transform).not.toBe('scaleX(0)');
  });

  test('filters articles by topic and resets the URL state', async ({ page }) => {
    await page.goto('/blog/');

    const posts = page.locator('.post-item');
    const initialCount = await posts.evaluateAll(
      (items) => items.filter((item) => !item.hidden).length,
    );
    expect(initialCount).toBeGreaterThan(0);

    await page.locator('[data-topic-filter] [data-filter-tag="dotfiles"]').click();

    await expect(page).toHaveURL(/\?tag=dotfiles/);
    await expect(page.locator('[data-topic-filter] [data-filter-tag="dotfiles"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const visiblePosts = page.locator('.post-item:not([hidden])');
    const visibleCount = await visiblePosts.count();
    expect(visibleCount).toBeGreaterThan(0);
    for (const item of await visiblePosts.all()) {
      const tags = await item.getAttribute('data-tags');
      expect(tags?.split(',')).toContain('dotfiles');
    }

    await page.locator('[data-topic-filter] [data-filter-tag="all"]').click();

    await expect(page).not.toHaveURL(/\?tag=/);
    await expect.poll(() => page.locator('.post-item:not([hidden])').count()).toBe(initialCount);
  });

  test('filters projects by technology', async ({ page }) => {
    await page.goto('/');

    const cards = page.locator('.project-card');
    await expect(cards).toHaveCount(2);

    await page.locator('[data-project-filter] [data-filter-tag="selectolax"]').click();

    const visibleCards = page.locator('.project-card:not([hidden])');
    await expect(visibleCards).toHaveCount(1);
    await expect(visibleCards.first()).toContainText('Event Aggregation Pipeline');

    await page.locator('[data-project-filter] [data-filter-tag="all"]').click();

    await expect(page.locator('.project-card:not([hidden])')).toHaveCount(2);
  });

  test('command palette searches and restores focus', async ({ page }) => {
    await page.goto('/');

    const trigger = page.locator('[data-search-trigger]');
    const palette = page.locator('[data-command-palette]');
    const input = page.locator('[data-command-input]');

    await trigger.click();
    await expect(palette).toBeVisible();
    await expect(input).toBeFocused();

    await page.keyboard.type('astro');
    await expect(page.locator('[data-command-option] a').first()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('global Control+K opens the command palette and Escape closes it', async ({ page }) => {
    await page.goto('/');

    const palette = page.locator('[data-command-palette]');
    const input = page.locator('[data-command-input]');

    await page.keyboard.press('Control+k');
    await expect(palette).toBeVisible();
    await expect(input).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();
  });

  test('ask journal renders citations in static mode and restores focus', async ({ page }) => {
    const askRequests = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/ask')) askRequests.push(request.url());
    });

    await page.goto('/');

    const trigger = page.locator('[data-ask-trigger]');
    const modal = page.locator('[data-ask-modal]');
    const input = page.locator('[data-ask-input]');

    await trigger.click();
    await expect(modal).toBeVisible();
    await expect(input).toBeFocused();

    await page.locator('[data-ask-suggestion]').first().click();

    await expect(page.locator('[data-ask-answer]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-ask-mode]')).toHaveText('Static mode · Top matched passages');
    await expect(page.locator('.ask-modal__citation').first()).toBeVisible();
    expect(askRequests).toEqual([]);

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(trigger).toBeFocused();
  });

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
