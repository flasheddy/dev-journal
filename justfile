set shell := ["fish", "-c"]

export JUST_ROOT := justfile_directory()

alias c := check
alias cf := check-fast
alias f := fmt

# Default recipe: runs the canonical verification gate.
[group("gate")]
default: check

# Fast verification gate: preflight first, then lint, secrets, and site in parallel.
[group("gate")]
check-fast: preflight _check-fast

# Parallel verification set; only runs after preflight succeeds.
[parallel]
_check-fast: lint secrets site

# Full canonical verification gate.
[group("gate")]
check: preflight lint secrets site

# Standalone preflight check for required tools and contract files. Fail-closed.
[group("toolchain")]
preflight:
    #!/usr/bin/env fish
    cd $JUST_ROOT
    set -l failed 0
    for tool in bun fish git just rg rumdl taplo typos
        if not command -v $tool >/dev/null
            echo "FAIL: missing required tool '$tool'" >&2
            set failed 1
        end
    end
    for req in AGENTS.md README.md package.json astro.config.mjs src/content.config.ts justfile
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

# Minimal Astro policy: no .astro formatter. Local Helix keeps auto-format off,
# and `astro check` validates components; do not add Prettier to this loop.
# Auto-format Fish scripts, TOML configs, JavaScript/TypeScript, CSS, Markdown, and justfile.
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
    set -l web
    for ext in js mjs cjs ts css
        for f in (git ls-files "*.$ext")
            test -f $f; and set -a web $f
        end
    end
    if test (count $web) -gt 0
        bun fmt $web; or set failed 1
    end
    set -l mds
    for m in (git ls-files "*.md")
        test -f $m; and set -a mds $m
    end
    if test (count $mds) -gt 0
        rumdl fmt $mds; or set failed 1
    end
    just --fmt; or set failed 1
    if test $failed -ne 0
        echo "VERIFY FAILED: fmt" >&2
        exit 1
    end
    echo "fmt: formatted fish, toml, js/ts, css, markdown, and justfile"

# Mirrors `fmt`: every formatter above has a matching check here.
# Static and structural lint plus the shared Astro/source contract.
[group("verify")]
lint:
    #!/usr/bin/env fish
    cd $JUST_ROOT
    set -l failed 0
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
    set -l web
    for ext in js mjs cjs ts css
        for f in (git ls-files "*.$ext")
            test -f $f; and set -a web $f
        end
    end
    if test (count $web) -gt 0
        bun fmt --check $web >/dev/null 2>&1; or begin
            echo "FAIL: javascript/typescript/css files are not formatted; run 'just fmt'" >&2
            set failed 1
        end
    end
    set -l mds
    for m in (git ls-files "*.md")
        test -f $m; and set -a mds $m
    end
    if test (count $mds) -gt 0
        rumdl fmt --check $mds >/dev/null; or begin
            echo "FAIL: tracked markdown files are not rumdl-clean; run 'just fmt'" >&2
            set failed 1
        end
    end
    if not just --fmt --check >/dev/null 2>&1
        echo "FAIL: justfile is not formatted; run 'just --fmt' or 'just fmt'" >&2
        set failed 1
    end
    typos; or set failed 1
    git diff --check; or set failed 1
    git diff --cached --check; or set failed 1
    if set -q JUST_CHECK_VERBOSE; and test "$JUST_CHECK_VERBOSE" != 0
        bun run check; or set failed 1
    else
        set -l check_log (mktemp -t dev-journal-check.XXXXXX.log)
        bun run check >$check_log 2>&1
        set -l check_rc $status
        if test $check_rc -ne 0
            echo "FAIL: bun run check (exit $check_rc); full log: $check_log" >&2
            tail -n 80 $check_log >&2
            set failed 1
        else
            awk '
                /^- [0-9]+ errors?$/ { errors = $2 }
                /^- [0-9]+ warnings?$/ { warnings = $2 }
                /^- [0-9]+ hints?$/ { hints = $2 }
                /^check: source contract ok/ { source = $0 }
                /^[[:space:]]+[0-9]+ pass$/ { passed = $1 }
                /^[[:space:]]+[0-9]+ fail$/ { failed_tests = $1 }
                END {
                    if (errors != "") {
                        printf "astro check: %s errors, %s warnings, %s hints\n", errors, warnings, hints
                    }
                    if (source != "") print source
                    if (passed != "") {
                        printf "tests: %s passed, %s failed\n", passed, failed_tests
                    }
                }
            ' $check_log
            if grep -q -E '^- [1-9][0-9]* (warnings?|hints?)$' $check_log
                grep -i -E 'warning|hint' $check_log | grep -v -E '^- [0-9]+ (warnings?|hints?)$' | head -n 20
                echo "astro check details: $check_log"
            else
                rm -f $check_log
            end
        end
    end
    if test $failed -ne 0
        echo "VERIFY FAILED: lint" >&2
        exit 1
    end
    echo "lint: fish, toml, js/ts, css, markdown, justfile, typos, lockfiles, whitespace, astro contract"

# Run the Bun unit test suite.
[group("verify")]
test:
    cd $JUST_ROOT && bun run test

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

    set -l tracked
    for f in (git ls-files)
        test -f $f; and set -a tracked $f
    end
    if test (count $tracked) -eq 0
        echo "secrets: no tracked files to scan; refusing to pass" >&2
        exit 1
    end
    if printf '%s\n' $tracked | xargs -r rg -l -- '-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----'
        echo "secrets: private-key material found in tracked files." >&2
        exit 1
    end
    if printf '%s\n' $tracked | xargs -r rg -l -i -E '(password|passwd|secret|api[-_]?key|access[-_]?key|client[-_]?secret|auth[-_]?token)[[:space:]]*[:=][[:space:]]*[^[:space:]]{8,}'
        echo "secrets: credential-shaped string found in tracked files." >&2
        exit 1
    end
    if printf '%s\n' $tracked | rg -i '(^|/)(id_(rsa|ed25519|ecdsa|dsa)|[^/]*\.(pem|key|ppk|p12|pfx))$'
        echo "secrets: private-key filename tracked." >&2
        exit 1
    end
    echo "secrets: no secret material detected"

# Run the Astro development server with live reload.
[group("site")]
serve *args:
    #!/usr/bin/env fish
    cd $JUST_ROOT
    if test (count $args) -gt 0
        bun run dev -- $args
    else
        bun run dev
    end

# Build the static Astro site into dist/.
[group("site")]
build:
    cd $JUST_ROOT && bun run build

# Full site gate: build, then verify generated routes, links, and contracts.
[group("site")]
site:
    #!/usr/bin/env fish
    cd $JUST_ROOT
    set -l build_rc 0
    if set -q JUST_CHECK_VERBOSE; and test "$JUST_CHECK_VERBOSE" != 0
        bun run build
        set build_rc $status
    else
        set -l build_log (mktemp -t dev-journal-build.XXXXXX.log)
        bun run build >$build_log 2>&1
        set build_rc $status
        if test $build_rc -eq 0
            set -l pages (grep -oE '[0-9]+ page\(s\) built' $build_log | tail -n 1 | grep -oE '^[0-9]+')
            if test -n "$pages"
                echo "build: $pages pages"
            else
                echo "build: ok"
            end
            rm -f $build_log
        else
            echo "FAIL: bun run build (exit $build_rc); full log: $build_log" >&2
            tail -n 80 $build_log >&2
        end
    end
    if test $build_rc -ne 0
        exit $build_rc
    end
    bun run --silent check:built
    set -l built_rc $status
    if test $built_rc -ne 0
        exit $built_rc
    end
    bun run --silent check:built:canary

# Decoupled visual verification harness (Playwright + Bun + system Chromium).
[group("site")]
visual:
    #!/usr/bin/env fish
    cd $JUST_ROOT
    if not command -v bun >/dev/null 2>&1
        echo "FAIL: missing required tool: bun" >&2
        exit 1
    end
    set -l chromium_bin "$CHROMIUM_PATH"
    if test -z "$chromium_bin"
        set chromium_bin chromium
    end
    if not test -x "$chromium_bin"; and not command -v $chromium_bin >/dev/null 2>&1
        echo "FAIL: missing Chromium at '$chromium_bin' (set CHROMIUM_PATH to override)" >&2
        exit 1
    end
    if not test -f node_modules/.bin/playwright
        echo "FAIL: Playwright not installed. Run: bun install" >&2
        exit 1
    end
    bun run test:visual
    set -l rc $status
    if test $rc -eq 0
        printf '\nScreenshots: .visual/screenshots/\nHTML report: .visual/report/index.html\n'
    end
    exit $rc
