# Dev Journal

A static engineering journal built with [Astro](https://astro.build/) and
published at `https://hech.dev/`. Bun is the runtime. The npm scripts delegate
Astro CLI commands to `bun --bun` so Google AI Studio and GitHub Actions do not
need a newer host Node.

## Quickstart

Install [Bun](https://bun.sh/) and system Chromium for the optional visual
harness, then start the preview server:

```fish
bun install
bun --bun run dev   # or: just serve
```

Open `http://127.0.0.1:3000/`. The default port is 3000 because AI Studio's
reverse proxy exposes only that port; the server still reads `PORT` when a local
harness or another hosted runtime injects it.

## Google AI Studio

Import the repository into AI Studio Build and let its runtime use the package
scripts:

```fish
npm install
npm run dev
```

The package scripts invoke the Astro CLI through `bun --bun`, so AI Studio's
Node 22.23.2 container does not hit Astro 7's Node >=22.23.4 runtime gate.
`npm run build` emits static files into `dist/`. AI Studio's npm runner does not
need `just`, `fish`, `rg`, or the host linters. The shared gate is:

```fish
npm run check
```

It runs `bun --bun astro check` plus `scripts/check.ts`, which validates content
schemas, internal links, contract markers, lockfiles, and secret material
without shell tooling. `.npmrc` disables npm's package lock, so `bun.lock` stays
the only committed lockfile; do not stage a `package-lock.json` if one appears.

## Task Runner (`just`)

`just` is a local convenience layer for the CachyOS workstation, not a project
requirement:

- `just` (default): runs the canonical verification gate (`just check`).
- `just preflight`: fail-closed check for local tools and contract files.
- `just serve`: starts the Astro development server.
- `just check`: canonical local gate combining preflight, static linting, the
  shared Astro/source contract, secret scanning, build, and built-site checks.
- `just check-fast`: runs `preflight` first, then `lint`, `secrets`, and `site`
  in parallel.
- `just fmt`: auto-formats Fish scripts, TOML configs, JavaScript/TypeScript,
  CSS, tracked Markdown, and the `justfile`. Astro components are intentionally
  excluded.
- `just lint`: matching format checks for Fish, TOML, JS/TS, CSS, Markdown, and
  the `justfile`, plus typos, tracked-lockfile rejection, Git whitespace, and
  `bun --bun run check`.
- `just secrets`: fail-closed secret scanning via `gitleaks` with a regex
  fallback.
- `just site`: builds the site and validates generated pages, links, and assets.
- `just visual`: runs the decoupled Playwright visual regression harness.

`fmt` and `lint` are symmetric: every formatter has a corresponding check.
Astro follows the Minimal Astro policy: there is no `.astro` formatter and no
Prettier or `prettier-plugin-astro`; local Helix sets `auto-format = false`, and
`astro check` (inside `bun --bun run check`) provides correctness. Do not add
`.astro` files to the `bun fmt` loops.

## Writing an Article

Follow the editorial standards in [`docs/editorial-workflow.md`](docs/editorial-workflow.md).
Create a Markdown file under `src/content/blog/` with TOML front matter:

```toml
+++
title = "Post title"
date = 2026-09-26
description = "A short summary used by article lists and metadata."
[taxonomies]
tags = ["Playwright", "Bun", "CSS", "Astro"]
+++
```

The `updated` key is optional and top-level. Article URLs are derived from the
file name, so renaming a published article changes its URL. Project cards live
in `src/content/projects/` and use `title`, `description`, `tech`, `url`, and
`order`.

## Architecture

- `src/content.config.ts`: typed collections for `blog` and `projects`.
- `src/lib/site.ts`: site metadata, navigation, and section copy.
- `src/lib/posts.ts`: post routes, tag slugs, dates, tag counts, reading time.
- `src/layouts/BaseLayout.astro`: HTML shell, theme bootstrap, view transitions.
- `src/pages/`: home, blog archive, article routes, tags, and 404.
- `src/styles/site.css`: hand-written Catppuccin Mocha/Latte design system.
- `src/scripts/site.ts`: theme toggle and copy-code enhancement.
- `scripts/check.ts`: portable source and built-site verification.
- `public/`: `CNAME` and `robots.txt` copied verbatim into `dist/`.

Future interactive features should start as vanilla TypeScript plus CSS. Add a
framework integration only for a concrete island that needs it. Server endpoints
belong in `src/pages/api/` and require an adapter; the default build stays
static.

## Visual Verification

A separate Playwright runner checks rendering health and captures screenshots
across desktop and mobile viewports. It is strictly decoupled from
`scripts/check.ts`, `npm run check`, and CI, requiring Bun and system Chromium
(`/usr/bin/chromium`). Install dependencies once and run:

```fish
bun install
just visual
```

Set `CHROMIUM_PATH` to use a different Chromium binary when the host package is
unavailable or broken:

```fish
CHROMIUM_PATH=/path/to/chrome just visual
```

Screenshots are written to `.visual/screenshots/` for core pages in both dark
(Mocha) and light (Latte) themes. The interactive HTML report is generated at
`.visual/report/index.html`.

## GitHub Pages Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`. The workflow installs
Bun, runs `bun --bun run check`, builds with Astro, validates the generated site, and
publishes `dist/` through native GitHub Actions Pages. The custom domain comes
from `public/CNAME`; the canonical URL is `https://hech.dev`.
