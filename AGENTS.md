# AGENTS.md — Operational Rules for AI Agents

<!-- floor-contract: sha256:cdeb6f92d0948419c1a36387e1675722f37256186f4996d1a1d83479c1ad59ae -->

Binding contract for AI agents (Antigravity CLI, OpenCode) in this repository.
Inherits the workstation-wide safety floor in `~/.AGENTS.md`.
Carries only non-obvious traps, verification gates, and mandatory workflows.

---

## 1. Repository Architecture & Constraints

### 1.1 Engine & CI Architecture

- **Generator:** system Zola, with no hardcoded engine version pin. Host Zola
  must be 0.23 or later for Tera component syntax.
- **Decoupled engine contract:** `.github/workflows/deploy.yml` installs the
  latest Zola via `taiki-e/install-action` (`tool: zola`). Hardcoded version pins
  in workflow files or documentation are strictly rejected by the site contract.
- **Deployment:** push to `main` triggers GitHub Pages deployment with pinned
  actions (`configure-pages@v5`, `upload-pages-artifact@v3`, `deploy-pages@v4`).
- **Domain & Base URL:** custom domain via `static/CNAME` (`hech.dev`);
  `base_url = "https://hech.dev"`.

### 1.2 Templates, Components & Styling

- **Tera templates (`templates/`):** `base.html` is the root layout;
  `index.html` (homepage), `section.html` (archive), `page.html` (article), and
  `tags.html` / `taxonomy_list.html` / `taxonomy_single.html` extend it.
- **Component syntax only (`templates/macros.html`):** define via
  `{% component tag_list(tags) %} … {% endcomponent tag_list %}`; invoke via
  `{{<post_item post={post} />}}`. Legacy Tera syntax (`{% macro %}`,
  `{% import %}`, `macros::`, `self::`) is rejected by the site contract.
- **CSS & Themes (`static/css/site.css`):** hand-written CSS
  (`compile_sass = false`). Catppuccin Mocha is default dark; Latte is light
  variant. Scoped to `:root` and `html[data-theme="latte"]`, toggled by
  `static/js/site.js` (localStorage key `dev-journal-theme`, no-FOUC bootstrap
  in `base.html`). Pinned card tokens (`#181825`, border `#313244`, radius
  `8px`, padding `1.25rem 1.35rem` / responsive `1.1rem`) must not be changed.
- **Syntax highlighting:** inline highlighting via `[markdown.highlighting]`
  with `theme = "catppuccin-mocha"`. Dual-theme configuration (`light_theme`,
  `dark_theme`, `add_color_scheme`) is forbidden.

### 1.3 Link Portability & Taxonomy

- **No root-relative URLs:** `(href|src)="/` is rejected in `templates/` and
  `static/`. Internal links must use `get_url`, `get_taxonomy_url`,
  `get_section`, or `@/…` paths.
- **External links:** outbound links use `class="external-link"`,
  `target="_blank"`, `rel="noopener noreferrer"`, and decorative glyph
  `<span aria-hidden="true">↗</span>`.
- **Taxonomy:** `tags` taxonomy (`feed = false`).

### 1.4 Visual Verification Harness

- **Decoupled Playwright runner (`verify-visual.fish`):** checks rendering
  health and writes screenshots to `.visual/screenshots/`.
- **Toolchain:** managed by Bun (`bun.lock`; never generate or commit
  `package-lock.json`). Uses system Chromium (`/usr/bin/chromium`); never
  download Playwright browsers.
- **Decoupling invariant:** visual verification must never be called by
  `verify.fish` or added to `.github/workflows/deploy.yml`.

---

## 2. Operating Protocols

### 2.1 Editorial Standards & Front Matter

- **Article format:** articles live in `content/blog/` with TOML front matter:

  ```toml
  +++
  title = "Post title"
  date = 2026-09-26          # ISO year-month-day
  description = "Short summary for lists and metadata."
  [taxonomies]
  tags = ["Playwright", "Bun", "CSS", "Zola"]
  +++
  ```

- **Writing discipline:** follow `docs/editorial-workflow.md`. Factual claims
  must be evidence-bounded (observed command output, reviewed source diff, or
  explicitly labeled hypothesis).
- **Synthetic data & redaction:** never commit credentials, personal data, or
  private paths. Use synthetic placeholders.
- **Approval gates:** drafting and local checks are read-only; publishing or
  remote pushing requires explicit operator approval (`draft` →
  `locally validated` → `published`).

### 2.2 Content Invariants & Stability

- **Contract-pinned content:** never alter, rename, retag, or displace
  `content/blog/offline-visual-verification.md` (exact title
  `Offline-First Visual Verification: A Decoupled Playwright Harness` and tags
  `["Playwright", "Bun", "CSS", "Zola"]`).
- **Homepage structure:** preserve intro ("Hi, I'm Chen.") and latest articles
  feed in `templates/index.html`. Keep the featured project band commented out.

### 2.3 Verification Gates & Justfile Entry Points

All checks are codified in `justfile` and fail closed:

- `just check-agents`: validates `AGENTS.md` against 7 hygiene rules (no
  tables, bun fmt idempotency, 32KB cap, single H1, no duplicate bullets >= 40
  chars, balanced fences, floor freshness).
- `just fmt`: formats Fish scripts (`fish_indent`), TOML (`taplo`), JavaScript
  and tracked Markdown docs (`bun fmt`), and the `justfile` (`just --fmt`).
- `just lint`: static checks for Fish syntax (`fish -n`), TOML formatting, JS
  syntax and formatting (`bun`), typos (`typos`), justfile formatting, and git diff whitespace.
- `just secrets`: fail-closed secret scanning via `gitleaks` with fallback
  regex checks.
- `just site`: executes `zola build`, `./verify.fish`, and internal link checks.
- `just check-fast`: parallel gate execution (pinned to 3 jobs).
- `just check`: canonical full verification gate (`check-agents lint secrets site`).
- `just visual`: runs decoupled Playwright visual verification.
- `just floor-stamp`: refreshes floor-contract marker against live
  `~/.AGENTS.md`.

---

## 3. Forbidden Actions

Inherits workstation-wide forbidden actions in `~/.AGENTS.md`. Dev-journal
specific:

1. **Never use legacy Tera macro syntax**: no `{% macro %}`, `{% import %}`,
   `macros::`, or `self::` in `templates/`.
2. **Never hardcode root-relative asset or navigation URLs**: no `(href|src)="/`
   in `templates/` or `static/`.
3. **Never add dual-theme syntax highlighting config**: no `light_theme`,
   `dark_theme`, or `add_color_scheme` in `config.toml`.
4. **Never hardcode Zola engine version pins**: no `zola@[0-9]` in CI workflow
   or hardcoded engine version strings in documentation.
5. **Never couple visual verification into CI or `verify.fish`**: keep
   Playwright harness strictly decoupled and optional.
6. **Never alter contract-pinned content**: do not modify
   `content/blog/offline-visual-verification.md` title/tags or displace homepage
   structure without explicit operator direction.
7. **Never generate or commit `package-lock.json`**: use Bun exclusively
   (`bun.lock`).
8. **Never mutate unformatted content files blindly**: `just fmt` restricts
   markdown formatting to tracked documentation/agent files, preserving blog
   post markup stability.
9. **Never use Markdown tables in `AGENTS.md`**: tables break bun fmt
   idempotency and trigger the hygiene gate.

---

## 4. Verification Checklist

After changes, run:

```fish
just fmt             # format fish, toml, markdown docs, justfile
just check           # full verification gate (agents, lint, secrets, site contract)
git status --short   # clean working tree, no secrets staged
```
