+++
title = "Offline-First Visual Verification: A Decoupled Playwright Harness"
date = 2026-09-26
updated = 2026-11-23
description = "How a static journal added an offline-first visual verification harness: Playwright driving the host's system Chromium through Bun, with no browser downloads, screenshots routed to a local directory for multimodal inspection, and clamp-based typography that preserves the mobile heading hierarchy."
[taxonomies]
tags = ["Playwright", "Bun", "CSS", "Astro"]
+++

A text contract can prove that a static site builds, that its internal links resolve, and that its pages still carry the required markers. It cannot prove that a page renders without horizontal overflow, that the theme toggle actually swaps its icon, or that a heading stops fracturing on a narrow screen.

This journal now runs a second, deliberately separate check for those concerns: a Playwright harness driven by Bun against the host's own Chromium, with full-page screenshots written to a local directory for inspection. A verification pass is fully local — Astro serves a preview on the loopback address and the browser never needs to be downloaded.

## Why a visual gate for a static journal

A build can succeed long before a layout fails. The defects this gate targets are invisible to `astro build` and the source contract: content wider than the viewport, a JavaScript error logged to the console, a theme state that renders the wrong icon. They only become observable once a real browser lays the page out.

The harness turns those symptoms into assertions. Every core page must return a 200, expose the header, the main content, and the footer, keep horizontal overflow at or below one pixel, and emit no page errors. A page that breaks any of those fails the run.

## Decoupling the harness from CI

The runner is `just visual`, and it is deliberately separate from `scripts/check.ts` and the GitHub Pages deploy workflow. `scripts/check.ts` stays the fast, shell-tool-free source and built-site contract gate that CI runs, and the deploy workflow installs Bun and runs the package scripts.

The visual harness is not wired into that path. It needs Bun and system Chromium, so it remains a local, editorial check rather than a deploy gate. Nothing in `scripts/check.ts` invokes it, and nothing in `deploy.yml` references it.

## Bun plus the system Chromium

Bun manages the harness dependency, `@playwright/test`, through a committed `bun.lock`. The Playwright config then points the launcher at the host's Chromium instead of downloading one:

```js
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
```

Each project sets `launchOptions.executablePath` to that path. The harness never runs `playwright install` and never pulls a bundled browser, so the only network cost is the one-time dependency install.

## Screenshots as inspection artifacts

The spec walks seven core pages — home, the blog archive, two articles, the tags index, and two tag pages — once per viewport project: a desktop Chrome profile and a Pixel 5 profile. It also checks the theme toggle and the code-copy control. A helper derives the mode from the measured width, and every capture is named with that prefix:

```js
function viewportMode(page) {
  const viewport = page.viewportSize();
  return viewport && viewport.width <= 640 ? 'mobile' : 'desktop';
}
```

Full-page captures land in `.visual/screenshots/` and the HTML report in `.visual/report/index.html`. Because the screenshots are ordinary files in a known directory, they can be opened and inspected directly instead of being read back only through the test runner.

## Clamp-based typography

The mobile run surfaced the layout problems the contract could not see: a heading that outgrew its container, an article list that needed to stack, and words that could no longer break safely at the boundary. The fixes live in `site.css`.

Headings moved from fixed sizes to `clamp()` rules so the hierarchy stays monotonic — `h1` above `h2`, `h2` above `h3`, `h3` above body text — from the narrowest phone to the desktop:

```css
.prose h2 {
  font-size: clamp(1.25rem, 4.5vw, 1.7rem);
}
```

The body gained `word-break: normal` with `overflow-wrap: break-word`, so text wraps on word boundaries and only breaks inside an overlong token as a last resort. The header navigation wraps rather than forcing overflow, and the `40rem` query adjusts the project band and section heading; the article list remains single-column at every width.

## Limitations and next work

The screenshots are inspection artifacts, not golden baselines. The harness proves that pages render and do not overflow; it does not yet diff a capture against a previously approved image, so a subtle visual regression can still pass unnoticed.

The tooling also assumes Bun and Chromium. `CHROMIUM_PATH` can point at an existing local binary when the system package is unavailable. That is a reasonable assumption on the workstation where the journal is written, and it is precisely why the visual gate stays out of the CI path. Visual diffing, with a documented procedure for approving a new baseline, is the natural next step.
