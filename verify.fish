#!/usr/bin/env fish

# Dev Journal site contract (Fish-native). Enforces the repository's site
# invariants plus a decoupled (unpinned) Zola engine gate. Exits non-zero on
# the first failure and zero only when every check passes.

function fail
    printf 'FAIL: %s\n' $argv[1] >&2
    exit 1
end

function assert_file
    test -f $argv[1]; or fail "missing $argv[1]"
end

function assert_contains
    set -l file $argv[1]
    set -l text $argv[2]
    rg --fixed-strings --quiet -- $text $file; or fail "$file does not contain: $text"
end

# 1. Required files.
set -l required_files
set -a required_files config.toml
set -a required_files content/_index.md
set -a required_files content/blog/_index.md
set -a required_files content/blog/offline-visual-verification.md
set -a required_files templates/base.html
set -a required_files templates/index.html
set -a required_files templates/page.html
set -a required_files templates/section.html
set -a required_files templates/tags.html
set -a required_files templates/taxonomy_list.html
set -a required_files templates/taxonomy_single.html
set -a required_files templates/macros.html
set -a required_files static/css/site.css
set -a required_files static/js/site.js
set -a required_files .github/workflows/deploy.yml
set -a required_files README.md

for file in $required_files
    assert_file $file
end

# 2. config.toml structure, taxonomies, inline highlighting, no legacy color keys.
assert_contains config.toml 'base_url = "https://hech.dev"'
assert_contains config.toml 'name = "tags"'
assert_contains config.toml '[markdown.highlighting]'
assert_contains config.toml 'style = "inline"'
assert_contains config.toml 'theme = "catppuccin-mocha"'

if rg -n -- '^(light_theme|dark_theme|add_color_scheme) =' config.toml
    fail 'dual syntax-highlighting theme configuration found in config.toml'
end

# 3. Content invariants.
assert_contains content/blog/_index.md 'sort_by = "date"'
assert_contains content/blog/_index.md 'page_template = "page.html"'
assert_contains content/blog/offline-visual-verification.md 'title = "Offline-First Visual Verification: A Decoupled Playwright Harness"'
assert_contains content/blog/offline-visual-verification.md 'tags = ["Playwright", "Bun", "CSS", "Zola"]'

# 4. Template invariants (Zola 0.23+ component syntax; no legacy macro/import).
assert_contains templates/base.html 'get_url(path="css/site.css")'
assert_contains templates/base.html 'get_url(path="js/site.js")'
assert_contains templates/base.html 'data-theme-toggle'
assert_contains templates/index.html 'https://github.com/flasheddy/ensub'
assert_contains templates/index.html '{{<post_item post={post} />}}'
assert_contains templates/page.html 'page.reading_time'
assert_contains templates/page.html 'Back to Articles'
assert_contains templates/macros.html '{% component tag_list(tags) %}'
assert_contains templates/macros.html '{% component post_item(post) %}'
assert_contains templates/macros.html "get_taxonomy_url(kind='tags', term=tag)"

if rg -n -- '\{% (import|macro) |macros::|self::' templates
    fail 'legacy Tera macro syntax found in templates'
end

# 5. Static asset invariants.
assert_contains static/css/site.css 'background: #181825;'
assert_contains static/css/site.css 'border: 1px solid #313244;'
assert_contains static/css/site.css 'border-radius: 8px;'
assert_contains static/css/site.css 'padding: 1.25rem 1.35rem;'
assert_contains static/css/site.css 'padding: 1.1rem;'
assert_contains static/js/site.js "const storageKey = 'dev-journal-theme';"
assert_contains static/js/site.js 'navigator.clipboard.writeText'

# 6. CI/deployment: GitHub Actions versions stay pinned; Zola engine is decoupled.
assert_contains .github/workflows/deploy.yml 'actions/configure-pages@v5'
assert_contains .github/workflows/deploy.yml 'actions/upload-pages-artifact@v3'
assert_contains .github/workflows/deploy.yml 'actions/deploy-pages@v4'
assert_contains .github/workflows/deploy.yml 'tool: zola'

# 7. Decoupled Zola engine: reject any hardcoded version pin.
if rg -n -- 'zola@[0-9]' .github/workflows/deploy.yml
    fail 'hardcoded Zola engine version pin in .github/workflows/deploy.yml (use unpinned "tool: zola")'
end
if rg -n -- '0\.23\.3' README.md AGENTS.md docs/editorial-workflow.md config.toml
    fail 'hardcoded Zola 0.23.3 version pin found in docs/config'
end

# 8. No root-relative asset or navigation URLs.
if rg -n --glob '*.html' --glob '*.css' --glob '*.js' '(href|src)="/' templates static
    fail 'root-relative asset or navigation URL found'
end

# 9. Internal link integrity.
zola check --skip-external-links; or fail 'zola check --skip-external-links failed'

printf 'PASS: site contract\n'
