# AGENTS.md — dev-journal

Repository rules for a static Astro site on Bun.

## Content

### Workflow

- Treat `scripts/check.ts` as the executable contract.
- Follow `docs/editorial-workflow.md`.
- Treat specs as historical.
- Ask the operator before renaming a published post.
- Ask the operator before changing the homepage intro, `Latest articles` feed, or selected-project URLs.

### Editing

- Import routes, tag slugs, dates, tag indexing, and reading time from `src/lib/posts.ts`.
- Import metadata and navigation from `src/lib/site.ts`.
- Do not duplicate library logic.
- Change blog posts only for autofixable lint errors.
- Do not rewrite prose.
- Do not use Markdown tables in agent documentation.

## UI

### Stack

- Use Minimal Astro.
- Do not add an `.astro` formatter or Prettier.
- Validate components with `astro check`.
- Exclude `.astro` files from `bun fmt`.
- Use vanilla TypeScript and CSS.
- Add an island renderer only for a concrete feature.

### Shell

- Render the shell with `src/layouts/BaseLayout.astro`.
- Keep shared UI in `src/components/`.
- Keep styles in `src/styles/site.css`.
- Keep Mocha as the default theme.
- Keep Latte as the light theme.

### Client

- Keep client code safe under `<ClientRouter />`.
- Initialize client features on `astro:page-load`.
- Clean up listeners and observers on `astro:before-swap`.
- Reapply theme on `astro:after-swap`.
- Keep lifecycle ownership in `src/scripts/main.ts`.
- Do not duplicate global handlers.

## Server

- Place server endpoints in `src/pages/api/` with `prerender = false`.
- Require an adapter and operator approval for server endpoints.
- Keep the default build static.

## Ask Journal

- Keep live synthesis opt-in via `PUBLIC_ASK_ENDPOINT`.
- Keep Ask Journal static when `PUBLIC_ASK_ENDPOINT` is unset.

## Visual

- Run visual checks only through `just visual`.
- Keep visual checks out of `scripts/check.ts`, `bun run check`, and CI.
- Use system Chromium at `/usr/bin/chromium` or `CHROMIUM_PATH`.
- Do not download browsers.
- Keep `CORE_PAGES` and `FEED_PAGES` aligned with page and tag changes.

## Verification

- Run `just fmt` before checks.
- Run `just check` before completion.
- Run `just visual` for rendered UI changes.
- Treat `dist/` as generated.
- Do not edit `dist/` to pass a gate.
- Do not weaken a gate to make a change pass.

```fish
just fmt
just check
just visual
git status --short --branch
```
