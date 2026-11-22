set shell := ["fish", "-c"]

export JUST_ROOT := justfile_directory()

alias c := check
alias cf := check-fast
alias f := fmt

# Default recipe: runs the canonical verification gate.
[group("gate")]
default: check

# Fast parallel verification gate (preflight, lint, secrets, site).
[group("gate")]
[parallel]
check-fast: preflight lint secrets site

# Full canonical verification gate.
[group("gate")]
check: preflight lint secrets site

# Standalone preflight check for required tools and contract files. Fail-closed.
[group("toolchain")]
preflight:
    #!/usr/bin/env fish
    cd $JUST_ROOT
    set -l failed 0
    for tool in bun fish git just rg rumdl taplo typos zola
        if not command -v $tool >/dev/null
            echo "FAIL: missing required tool '$tool'" >&2
            set failed 1
        end
    end
    for req in AGENTS.md README.md config.toml .rumdl.toml
        if not test -f $req
            echo "FAIL: missing required contract file '$req'" >&2
            set failed 1
        end
    end
    if test $failed -ne 0
        echo "VERIFY FAILED: preflight" >&2
        exit 1
    end
    echo "preflight: tools and contract files ok"

# Auto-format Fish scripts, TOML configs, JavaScript, CSS, Markdown, and justfile.
[group("toolchain")]
fmt:
    #!/usr/bin/env fish
    cd $JUST_ROOT
    set -l failed 0
    for f in (git ls-files "*.fish")
        test -f $f; or continue
        fish_indent -w $f; or set failed 1
    end
    set -l tomls
    for t in (git ls-files "*.toml")
        test -f $t; and set -a tomls $t
    end
    if test (count $tomls) -gt 0
        env RUST_LOG=warn taplo format $tomls; or set failed 1
    end
    set -l js_css
    for j in (git ls-files "*.js")
        test -f $j; and set -a js_css $j
    end
    for c in (git ls-files "*.css")
        test -f $c; and set -a js_css $c
    end
    if test (count $js_css) -gt 0
        bun fmt $js_css; or set failed 1
    end
    set -l mds (git ls-files "*.md")
    if test (count $mds) -gt 0
        rumdl fmt $mds; or set failed 1
    end
    just --fmt; or set failed 1
    if test $failed -ne 0
        echo "VERIFY FAILED: fmt" >&2
        exit 1
    end
    echo "fmt: formatted fish scripts, toml, javascript, css, markdown, and justfile"

# Static and structural lint: markdown, fish, TOML, JS/CSS, typos, justfile, whitespace.
[group("verify")]
lint:
    #!/usr/bin/env fish
    cd $JUST_ROOT
    set -l failed 0
    for rogue in package-lock.json pnpm-lock.yaml yarn.lock
        if test -f $rogue
            echo "FAIL: rogue lockfile detected: $rogue (use bun.lock exclusively)" >&2
            set failed 1
        end
    end
    set -l mds (git ls-files "*.md")
    if test (count $mds) -gt 0
        rumdl fmt --check $mds >/dev/null; or begin
            echo "FAIL: tracked markdown files are not rumdl-clean; run 'just fmt'" >&2
            set failed 1
        end
    end
    for f in (git ls-files "*.fish")
        test -f $f; or continue
        if not fish -n $f
            echo "FAIL: $f (fish syntax)" >&2
            set failed 1
        end
        if not fish_indent --check $f >/dev/null
            echo "FAIL: $f (fish formatting; run 'just fmt')" >&2
            set failed 1
        end
    end
    set -l tomls
    for t in (git ls-files "*.toml")
        test -f $t; and set -a tomls $t
    end
    if test (count $tomls) -gt 0
        env RUST_LOG=warn taplo format --check $tomls; or set failed 1
    end
    set -l jss
    for j in (git ls-files "*.js")
        test -f $j; or continue
        if not bun build --no-bundle $j >/dev/null 2>&1
            echo "FAIL: $j (syntax check)" >&2
            set failed 1
        end
        set -a jss $j
    end
    if test (count $jss) -gt 0
        bun fmt --check $jss >/dev/null 2>&1; or begin
            echo "FAIL: javascript files are not formatted; run 'just fmt'" >&2
            set failed 1
        end
    end
    set -l csss
    for c in (git ls-files "*.css")
        test -f $c; and set -a csss $c
    end
    if test (count $csss) -gt 0
        bun fmt --check $csss >/dev/null 2>&1; or begin
            echo "FAIL: css files are not formatted; run 'just fmt'" >&2
            set failed 1
        end
    end
    typos; or set failed 1
    if not just --fmt --check >/dev/null 2>&1
        echo "FAIL: justfile is not formatted; run 'just --fmt' or 'just fmt'" >&2
        set failed 1
    end
    git diff --check; or set failed 1
    git diff --cached --check; or set failed 1
    if test $failed -ne 0
        echo "VERIFY FAILED: lint" >&2
        exit 1
    end
    echo "lint: markdown, fish syntax/format, toml, js, css, typos, justfile, whitespace"

# Secret scan (gitleaks, fail-closed rg fallback).
[group("verify")]
secrets:
    #!/usr/bin/env fish
    cd $JUST_ROOT
    if command -v gitleaks >/dev/null
        gitleaks dir . --no-banner --redact --log-level warn; or begin
            echo "secrets: gitleaks detected secret material in the working tree." >&2
            exit 1
        end
        echo "secrets: no secret material detected"
        exit 0
    end

    if not command -v rg >/dev/null
        echo "secrets: neither gitleaks nor rg available; refusing to pass" >&2
        exit 1
    end

    if git ls-files -z | xargs -0 -r rg -l -- '-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----'
        echo "secrets: private-key material found in tracked files." >&2
        exit 1
    end
    if git ls-files -z | xargs -0 -r rg -l -i -E '(password|passwd|secret|api[-_]?key|access[-_]?key|client[-_]?secret|auth[-_]?token)[[:space:]]*[:=][[:space:]]*[^[:space:]]{8,}'
        echo "secrets: credential-shaped string found in tracked files." >&2
        exit 1
    end
    if git ls-files | rg -i '(^|/)(id_(rsa|ed25519|ecdsa|dsa)|[^/]*\.(pem|key|ppk|p12|pfx))$'
        echo "secrets: private-key filename tracked." >&2
        exit 1
    end
    echo "secrets: no secret material detected"

# Run local preview server with live reload.
[group("site")]
serve *args:
    cd $JUST_ROOT && zola serve {{ args }}

# Build Zola site to public/ directory.
[group("site")]
build:
    cd $JUST_ROOT && zola build

# Full site gate: build, verify invariants, and validate internal links.
[group("site")]
site: build
    #!/usr/bin/env fish
    cd $JUST_ROOT
    ./verify.fish
    zola check --skip-external-links

# Decoupled visual verification harness (Playwright + Bun + system Chromium).
[group("site")]
visual:
    cd $JUST_ROOT && ./verify-visual.fish
