# Dev Journal

Personal engineering journal at [hech.dev](https://hech.dev/).
Static Astro site run with Bun.

## Requirements

- [Bun](https://bun.sh/)
- System Chromium, only for visual checks

## Development

```fish
bun install
bun run dev
```

Open the URL the dev server prints.

`just` is optional; `just serve` starts the same server.

## Writing

Posts live in `src/content/blog/`.
Project cards live in `src/content/projects/`.
Content is Markdown with TOML front matter.

```toml
+++
title = "Post title"
date = 2026-09-26
description = "A short summary used by lists and metadata."
[taxonomies]
tags = ["Astro", "Bun"]
+++
```

The optional `updated` key is top-level. Drafts use `draft = true`.
Article URLs come from the filename, so renaming a published post changes its URL.

Project cards use `title`, `description`, `tech`, HTTPS `url`, integer `order`, and optional `draft`.

Follow [the editorial workflow](docs/editorial-workflow.md) before publishing.

## Commands

- `bun run check`: Astro/TypeScript, source contract, and unit tests.
- `bun run build`: build the static site into `dist/`.
- `bun run check:built`: validate the generated site.
- `bun run test`: run unit tests.
- `just check`: full local gate, including build and built checks.
- `just fmt`: format tracked files.
- `just visual`: render checks and screenshots; optional and not part of CI.

Run `just --list` for the remaining recipes.

## Configuration

- `PUBLIC_ASK_ENDPOINT`: optional build-time URL for live Ask Journal synthesis. Without it, Ask Journal stays static and shows ranked passages only.
- `CHROMIUM_PATH`: Chromium binary for `just visual`.

## Project layout

- `src/content/`: Markdown posts and projects.
- `src/content.config.ts`: content schemas.
- `src/lib/`: pure route, tag, date, search, and reading-time helpers.
- `src/pages/`: static pages and generated JSON, RSS, and OG endpoints.
- `src/scripts/`: client entry point and feature modules.
- `src/styles/site.css`: Catppuccin Mocha/Latte design system.
- `scripts/check/`: source and built verification.
- `tests/unit/`: Bun unit tests.
- `tests/visual.spec.js`: Playwright render checks.

## Visual checks

Visual checks use system Chromium and write screenshots to `.visual/`:

```fish
just visual
```

Set `CHROMIUM_PATH` if Chromium is not at `/usr/bin/chromium`.

## Deployment

Push to `main`. GitHub Actions runs the checks, builds `dist/`, and publishes it to GitHub Pages.
The custom domain comes from `public/CNAME`.
