# AGENTS.md

Guidance for AI agents working in this repository. Dev Journal is a personal
engineering journal built with Zola and deployed to GitHub Pages. Follow these
rules exactly; several are enforced by `verify.fish` and will fail CI if
violated.

## Architecture & Tooling

- **Generator:** system Zola, with no hardcoded engine version pin. Templates
  use Zola 0.23+ component syntax, so the host Zola must be 0.23 or later;
  `.github/workflows/deploy.yml` installs the latest Zola via
  `taiki-e/install-action` (`tool: zola`). The site contract rejects any
  hardcoded engine version pin.
- **Templating:** Tera templates in `templates/`. `base.html` is the layout
  (head, header/nav, footer, theme bootstrap script); `index.html` (homepage),
  `section.html` (blog archive), `page.html` (article), and
  `tags.html` / `taxonomy_list.html` / `taxonomy_single.html` (tag taxonomy)
  extend it.
- **Components:** Reusable template units live in `templates/macros.html` using
  the component syntax:
  - Define: `{% component tag_list(tags) %} … {% endcomponent tag_list %}`
  - Invoke: `{{<post_item post={post} />}}`
  - **Never** use legacy `{% macro %}` / `{% import %}` / `macros::` /
    `self::` syntax — the contract test rejects it.
- **Styling:** Hand-written CSS in `static/css/site.css` (`compile_sass = false`).
  Catppuccin **Mocha** is the default dark theme; **Latte** is the light
  variant. Themes are CSS custom properties scoped to `:root` and
  `html[data-theme="latte"]`, switched via the `data-theme` attribute by
  `static/js/site.js` (localStorage key `dev-journal-theme`, with a no-FOUC
  bootstrap script in `base.html`). Syntax highlighting uses
  `[markdown.highlighting]` with `style = "inline"` and
  `theme = "catppuccin-mocha"`; do **not** add `light_theme`, `dark_theme`,
  or `add_color_scheme` (dual-theme highlighting config is forbidden).
- **JavaScript:** `static/js/site.js` is a dependency-free IIFE providing the
  theme toggle and code-block copy buttons (progressive enhancement,
  `navigator.clipboard` with textarea fallback). Keep it vanilla.
- **Deployment:** Push to `main` triggers `.github/workflows/deploy.yml`:
  checkout → install Zola → `actions/configure-pages@v5` → install `fish` +
  `ripgrep` → `./verify.fish` → `zola build` →
  `actions/upload-pages-artifact@v3` (`path: public`) →
  `actions/deploy-pages@v4`. Pages source must be "GitHub Actions". Custom
  domain via `static/CNAME` (`hech.dev`); `base_url = "https://hech.dev"`.
- **Config invariants (`config.toml`):** keep `base_url`, the `tags` taxonomy
  (`feed = false`), `minify_html = true`, `compile_sass = false`,
  `generate_feeds = false`, the markdown external-link settings, the inline
  catppuccin-mocha highlighting block, and `[extra] github_url` intact unless
  the user explicitly asks to change them.

## Verification Contract

Every change — content, template, style, script, config, or workflow — MUST
pass these commands from the repository root before being presented as done or
committed:

```fish
zola build
./verify.fish
zola check --skip-external-links
```

Additionally, before committing, run the editorial validation checklist from
`docs/editorial-workflow.md`:

```fish
git diff --check
# For each new untracked file:
git diff --no-index --check /dev/null <path-to-new-file>   # expect status 1, no output
git status --short --branch                                 # confirm no unrelated changes
```

Key invariants enforced by `verify.fish` (do not break these):

- All required files exist (config, content, every template, `site.css`,
  `site.js`, `deploy.yml`, `README.md`).
- No root-relative asset or navigation URLs: `(href|src)="/` is rejected in
  `templates/` and `static/`. Always use `get_url`, `get_taxonomy_url`,
  `get_section`, or `@/…` internal link paths so project-site and preview
  deployments stay portable.
- `base.html` keeps `get_url(path="css/site.css")`, `get_url(path="js/site.js")`,
  and the `data-theme-toggle` control.
- `page.html` keeps `page.reading_time` and the "Back to Articles" links.
- `site.css` keeps the pinned card tokens: `background: #181825;`,
  `border: 1px solid #313244;`, `border-radius: 8px;`,
  `padding: 1.25rem 1.35rem;`, and the responsive `padding: 1.1rem;`.
- `site.js` keeps `const storageKey = 'dev-journal-theme';` and
  `navigator.clipboard.writeText`.
- `deploy.yml` keeps the pinned action versions (`configure-pages@v5`,
  `upload-pages-artifact@v3`, `deploy-pages@v4`) while installing Zola
  unpinned (`tool: zola`); `README.md` targets system Zola with no hardcoded
  engine version.

## Visual Verification Harness

A decoupled Playwright runner (`verify-visual.fish`) checks rendering health
and captures screenshots. It is deliberately separate from `verify.fish` and
from the GitHub Pages deploy workflow:

- **Package management:** Bun. The committed lockfile is `bun.lock`; never
  generate or commit `package-lock.json`. Install deps with `bun install`.
- **Browser:** system Chromium via `executablePath` (`/usr/bin/chromium`);
  the harness never downloads a Playwright browser and must not call
  `playwright install`.
- **Strict decoupling:** `verify-visual.fish` must not be invoked by
  `verify.fish` and must not be added to `.github/workflows/deploy.yml`; CI
  stays fast and dependency-free.
- **Artifacts:** screenshots go to `.visual/screenshots/` (gitignored); the
  HTML report is `.visual/report/index.html`. `node_modules/`, `.visual/`,
  `test-results/`, and `playwright-report/` are gitignored.

## Editorial & Content Invariants

- **Do not alter, rename, retag, or displace existing articles or core
  portfolio sections without explicit user direction.** In particular:
  - `content/blog/offline-visual-verification.md` — its exact title
    ("Offline-First Visual Verification: A Decoupled Playwright Harness") and tags
    (`["Playwright", "Bun", "CSS", "Zola"]`) are contract-pinned.
  - The homepage (`templates/index.html`) structure: intro ("Hi, I'm Chen.")
    and the **Latest articles** feed. The **Current project** band is
    intentionally left commented out so the journal can spotlight a future
    featured project; do not re-enable or hardcode a specific project pin.
- **New articles** go in `content/blog/` with TOML front matter:

  ```toml
  +++
  title = "Post title"
  date = 2026-09-26          # ISO year-month-day
  description = "Short summary for lists and metadata."
  [taxonomies]
  tags = ["Playwright", "Bun", "CSS", "Zola"]
  +++
  ```

  The blog section (`content/blog/_index.md`) sorts by `date` and renders
  articles with `page.html`; tag index/detail pages are automatic.
- **Writing standards:** follow `docs/editorial-workflow.md`. Claims must be
  evidence-bounded (observed command output, reviewed source, or a labeled
  hypothesis); never invent metrics, completion status, or remote
  verification; redact secrets and private data; respect the article status
  labels (`draft` → `locally validated` → `published`) and approval gates.

## External Links

- Outbound links in templates use the established pattern: `class="external-link"`,
  `target="_blank"`, `rel="noopener noreferrer"`, and a decorative glyph
  `<span aria-hidden="true">↗</span>` (see the GitHub nav link and the Ensub
  project link in `base.html` / `index.html`).
- In Markdown content, external links already open in a new tab via
  `external_links_target_blank = true`; write them as normal Markdown links.
- Internal links always use Zola URL helpers (`get_url(path='@/…')`) — never
  hard-code `/` paths.

## Change Workflow

1. **Propose first.** Present the planned diff and a short explanation of what
   changes and why. Wait for explicit user confirmation before editing.
2. **Edit minimally.** Touch only the files the change requires; preserve
   existing templates, configuration, workflow, tests, and content unless the
   user directed otherwise.
3. **Verify.** Run `zola build`, `./verify.fish`, and
   `zola check --skip-external-links` (plus the git whitespace checks for
   commits). Do not present a change as complete with failing or skipped
   checks.
4. **Report.** Summarize what changed, the verification output, and any
   mismatches discovered (e.g., the host Zola lacks 0.23+ component syntax).
5. **No publishing without approval.** Committing, pushing, or triggering
   deployment requires explicit owner approval, per the editorial workflow's
   approval gates.
