# AGENTS.md — Operational Rules for AI Agents

Dev Journal: Zola site published at `https://hech.dev`. Global rules:
`~/.AGENTS.md`.

---

## 1. Repository Architecture & Constraints

### 1.1 Engine & CI

- System Zola >= 0.23; no hardcoded version pins.
- `.github/workflows/deploy.yml` installs the latest Zola via
  `taiki-e/install-action` (`tool: zola`), runs `./verify.fish`, then
  `zola build`.
- Pages deploy uses pinned actions; custom domain via `static/CNAME`;
  `base_url = "https://hech.dev"`.
- CI does not run `just check` or `just visual`.

### 1.2 Templates, Styling & Links

- `base.html` is the root layout. `index.html`, `section.html`, `page.html`, and
  `tags.html` extend it; taxonomy templates extend `tags.html`.
- `macros.html` uses Tera component syntax only. No `{% macro %}`,
  `{% import %}`, `macros::`, or `self::`.
- No root-relative `(href|src)="/` in `templates/` or `static/`. Use `get_url`,
  `get_taxonomy_url`, `get_section`, or `@/…`.
- External links need `class="external-link"`, `target="_blank"`,
  `rel="noopener noreferrer"`, and the `↗` glyph.
- CSS is hand-written (`compile_sass = false`). Mocha is default, Latte is light;
  pinned card tokens must not change.
- Syntax highlighting is inline `catppuccin-mocha`; no `light_theme`,
  `dark_theme`, or `add_color_scheme`.
- `tags` taxonomy uses `feed = false`.

### 1.3 Markdown & Tooling

- `.rumdl.toml` pins `MD060.style = "compact"`, disables `MD013`, and sets
  `MD031.list-items = false`; leave `aligned-delimiter` unset.
- `rumdl` owns Markdown formatting. `just fmt` may change blog posts only for
  autofixable lint errors; never rewrite article prose as part of formatting.
- The local gate depends on system `fish`, `ripgrep`, `rumdl`, `taplo`, `typos`,
  Bun, and Zola. `gitleaks` is used when present, with a fail-closed regex
  fallback.

### 1.4 Visual Harness

- `just visual` only. Never call it from `verify.fish` or CI.
- Bun + `bun.lock`; system Chromium at `/usr/bin/chromium`; no browser
  downloads.
- Screenshots: `.visual/screenshots/`; report: `.visual/report/index.html`.
- Keep `CORE_PAGES`/`FEED_PAGES` in `tests/visual.spec.js` aligned with page and
  tag changes.

## 2. Operating Protocols

### 2.1 Editorial & Content

- Articles live in `content/blog/` with TOML front matter: `title`, ISO `date`,
  `description`, `tags`; optional top-level `updated` (never nested).
- `updated` renders only in article headers when distinct from `date`; feed
  cards show only `date`.
- `content/blog/_index.md` keeps `sort_by = "date"`, `template = "section.html"`,
  and `page_template = "page.html"`.
- Follow `docs/editorial-workflow.md`: evidence-bounded claims, no invented
  metrics, synthetic data, no secrets or private paths.
- Specs in `docs/specs/` are historical; `verify.fish` wins contradictions.

### 2.2 Content Invariants

- `content/blog/offline-visual-verification.md` is contract-pinned: exact title
  and tags.
- Homepage keeps the `Hi, I’m Chen.` intro and `Latest articles` feed. Keep the
  project band commented out and keep its `ensub` URL; `verify.fish` asserts it.
- Renaming a published article changes its URL; get operator direction first.
- `just fmt` runs `rumdl fmt` over all tracked Markdown. Blog posts change only
  for autofixable lint errors; do not rewrite their prose.

### 2.3 Verification Gates

- `just preflight`: required tools and contract files; fail-closed.
- `just fmt`: fish, TOML, JS, CSS, all tracked Markdown, justfile.
- `just lint`: rumdl, fish syntax and formatting, TOML, JS/CSS, typos, justfile,
  staged and unstaged diff whitespace; rejects non-Bun lockfiles.
- `just secrets`: `gitleaks` with fail-closed regex fallback.
- `just site`: `zola build`, `./verify.fish`, `zola check --skip-external-links`.
- `just check`: canonical gate over `preflight`, `lint`, `secrets`, and `site`.
  No visual harness.
- `just check-fast`: same four gates in parallel.
- `just visual`: rendering checks only.
- Global pre-push runs `just check`. No `precommit` recipe here; global
  pre-commit uses staged whitespace/secret fallback.

## 3. Forbidden Actions

- No legacy Tera macro syntax.
- No root-relative URLs.
- No dual-theme syntax highlighting config.
- No hardcoded Zola version pins.
- No visual verification in CI or `verify.fish`.
- No changes to contract-pinned content or homepage structure without operator
  direction.
- No non-Bun lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`).
- No Markdown tables in `AGENTS.md`.
- No committing `public/`, `.visual/`, `test-results/`, or `playwright-report/`.
- Do not weaken gates to make a change pass.

## 4. Verification Checklist

```fish
just fmt
just check
just visual   # only when templates, CSS, JS, or rendered content changes
git status --short --branch
```

Leave changes unstaged. Report what changed, where, why, how verified, and what
remains.
