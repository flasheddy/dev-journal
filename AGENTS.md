# AGENTS.md — dev-journal

## Core Invariants

### Runtime

- Build a static Astro site. Run it on Bun. Use `just` only as a local convenience.
- Run Astro through `bun --bun`. AI Studio's Node runtime cannot satisfy Astro's engine floor.
- Keep npm scripts runnable without `just`, `fish`, `rg`, or host linters.
- Keep `astro.config.mjs` authoritative for the site URL, trailing slashes, sitemap, Shiki theme, and dev binding. Default to port 3000. Honor `PORT`.
- Track only `bun.lock`. Never stage npm/pnpm/yarn lockfiles or generated `dist/`, `.astro/`, `.visual/`, `test-results/`, or `playwright-report/`.
- Never replace Astro with Express, Next.js, a custom Bun server, or an SPA.

### Content

- Keep blog posts in `src/content/blog/` and projects in `src/content/projects/`. Type both in `src/content.config.ts`.
- Author blog front matter with `title`, ISO `date`, `description`, optional top-level `updated`/`draft`, and `[taxonomies] tags`.
- Author project front matter with `title`, `description`, `tech`, `url`, `order`, optional `draft`.
- Import routes, tag slugs, dates, tag indexing, and reading time from `src/lib/posts.ts`. Import metadata and navigation from `src/lib/site.ts`. Do not duplicate that logic. Do not bypass the schema.
- Build tag URLs with `tagPath()`. Use site paths such as `/blog/<slug>/`. Never use `@/...`.
- Never reintroduce `config.toml`, `templates/`, `static/`, `verify.fish`, Tera components, `get_url`, or `get_taxonomy_url`.
- Preserve the exact title and `Playwright`, `Bun`, `CSS`, `Astro` tags of `src/content/blog/offline-visual-verification.md`.
- Preserve the homepage intro, `Latest articles` feed, and two selected-project URLs. Get operator direction before changing either contract.
- Get operator direction before renaming a published post.
- Follow `docs/editorial-workflow.md`. Treat specs as historical. Treat `scripts/check.ts` as authoritative.
- Format tracked Markdown with `rumdl fmt`. Change blog posts only for autofixable lint errors. Never rewrite prose.
- Do not use Markdown tables in agent documentation.

### UI

- Render the shell with `src/layouts/BaseLayout.astro`. Keep shared UI in `src/components/`. Keep styles in `src/styles/site.css`.
- Keep Mocha as the default theme and Latte as the light theme. Do not change pinned card or code-block tokens.
- Use `catppuccin-mocha` only for Shiki. Do not add dual themes.
- Keep client scripts safe across `astro:page-load` and `astro:after-swap` under `<ClientRouter />`.
- Use Minimal Astro. Do not add an `.astro` formatter or Prettier. Validate components with `astro check`. Do not add `.astro` files to `bun fmt`.
- Mark external links with `class="external-link"`, `target="_blank"`, `rel="noopener noreferrer"`, and `↗`.
- Mark email links with `↗` but without `target`/`rel`.
- Place server endpoints in `src/pages/api/` with `prerender = false`. Require an adapter and operator approval. Keep the default build static.
- Prefer vanilla TypeScript and CSS. Add an island renderer only for a concrete feature.

### Visual

- Run visual checks only through `just visual`. Never wire them into `scripts/check.ts`, `npm run check`, or CI.
- Use system Chromium at `/usr/bin/chromium` or `CHROMIUM_PATH`. Do not download browsers.
- Write screenshots to `.visual/screenshots/` and the report to `.visual/report/`.
- Keep `CORE_PAGES` and `FEED_PAGES` aligned with page and tag changes.

## Verification

```fish
bun install
just fmt
just check
just visual   # layouts/components/CSS/scripts/rendered content only
git status --short --branch
```

- Run `bun --bun run check` to validate schemas, required files, links, contracts, lockfiles, and secrets with `astro check` and `scripts/check.ts`.
- Run `bun --bun run build` to emit the static site into `dist/`.
- Run `bun --bun run check:built` to validate generated routes, links, assets, metadata, feed cards, and code-block output.
- Run `just check` for the canonical `preflight` -> `lint` -> `secrets` -> `site` gate.
- Use `just check-fast` for preflight followed by parallel `lint`, `secrets`, and `site`.
- Run `check`, `build`, and `check:built` in CI. Do not run `just` or the visual harness there.
- Never weaken a gate to make a change pass.

For AI Studio or bare npm:

```fish
npm install
npm run check
npm run build
```
