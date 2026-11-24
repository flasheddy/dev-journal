# Specification: Unified Editorial Date Hierarchy & Optional Updated Field

- **Status:** Implemented. The current Astro 7 implementation and
  `scripts/check.ts` contract are authoritative.
- **Current contract:** `scripts/check.ts`
- **Current implementation:** `src/content.config.ts`, `src/lib/posts.ts`,
  `src/pages/blog/[...slug].astro`, `src/components/PostItem.astro`,
  `src/styles/site.css`, `tests/visual.spec.js`
- **Historical implementation:** The previous static-site implementation was
  removed during the Astro migration. Git history preserves it.

## 1. Current Astro 7 Implementation

### 1.1 Content schema and front matter

Blog entries live in `src/content/blog/` and are collected by the `blog`
definition in `src/content.config.ts`. Front matter remains TOML delimited by
`+++`:

```toml
+++
title = "Post title"
date = 2026-09-26
updated = 2026-11-07       # Optional ISO 8601 date (YYYY-MM-DD)
description = "Short summary for lists and metadata."
[taxonomies]
tags = ["Playwright", "Bun", "CSS", "Astro"]
+++
```

- `date` and optional `updated` are top-level TOML dates.
- `updated` must never be nested inside `[taxonomies]`.
- `description` is required by the current schema; the feed component still
  guards the element so future schema changes do not emit an empty paragraph.
- `[taxonomies] tags` is required in shape but may be empty; the schema defaults
  missing tags to `[]`.
- `draft` is optional and defaults to `false`; draft entries are excluded from
  post and tag queries.
- `src/lib/posts.ts` owns post ordering, route paths, tag slugs, date
  formatting, the `isUpdated()` comparison, and reading time.

### 1.2 Article header

`src/pages/blog/[...slug].astro` renders the article header in this order:

1. `← Back to Articles`
2. Article title
3. Publication date, formatted in UTC with `Intl.DateTimeFormat` and
   `timeZone: 'UTC'`
4. Conditional `Updated <date>` when `updated` exists and is distinct from
   `date`
5. Reading time
6. Tag list

The date strings are the long month form (`September 26, 2026`,
`November 7, 2026`) and never contain a leading zero in the day. The `Updated`
block is rendered only when `isUpdated(post)` is true. It is omitted when
`updated` is missing or equal to `date`.

The reading-time calculation in `src/lib/posts.ts` preserves the previous
behavior: fenced code is excluded and English prose is read at 238 words per
minute. This keeps the existing articles at their previous 3–4 minute labels.

### 1.3 Feed cards

`src/components/PostItem.astro` is the single feed card component used by the
homepage, blog archive, and tag pages. Its DOM order is:

1. `<h3><a href="/blog/<slug>/">Title</a></h3>`
2. `<div class="post-item__meta"><time datetime="YYYY-MM-DD">Mon D, YYYY</time></div>`
3. Description paragraph
4. Tag list

Feed cards show only the publication date. The `Updated <date>` indicator is
scoped to individual article headers. `src/styles/site.css` keeps the
single-column `.post-item` flow and the pinned card/code-block tokens
(`background: #181825;`, `border: 1px solid #313244;`, `border-radius: 8px;`,
`padding: 1.25rem 1.35rem;`, `padding: 1.1rem;`).

### 1.4 Build output

Astro writes the production site to `dist/`:

- `dist/index.html`
- `dist/blog/index.html`
- `dist/blog/<slug>/index.html`
- `dist/tags/index.html`
- `dist/tags/<tag-slug>/index.html`
- `dist/404.html`
- `dist/sitemap-index.xml` and `dist/sitemap-0.xml`

`public/` is now only a source for verbatim static files (`CNAME`,
`robots.txt`), not a build-output directory. Historical references to
`public/**/*.html` are explicitly stale.

## 2. Current Edge Cases

### 2.1 `updated` equals `date`

`isUpdated()` compares the numeric timestamps. Equal dates produce `false`, so
no duplicate `Updated` string and no extra middle dot are rendered. The article
shows only the publication date, one separator, and the reading time.

### 2.2 `updated` is missing

`updated` is optional. The conditional branch is skipped and the article shows
the publication date, one separator, and the reading time. `scripts/check.ts`
fails a built article if an `Updated <time>` element appears without a distinct
updated date.

### 2.3 Single-digit days and whitespace

`Intl.DateTimeFormat` emits `September 7, 2026` and `Nov 7, 2026`; it does not
emit `September 07, 2026` or `Nov 07, 2026`. The feed meta element has no
surrounding text-node whitespace, so Playwright sees exactly
`Nov 7, 2026`. Runtime screenshots and generated HTML use the same text.

### 2.4 Optional tags and descriptions

`TagList.astro` renders nothing when the tags array is empty. The current
schema requires `description`, but `PostItem.astro` still guards the paragraph
so a future optional description does not produce an empty element. The
vertical grid gap in `.post-item` preserves spacing between the title, meta
line, and remaining children.

### 2.5 URL and date stability

Article URLs are `/blog/<slug>/`, derived from the content file name. Tags are
`/tags/<tag-slug>/`, derived by `slugifyTag()` in `src/lib/posts.ts`. Renaming a
published content file changes its URL and requires operator direction.

## 3. Machine-Checkable Verification Criteria

### 3.1 Shared source gate

Run:

```fish
bun run check
```

`astro check` validates the Astro and TypeScript sources. Then
`scripts/check.ts` validates:

- required repository and Astro files;
- TOML front matter and required blog/project fields;
- unique tags and tag slug collisions;
- the contract-pinned `offline-visual-verification` title and tags;
- internal Markdown links against the generated route set;
- tracked non-Bun lockfiles and generated artifacts;
- secret-shaped strings and private-key material;
- the Astro config's Catppuccin theme and port-3000 default.

### 3.2 Built-site gate

After `bun run build`, run:

```fish
bun run check:built
```

`scripts/check.ts --built` validates the generated `dist/` tree, including:

- required home, archive, article, tag, 404, and sitemap files;
- internal links and hashed `/_astro/` assets;
- `lang="en"` and default `data-theme="mocha"`;
- external-link `target`, `rel`, class, and glyph contracts;
- the homepage introduction, project URLs, and `Built with Astro.` footer;
- article title, `Back to Articles`, `min read`, and Catppuccin code blocks;
- `Updated <time>` present exactly when a distinct `updated` exists, including
  the formatted long date text;
- `Updated <time>` absent when `updated` is missing or equal to `date`;
- `.post-item__meta` presence on home, blog, and tag feeds.

`just site` runs the build and this gate together.

### 3.3 Canonical local gate

```fish
just check
```

This runs `preflight`, `lint` (including `bun run check`), `secrets`, and
`site` (build plus `check:built`). `just check-fast` runs `preflight` first,
then runs `lint`, `secrets`, and `site` in parallel.

### 3.4 Visual gate

```fish
just visual
```

The Playwright harness runs against system Chromium by default. Set
`CHROMIUM_PATH` to an existing local binary when the host package is broken. It
checks all `CORE_PAGES` for HTTP 200, visible header/main/footer, and at most
1px horizontal overflow. On feed pages it checks:

- at least one `.post-item`;
- `.post-item__meta` text matches `/^[A-Z][a-z]{2} [1-9]\d?, \d{4}$/`;
- meta typography is not uppercase or monospace;
- title, meta, description, and tags appear in vertical order;
- theme toggle and copy-code controls work;
- no page errors are emitted.

Screenshots are written to `.visual/screenshots/`; the report is
`.visual/report/index.html`.

### 3.5 CI

GitHub Actions runs:

```fish
bun install --frozen-lockfile
bun run check
bun run build
bun run check:built
```

CI does not run `just` or a browser-based visual gate.

### 3.6 Contract-Pinned Article

`src/content/blog/offline-visual-verification.md` keeps its exact title and tags,
as enforced by `scripts/check.ts`. The previous static-site implementation is
available in Git history for historical comparison.
