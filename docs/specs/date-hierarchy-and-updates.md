# Specification: Unified Editorial Date Hierarchy & Optional Updated Field

- **Status:** Draft Specification (Macro-Architecture Phase)
- **Target Path:** `docs/specs/date-hierarchy-and-updates.md`
- **Affected Files (Implementation Phase):**
  - `templates/page.html`
  - `templates/macros.html`
  - `static/css/site.css`
  - `tests/visual.spec.js`
  - `verify.fish`
  - `docs/editorial-workflow.md`

---

## 1. Requirements & User Contracts

### 1.1 Optional `updated` Field in Article TOML Front-Matter

Articles under `content/blog/*.md` must support Zola's native top-level optional `updated` date field in TOML front-matter alongside the required `date` field:

```toml
+++
title = "Post title"
date = 2026-09-26
updated = 2026-11-07       # Optional ISO 8601 date (YYYY-MM-DD)
description = "Short summary for lists and metadata."
[taxonomies]
tags = ["Playwright", "Bun", "CSS", "Zola"]
+++
```

**Contracts & Invariants:**

- `updated` is a top-level TOML key formatted as an ISO `YYYY-MM-DD` date (never nested inside `[extra]` or `[taxonomies]`).
- Section ordering in `content/blog/_index.md` remains `sort_by = "date"`.
- Contract-pinned article `content/blog/offline-visual-verification.md` must preserve its exact `title` (`"Offline-First Visual Verification: A Decoupled Playwright Harness"`) and `tags` (`["Playwright", "Bun", "CSS", "Zola"]`) per `AGENTS.md` §2.2.

### 1.2 Article Header Metadata (`templates/page.html`)

Update `.article-meta` in `templates/page.html` to format dates without leading day zeros (`%e`) and conditionally render `Updated <date>` between the publication date and reading time when `page.updated` is present and distinct from `page.date`:

```tera
      <div class="article-meta">
        <time datetime="{{ page.date }}">{{ page.date | date(format="%B %e, %Y") }}</time>
        {% if page.updated and page.updated != page.date %}
          <span aria-hidden="true">·</span>
          <span>Updated <time datetime="{{ page.updated }}">{{ page.updated | date(format="%B %e, %Y") }}</time></span>
        {% endif %}
        <span aria-hidden="true">·</span>
        <span>{{ page.reading_time }} min read</span>
      </div>
```

**Contracts & Invariants:**

- Publication date is always rendered inside `<time datetime="{{ page.date }}">` using `date(format="%B %e, %Y")` (e.g., `November 7, 2026`).
- When `page.updated` exists and `page.updated != page.date`, an accessible visual separator `<span aria-hidden="true">·</span>` and `<span>Updated <time datetime="{{ page.updated }}">{{ page.updated | date(format="%B %e, %Y") }}</time></span>` are rendered prior to the reading time separator and `<span>{{ page.reading_time }} min read</span>`.
- Existing `verify.fish` markers (`page.reading_time` and `Back to Articles`) remain intact.

### 1.3 Post Feed Card Component (`templates/macros.html`)

Refactor the `post_item(post)` Tera component in `templates/macros.html` to eliminate the two-column `.post-item__date` / `.post-item__body` split and unify desktop and mobile into a single vertical reading hierarchy (`Title -> Meta line -> Description -> Tags`):

```tera
{% component post_item(post) %}
  <article class="post-item">
    <h3><a href="{{ post.permalink }}">{{ post.title }}</a></h3>
    <div class="post-item__meta">
      <time datetime="{{ post.date }}">{{ post.date | date(format="%b %e, %Y") }}</time>
    </div>
    {% if post.description %}<p>{{ post.description }}</p>{% endif %}
    {{<tag_list tags={post.taxonomies.tags | default(value=[])} />}}
  </article>
{% endcomponent post_item %}
```

**Contracts & Invariants:**

- DOM child order inside `<article class="post-item">` is strictly:
  1. `<h3><a href="{{ post.permalink }}">{{ post.title }}</a></h3>` (Title)
  2. `<div class="post-item__meta"><time datetime="{{ post.date }}">{{ post.date | date(format="%b %e, %Y") }}</time></div>` (Meta line with natural title-case abbreviated month and space-padded day `%e`)
  3. `{% if post.description %}<p>{{ post.description }}</p>{% endif %}` (Description)
  4. `{{<tag_list tags={post.taxonomies.tags | default(value=[])} />}}` (Tags)
- Legacy wrappers `.post-item__date` and `.post-item__body` are removed.
- Feed cards (`post_item`) render only the publication date (`post.date`); the conditional `Updated <date>` indicator is scoped exclusively to individual article headers (`templates/page.html`).
- Tera component syntax (`{% component post_item(post) %} ... {% endcomponent post_item %}` and `{{<tag_list ... />}}`) is strictly preserved; legacy Tera macros (`{% macro %}`, `{% import %}`, `macros::`, `self::`) remain forbidden.

### 1.4 Single-Column Feed Layout & Muted Meta Typography (`static/css/site.css`)

Update `static/css/site.css` to replace the 2-column `.post-item` grid (`grid-template-columns: 9rem minmax(0, 1fr)`) with a single-column vertical card flow and style `.post-item__meta` with muted, natural typography:

```css
.post-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.45rem;
  padding-block: 2rem;
  border-bottom: 1px solid var(--border);
}

.post-item h3 {
  margin: 0;
  font-size: 1.35rem;
  line-height: 1.3;
}

.post-item h3 a {
  color: var(--text);
  text-decoration: none;
}

.post-item h3 a:hover {
  color: var(--accent);
}

.post-item__meta {
  color: var(--subtext);
  font-size: 0.9rem;
  line-height: 1.4;
}

.post-item > p {
  max-width: 46rem;
  margin: 0.2rem 0 0.55rem;
  color: var(--subtext);
}
```

**Responsive & Stylesheet Invariants:**

- Remove `.post-item__date` (dropping `font-family: var(--font-mono)` and `text-transform: uppercase`) and replace `.post-item__body>p` with `.post-item>p`.
- Remove or simplify the redundant `@media (max-width: 40rem)` `.post-item` column-collapse rule (`grid-template-columns: 1fr; gap: 0.55rem;`), as `.post-item` is now a unified single-column vertical stack across all viewports.
- Preserve all contract-pinned code-block/card CSS tokens in `static/css/site.css` (`background: #181825;`, `border: 1px solid #313244;`, `border-radius: 8px;`, `padding: 1.25rem 1.35rem;`, `padding: 1.1rem;`).

---

## 2. Edge Cases & Invariant Analysis

### 2.1 `updated` Equals `date` (`page.updated == page.date`)

- **Scenario:** An article specifies `date = 2026-11-07` and `updated = 2026-11-07`.
- **Required Behavior:** `{% if page.updated and page.updated != page.date %}` evaluates to `false`. The template must **not** render a duplicate `Updated November 7, 2026` string or a trailing/duplicate middle dot `·`.
- **Rendered Output:**
  ```html
  <div class="article-meta">
    <time datetime="2026-11-07">November 7, 2026</time>
    <span aria-hidden="true">·</span>
    <span>4 min read</span>
  </div>
  ```

### 2.2 `updated` Is Missing (`page.updated` Undefined)

- **Scenario:** An article omits `updated` from its TOML front-matter (all existing articles in `content/blog/*.md`).
- **Required Behavior:** `page.updated` evaluates to `none` (falsy in Tera). The conditional branch short-circuits cleanly without Tera rendering errors, outputting only the publication date, a single `<span aria-hidden="true">·</span>`, and `{{ page.reading_time }} min read`.

### 2.3 Single-Digit Day Formatting (`%e` Space Padding, HTML Minification, and DOM Text)

- **Scenario:** An article has a single-digit day of the month (e.g., `2026-11-07`).
- **Required Behavior:** Chrono's `%e` specifier replaces the leading zero (`07`) with a space (` 7`) at the Tera template layer (`"Nov  7, 2026"` for `"%b %e, %Y"`, `"November  7, 2026"` for `"%B %e, %Y"`).
  - Because `config.toml` sets `minify_html = true`, `zola build` collapses consecutive whitespace in text nodes to a single space (`<time datetime=2026-11-07>Nov 7, 2026</time>` and `<time datetime=2026-11-07>November 7, 2026</time>`) and strips quotes around single-token HTML attribute values (`class=post-item__meta`, `datetime=2026-11-07`) in `public/**/*.html`.
  - Under `zola serve` (unminified preview) and in `public/**/*.html`, browsers and Playwright text assertions (`innerText` / `toHaveText`) normalize whitespace to `"Nov 7, 2026"` and `"November 7, 2026"`.
  - Static regex assertions inspecting built `public/**/*.html` files must accommodate optional attribute quotes (`class="?post-item__meta"?`, `datetime="?2026-11-08"?`), match `Nov\s+7, 2026` (or `November\s+7, 2026`), and reject `Nov 07, 2026` / `November 07, 2026`.

### 2.4 Optional `post.description` and `tags` in `post_item`

- **Scenario:** A post omits `description` or has an empty `tags` array.
- **Required Behavior:** `{% if post.description %}` prevents an empty `<p></p>` element, and `{% if tags %}` inside `tag_list` prevents an empty `<ul class="tag-list"></ul>`. The vertical grid gap (`gap: 0.45rem`) on `.post-item` maintains balanced spacing between `<h3>`, `.post-item__meta`, and any remaining children.

### 2.5 `verify.fish` Site Contract Compatibility

Every invariant in `verify.fish` must remain satisfied:

- `templates/index.html` contains `{{<post_item post={post} />}}`.
- `templates/page.html` contains `page.reading_time` and `Back to Articles`.
- `templates/macros.html` contains `{% component tag_list(tags) %}`, `{% component post_item(post) %}`, and `get_taxonomy_url(kind='tags', term=tag)`.
- `verify.fish` must also be extended to assert the new template and CSS contracts and reject legacy two-column selectors:
  - `assert_contains templates/macros.html 'class="post-item__meta"'`
  - `assert_contains templates/macros.html 'date(format="%b %e, %Y")'`
  - `assert_contains templates/page.html 'page.updated != page.date'`
  - `assert_contains templates/page.html 'date(format="%B %e, %Y")'`
  - `assert_contains static/css/site.css '.post-item__meta'`
  - Fail if `post-item__(date|body)` appears in `templates/macros.html` or `static/css/site.css`.

---

## 3. Machine-Checkable Verification Criteria

### 3.1 Canonical Gate (`just check`)

Running `just check` from the repository root must exit `0` with the following exact sub-gate outcomes:

1. **`just check-agents`:**
   - **PASS Criterion:** Exits `0` and prints `check-agents: rules ok (<N> B / 32768 B)`.
   - **FAIL Criterion:** Non-zero exit or any `check-agents: <rule>: ...` violation on `stderr`.
2. **`just lint`:**
   - **PASS Criterion:** Exits `0` and prints `lint: fish syntax, toml, js, typos, justfile format, whitespace`.
   - **FAIL Criterion:** Non-zero exit or any `FAIL:` / `VERIFY FAILED: lint` diagnostic.
3. **`just secrets`:**
   - **PASS Criterion:** Exits `0` and prints `secrets: no secret material detected`.
   - **FAIL Criterion:** Non-zero exit or secret detection diagnostic.
4. **`just site` (`zola build`, `./verify.fish`, `zola check --skip-external-links`):**
   - **PASS Criterion:** Exits `0`, prints `PASS: site contract`, and confirms all internal links resolve.
   - **FAIL Criterion:** Non-zero exit or `FAIL: <reason>` from `./verify.fish` or `zola`.

### 3.2 Deterministic Build Artifact Assertions (`public/`)

After `zola build` (with `minify_html = true` in `config.toml`), the generated HTML in `public/` must satisfy these exact structural assertions:

- **Unified `.post-item__meta` presence & legacy class removal:**
  ```fish
  rg -q 'class="?post-item__meta"?' public/index.html public/blog/index.html
  not rg -q 'post-item__(date|body)' public/index.html public/blog/index.html
  ```
- **Natural date formatting without leading zero:**
  ```fish
  rg -q 'Nov\s+7, 2026' public/index.html
  not rg -q 'Nov 07, 2026' public/index.html
  rg -q 'November\s+7, 2026' public/blog/dual-harness-engineering/index.html
  not rg -q 'November 07, 2026' public/blog/dual-harness-engineering/index.html
  ```
- **Edge-case verification for `page.updated` (`missing`, `equal`, `distinct`):**
  - When `updated` is omitted (default across unedited articles):
    ```fish
    not rg -q 'Updated <time' public/blog/offline-visual-verification/index.html
    ```
  - During implementation verification, test both `updated = 2026-11-07` (equal to `date = 2026-11-07` on `dual-harness-engineering.md`, asserting `not rg -q 'Updated <time' public/blog/dual-harness-engineering/index.html`) and `updated = 2026-11-08` (distinct from `date`, asserting `rg -q 'Updated <time datetime="?2026-11-08"?>November\s+8, 2026</time>' public/blog/dual-harness-engineering/index.html`).

### 3.3 Visual & Layout Gate (`just visual` / Playwright)

`tests/visual.spec.js` must be updated and executed via `just visual` across both `system-chromium` (Desktop Chrome, `1280x720`) and `system-chromium-mobile` (Pixel 5, `393x851`).

**Required Playwright Assertions in `tests/visual.spec.js`:**

1. **Core Page Health & Zero Horizontal Overflow (`<= 1px`):**
   For every entry in `CORE_PAGES` (`/`, `/blog/`, `/blog/offline-visual-verification/`, `/blog/dual-harness-engineering/`, `/tags/`, `/tags/playwright/`, `/tags/antigravity/`):
   ```javascript
   const overflowPx = await page.evaluate(
     () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
   );
   expect(overflowPx, 'no horizontal overflow').toBeLessThanOrEqual(1);
   expect(pageErrors).toEqual([]);
   ```
2. **`.post-item__meta` Visibility, Natural Typography, and Vertical Hierarchy:**
   On feed pages containing `.post-item` cards (`home`, `blog`, `tag-playwright`, `tag-antigravity`):
   ```javascript
   const FEED_PAGES = new Set(['home', 'blog', 'tag-playwright', 'tag-antigravity']);
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
   ```
3. **Pass / Fail Exit Criteria for `just visual`:**
   - **PASS Criterion:** `just visual` exits `0`, all 16 Playwright tests (8 desktop + 8 mobile, or more if dedicated test blocks are added) pass with `0` retries and `0` page errors, and updated screenshots are written to `.visual/screenshots/`.
   - **FAIL Criterion:** Non-zero exit code, any feed page rendering zero `.post-item` cards, any `.post-item__meta` hidden or styled with `uppercase` or monospace font family, any date displaying a leading zero (`01`–`09`), vertical bounding-box inversion, or `overflowPx > 1`.
