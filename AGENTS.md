# AGENTS.md — Operational Rules for AI Agents

Dev Journal: Astro site published at `https://hech.dev`. Global rules:
`~/.AGENTS.md`.

---

## 1. Repository Architecture & Constraints

### 1.1 Runtime & Compatibility

- The site is Astro 7 with static output. Pages live in `src/pages/`, content
  lives in `src/content/`, and the production build is written to `dist/`.
- Local work runs on Bun (`bun install`, `bun --bun run dev`,
  `bun --bun run build`). `just` is a local convenience wrapper only; it is
  never a runtime requirement.
- Google AI Studio invokes the npm scripts in `package.json` (`npm run dev`,
  `npm run check`, `npm run build`), which delegate the Astro CLI to
  `bun --bun`. CI runs the same scripts through Bun. They must work without
  `just`, `fish`, `rg`, or any host linter.
- Keep Astro CLI invocations behind `bun --bun` (`bun --bun astro dev`,
  `bun --bun astro build`, `bun --bun astro preview`, `bun --bun astro check`).
  This lets AI Studio's Node 22.23.2 container run Astro 7, whose own engine
  floor is Node >=22.23.4.
- `astro.config.mjs` owns the canonical site URL, trailing-slash policy,
  Catppuccin syntax highlighting, the sitemap, and dev binding. The default port
  is 3000 because AI Studio's preview proxy exposes only that port; `PORT` is
  still honored for the visual harness and other hosted runtimes.
  Do not replace Astro with Express, Next.js, a hand-written Bun server, or a
  client-rendered SPA.
- `.npmrc` disables npm's package lock, so `bun.lock` stays the only committed
  lockfile. If a `package-lock.json` appears, do not stage it.

### 1.2 Content Collections

- Blog posts live in `src/content/blog/`; project cards live in
  `src/content/projects/`. Both are typed in `src/content.config.ts`.
- Front matter is TOML delimited by `+++`. Blog fields: `title`, ISO `date`,
  `description`, optional top-level `updated`, optional `draft`, and
  `[taxonomies] tags = [...]`. Project fields: `title`, `description`, `tech`,
  `url`, `order`, optional `draft`.
- `src/lib/posts.ts` owns routes, tag slugs, date formatting, tag indexing, and
  reading time. Import those helpers instead of duplicating URL or date logic.
- `src/lib/site.ts` owns site metadata, navigation, and section copy.
- The schema is the source of truth. Do not bypass it with ad-hoc Markdown
  parsing or a parallel content directory.

### 1.3 UI, Styling & Scripts

- `src/layouts/BaseLayout.astro` is the HTML shell. Shared UI lives in
  `src/components/`.
- CSS is hand-written in `src/styles/site.css`. Mocha is the default theme,
  Latte is the light theme, and the pinned card and code-block tokens must not
  change. Syntax highlighting is inline `catppuccin-mocha` only; do not add
  `light_theme`, `dark_theme`, or dual Shiki themes.
- View transitions come from Astro's `<ClientRouter />`. Client scripts must
  remain safe across `astro:page-load` and `astro:after-swap`; bundled scripts
  do not re-run on every navigation.
- Prefer vanilla TypeScript and CSS for interactive widgets. Add Preact, Solid,
  Svelte, or another island renderer only when a concrete feature needs it, and
  document the decision in this file.
- Astro components follow the Minimal Astro policy: no `.astro` formatter,
  local Helix `auto-format = false`, and `astro check` as the correctness gate.
  Do not add Prettier or `prettier-plugin-astro`, and do not add `.astro` to
  `bun fmt` loops.

### 1.4 Routing, Links & Extensibility

- Blog URLs are `/blog/<slug>/`; tag URLs are `/tags/<tag-slug>/`. Generate tag
  URLs through `tagPath()` so slugging stays consistent.
- External links need `class="external-link"`, `target="_blank"`,
  `rel="noopener noreferrer"`, and the `↗` glyph. Email links keep the glyph
  without `target`/`rel`.
- Do not reintroduce legacy static-site syntax such as `@/blog/...`, Tera
  shortcodes, `get_url`, or `get_taxonomy_url`.
- Future server endpoints belong in `src/pages/api/` with `prerender = false`.
  Adding one requires an Astro adapter and an explicit operator decision; the
  default site remains static.
- A build-time JSON manifest or lightweight island for project filtering is the
  preferred next step before adding a client framework.

### 1.5 Visual Harness

- `just visual` only. It is never wired into `scripts/check.ts`, `npm run check`,
  or CI.
- Bun + `bun.lock`; system Chromium at `/usr/bin/chromium`; no browser
  downloads. `CHROMIUM_PATH` may point at an existing local binary when the
  host package is unavailable.
- Screenshots: `.visual/screenshots/`; report: `.visual/report/index.html`.
- Keep `CORE_PAGES` and `FEED_PAGES` in `tests/visual.spec.js` aligned with page
  and tag changes.

## 2. Operating Protocols

### 2.1 Editorial & Content

- Create an article under `src/content/blog/` with TOML front matter:

  ```toml
  +++
  title = "Post title"
  date = 2026-09-26
  updated = 2026-11-07
  description = "A short summary used by article lists and metadata."
  [taxonomies]
  tags = ["Playwright", "Bun", "CSS", "Astro"]
  +++
  ```

- `updated` is optional and top-level. It renders only in article headers when
  it differs from `date`; feed cards show only `date`.
- Follow `docs/editorial-workflow.md`: evidence-bounded claims, no invented
  metrics, synthetic data, no secrets or private paths.
- Specs in `docs/specs/` are historical records; `scripts/check.ts` wins
  contradictions.

### 2.2 Content Invariants

- `src/content/blog/offline-visual-verification.md` is contract-pinned: exact
  title and tags.
- Homepage keeps the `Hi, I’m Chen.` intro, `Latest articles` feed, and the two
  selected-project URLs. Keep `src/lib/site.ts` metadata aligned with the page.
- Renaming a published article changes its URL; get operator direction first.
- `just fmt` runs `rumdl fmt` over tracked Markdown. Blog posts change only for
  autofixable lint errors; do not rewrite article prose as part of formatting.
  It does not format `.astro` files; see the Minimal Astro policy above.

### 2.3 Verification Gates

- `bun --bun run check`: shared source gate. Runs `bun --bun astro check` and
  `scripts/check.ts` for schema validity, required files, internal links,
  contract markers, lockfiles, and secret scanning.
- `bun --bun run build`: Astro production build into `dist/`.
- `bun --bun run check:built`: validates generated pages, internal links, assets,
  metadata, feed cards, and the Catppuccin code-block output.
- `just check`: local canonical gate over `preflight`, `lint` (including
  `bun --bun run check`), `secrets`, and `site` (build plus built checks).
- `just check-fast`: runs `preflight` first, then the same `lint`, `secrets`,
  and `site` gates in parallel.
- `just visual`: rendering checks only.
- CI runs `bun install --frozen-lockfile`, `bun --bun run check`, `bun --bun run build`, and
  `bun --bun run check:built`. It does not run `just` or the visual harness.
- Do not weaken a gate to make a change pass.

## 3. Forbidden Actions

- No replacing Astro with Express, Next.js, a custom Bun server, or an SPA.
- No legacy static-site paths or syntax (`config.toml`, `templates/`,
  `static/`, `verify.fish`, `@/…`, Tera components).
- No root-relative imports in content Markdown; use site paths such as
  `/blog/<slug>/`.
- No dual-theme syntax-highlighting config.
- No tracked non-Bun lockfiles (`package-lock.json`, `pnpm-lock.yaml`,
  `yarn.lock`).
- No changes to contract-pinned content or homepage structure without operator
  direction.
- No Markdown tables in `AGENTS.md`.
- No committing `dist/`, `.astro/`, `.visual/`, `test-results/`, or
  `playwright-report/`.
- No visual verification in CI or `scripts/check.ts`.
- Do not add a UI framework island without a concrete interactive requirement.

## 4. Verification Checklist

```fish
bun install
just fmt
just check
just visual   # only when templates, CSS, JS, or rendered content changes
git status --short --branch
```

For Google AI Studio or a bare npm environment:

```fish
npm install
npm run check
npm run build
```

Leave changes unstaged. Report what changed, where, why, how verified, and what
remains.
