# Dev Journal

A small static engineering journal built with [Zola](https://www.getzola.org/) and published at `https://hech.dev/`.

## Local development

Install Zola 0.23 or later, then run:

```fish
zola serve
```

Open the local URL printed by Zola. Create a production export with:

```fish
zola build
```

The generated site is written to `public/`. Run the repository contract check with:

```fish
./verify.fish
```

## Visual verification

A separate Playwright runner checks rendering and captures screenshots. It is
decoupled from `./verify.fish` and from the GitHub Pages deploy workflow, and it
requires Bun and system Chromium (`/usr/bin/chromium`). Install the one-time
dependency and run it with:

```fish
bun install
./verify-visual.fish
```

The harness starts a local Zola preview automatically and runs the same checks in
two viewports. Each full-page screenshot is prefixed by mode and written to
`.visual/screenshots/`: `desktop-*.png` and `mobile-*.png` for the five core pages
(`home`, `blog`, `article`, `tags`, `tag-playwright`), plus the light-theme
`desktop-home-light.png` and `mobile-home-light.png`. The HTML report is
`.visual/report/index.html`.

## Writing an article

Add Markdown files under `content/blog/` using this front matter:

```toml
+++
title = "Post title"
date = 2026-09-26
description = "A short summary used by article lists and metadata."
[taxonomies]
tags = ["Playwright", "Bun", "CSS", "Zola"]
+++
```

The blog section orders articles by date. Tags automatically receive index and detail pages.

## GitHub Pages

The deployment workflow builds with Zola and publishes the `public/` artifact through GitHub's native Pages actions. In the repository settings, select **GitHub Actions** as the Pages source. Use Zola URL helpers for internal links so preview and project-site deployments both remain portable.
