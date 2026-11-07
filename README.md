# Dev Journal

A small static engineering journal built with [Zola](https://www.getzola.org/) and published at `https://hech.dev/`.

## Quickstart

Install system Zola (0.23 or later) and [just](https://github.com/casey/just), then start the local preview server:

```fish
just serve   # or: zola serve
```

Open the local preview URL printed in the terminal (default `http://127.0.0.1:1114`).

## Task Runner (`just`)

The repository uses `just` as its unified, fail-closed task runner:

- `just` (default): runs the canonical verification gate (`just check`).
- `just serve`: starts the local development preview server with live reload.
- `just check`: canonical full gate combining agents hygiene, static linting, secret scanning, and site contract checks.
- `just check-fast`: fast parallel gate execution (pinned to 3 worker jobs).
- `just fmt`: auto-formats Fish scripts (`fish_indent`), TOML configs (`taplo`), JavaScript files, tracked Markdown docs (`bun fmt`), and the `justfile`.
- `just lint`: static verification covering Fish syntax (`fish -n`), TOML format, JS syntax and formatting (`bun`), typos (`typos`), and Git diff whitespace.
- `just secrets`: fail-closed secret scanning via `gitleaks` (with regex fallback).
- `just visual`: runs the decoupled Playwright visual regression harness.

## Visual Verification

A separate Playwright runner checks rendering health and captures screenshots across desktop and mobile viewports. It is strictly decoupled from `./verify.fish` and CI, requiring Bun and system Chromium (`/usr/bin/chromium`). Install dependencies once and run:

```fish
bun install
just visual
```

Screenshots are written to `.visual/screenshots/` for core pages in both dark (Mocha) and light (Latte) themes. The interactive HTML report is generated at `.visual/report/index.html`.

## Writing an Article

Follow the editorial standards in [`docs/editorial-workflow.md`](docs/editorial-workflow.md). Create a Markdown file under `content/blog/` with TOML front matter:

```toml
+++
title = "Post title"
date = 2026-09-26
description = "A short summary used by article lists and metadata."
[taxonomies]
tags = ["Playwright", "Bun", "CSS", "Zola"]
+++
```

Validate changes and site invariants locally before committing:

```fish
just check
just visual
```

## GitHub Pages Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml` which builds the site and publishes the `public/` artifact through native GitHub Actions Pages. Internal links use Zola URL helpers (`get_url`) to remain portable across custom domains (`https://hech.dev`) and preview deployments.
