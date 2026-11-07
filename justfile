set shell := ["fish", "-c"]

# Default recipe: runs the canonical verification gate.
default: check

# AGENTS.md hygiene gate (AGENTS.md §2.3). Fail-closed.
# Usage: just check-agents [file]
#
# Seven rules, each rejecting a concrete regression:
#   table     no Markdown table outside fenced code blocks — tables are not
#             formatter-stable, and bun fmt on save produces whole-block diffs
#   formatter the file must be bun fmt-idempotent, so an editor save is a no-op
#   budget    combined agent rules must stay under 32768 B, the Codex cap
#   h1        exactly one level-1 heading
#   dupe      no duplicated bullet line (>= 40 chars) — drift signal
#   fence     balanced ``` code fences
#   floor     a floor-contract marker must match the live ~/.AGENTS.md sha256

# AGENTS.md hygiene gate (fail-closed rule validation).
check-agents file="":
    #!/usr/bin/env python3
    import hashlib
    import os
    import re
    import subprocess
    import sys

    TOTAL_MAX = 32768
    # Architectural floor reserve for isolated environments (sandbox / CI) where ~/.AGENTS.md is unmounted
    FLOOR_RESERVE = 14 * 1024
    FLOOR = os.environ.get("AGENTS_FLOOR", os.path.expanduser("~/.AGENTS.md"))

    arg = "{{ file }}".strip()
    FILES = [arg] if arg else [f for f in ["AGENTS.md"] if os.path.exists(f)]

    violations = []
    total = 0

    # Include global workstation floor in the combined context budget.
    # Dynamically measure live ~/.AGENTS.md on host; fall back to FLOOR_RESERVE in sandbox/CI.
    if not any(os.path.basename(f) == "dot_AGENTS.md" for f in FILES):
        if os.path.exists(FLOOR):
            try:
                with open(FLOOR, "rb") as fh:
                    total += len(fh.read())
            except OSError:
                total += FLOOR_RESERVE
        else:
            total += FLOOR_RESERVE

    for path in FILES:
        try:
            with open(path, "rb") as fh:
                raw = fh.read()
        except OSError as exc:
            print("check-agents: cannot read " + path + ": " + str(exc), file=sys.stderr)
            sys.exit(1)

        total += len(raw)
        text = raw.decode("utf-8", "replace")
        lines = text.splitlines()

        in_fence = False
        fences = 0
        h1 = []
        table_sep = re.compile(r"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$")
        for n, line in enumerate(lines, 1):
            if line.lstrip().startswith("```"):
                fences += 1
                in_fence = not in_fence
                continue
            if not in_fence and re.match(r"^#\s", line):
                h1.append(line)
            if not in_fence and table_sep.match(line):
                violations.append(("table", path, "Markdown table at line " + str(n) + " (use a list; tables are not bun fmt)"))
        if fences % 2:
            violations.append(("fence", path, "unbalanced code fences (" + str(fences) + " ``` markers)"))

        if len(h1) != 1:
            violations.append(("h1", path, "expected exactly one level-1 heading, found " + str(len(h1))))

        seen = {}
        for line in lines:
            m = re.match(r"^\s*(?:[-*]|\d+\.)\s+(\S.*)$", line)
            if not m:
                continue
            body = m.group(1).strip()
            if len(body) >= 40:
                seen[body] = seen.get(body, 0) + 1
        for body in seen:
            if seen[body] > 1:
                violations.append(("dupe", path, "duplicated bullet " + str(seen[body]) + "x: " + body[:60]))

        marker = re.search(r"floor-contract: sha256:([0-9a-f]{64})", text)
        if marker and os.path.exists(FLOOR):
            with open(FLOOR, "rb") as fh:
                actual = hashlib.sha256(fh.read()).hexdigest()
            if marker.group(1) != actual:
                violations.append(("floor", path, "floor-contract marker is stale; run floor-stamp"))

        try:
            proc = subprocess.run(["bun", "fmt", "--stdin-filepath", path], input=raw, capture_output=True)
        except FileNotFoundError:
            violations.append(("tool", path, "bun not found; refusing to pass without the formatter check"))
        else:
            if proc.returncode != 0:
                violations.append(("formatter", path, "bun fmt failed: " + proc.stderr.decode("utf-8", "replace").strip()[:160]))
            elif proc.stdout != raw:
                delta = len(proc.stdout) - len(raw)
                if delta == 0:
                    where = "same size, different bytes"
                else:
                    where = ("+" if delta > 0 else "") + str(delta) + " B"
                violations.append(("formatter", path, "not bun fmt-idempotent (" + where + "); run bun fmt"))

    if total > TOTAL_MAX:
        violations.append(("budget", "rules", str(total) + " B exceeds " + str(TOTAL_MAX) + " B cap"))

    if violations:
        for rule, path, msg in violations:
            print("check-agents: " + rule + ": " + path + ": " + msg, file=sys.stderr)
        print("check-agents: " + str(len(violations)) + " violation(s)", file=sys.stderr)
        sys.exit(1)

    print("check-agents: rules ok (" + str(total) + " B / " + str(TOTAL_MAX) + " B)")

# Refresh the floor-contract marker in AGENTS.md against the live global floor.
floor-stamp:
    #!/usr/bin/env fish
    set -l floor $HOME/.AGENTS.md
    set -l file AGENTS.md
    if not test -f $floor
        echo "floor-stamp: no global floor at $floor" >&2
        exit 1
    end
    set -l hex (sha256sum $floor | string split ' ')[1]
    if not rg -q 'floor-contract:' $file
        echo "floor-stamp: no floor-contract marker in $file" >&2
        exit 1
    end
    set -l marker "<!-- floor-contract: sha256:$hex -->"
    set -l content (cat $file | string collect)
    set -l updated (string replace -r '<!--\s*floor-contract:\s*sha256:[0-9a-fA-F]{64}\s*-->' $marker $content | string collect)
    if test "$updated" = "$content"
        echo "floor-stamp: already current ("(string sub -l 12 $hex)")"
        exit 0
    end
    printf '%s\n' $updated >$file
    echo "floor-stamp: refreshed $file -> "(string sub -l 12 $hex)

# Auto-format supported files (Fish scripts, TOML configs, JS, tracked Markdown docs, justfile).
fmt:
    #!/usr/bin/env fish
    if command -v fish_indent >/dev/null
        for f in (git ls-files "*.fish")
            test -f $f; and fish_indent -w $f
        end
    end
    if command -v taplo >/dev/null
        set -l tomls
        for t in (git ls-files "*.toml")
            test -f $t; and set -a tomls $t
        end
        test -n "$tomls"; and env RUST_LOG=warn taplo format $tomls
    end
    if command -v bun >/dev/null
        set -l targets
        for j in (git ls-files "*.js")
            test -f $j; and set -a targets $j
        end
        for m in AGENTS.md README.md docs/editorial-workflow.md
            test -f $m; and set -a targets $m
        end
        test -n "$targets"; and bun fmt $targets
    end
    just --fmt
    echo "fmt: formatted fish scripts, toml, javascript, markdown documentation, and justfile"

# Static and structural lint: fish syntax, TOML, js, typos, justfile format, whitespace.
lint:
    #!/usr/bin/env fish
    set -l failed 0
    for rogue in package-lock.json pnpm-lock.yaml yarn.lock
        if test -f $rogue
            echo "FAIL: rogue lockfile detected: $rogue (use bun.lock exclusively)" >&2
            set failed 1
        end
    end
    for tool in taplo bun typos
        if not command -v $tool >/dev/null
            echo "FAIL: missing required tool '$tool'" >&2
            set failed 1
        end
    end
    for f in (git ls-files "*.fish")
        test -f $f; or continue
        if not fish -n $f
            echo "FAIL: $f (fish syntax)" >&2
            set failed 1
        end
    end
    if command -v taplo >/dev/null
        set -l tomls
        for t in (git ls-files "*.toml")
            test -f $t; and set -a tomls $t
        end
        test -n "$tomls"; and begin env RUST_LOG=warn taplo format --check $tomls; or set failed 1; end
    end
    if command -v bun >/dev/null
        set -l jss
        for j in (git ls-files "*.js")
            test -f $j; or continue
            if not bun build --no-bundle $j >/dev/null 2>&1
                echo "FAIL: $j (syntax check)" >&2
                set failed 1
            end
            set -a jss $j
        end
        test -n "$jss"; and begin bun fmt --check $jss >/dev/null 2>&1; or begin
            echo "FAIL: javascript files are not formatted; run 'just fmt'" >&2
            set failed 1
        end; end
    end
    if command -v typos >/dev/null
        typos; or set failed 1
    end
    if not just --fmt --check >/dev/null 2>&1
        echo "FAIL: justfile is not formatted; run 'just --fmt' or 'just fmt'" >&2
        set failed 1
    end
    git diff --check; or set failed 1
    if test $failed -ne 0
        echo "VERIFY FAILED: lint" >&2
        exit 1
    end
    echo "lint: fish syntax, toml, js, typos, justfile format, whitespace"

# Secret scan (gitleaks, fail-closed rg fallback).
secrets:
    #!/usr/bin/env fish
    if command -v gitleaks >/dev/null
        gitleaks dir . --no-banner --redact --log-level warn; or begin
            echo "secrets: gitleaks detected secret material in the working tree." >&2
            exit 1
        end
        echo "secrets: no secret material detected"
        exit 0
    end

    if git ls-files -z | xargs -0 -r rg -l -- '-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----'
        echo "secrets: private-key material found in tracked files." >&2
        exit 1
    end
    if set -l found (git ls-files -z | xargs -0 -r rg -l -i -e '(password|passwd|secret|api[-_]?key|access[-_]?key|client[-_]?secret|auth[-_]?token)[[:space:]]*[:=][[:space:]]*[^[:space:]]{8,}')
        echo "secrets: credential-shaped string found in tracked files: $found" >&2
        exit 1
    end
    if git ls-files | rg -i '(^|/)(id_(rsa|ed25519|ecdsa|dsa)|[^/]*\.(pem|key|ppk|p12|pfx))$'
        echo "secrets: private-key filename tracked." >&2
        exit 1
    end
    echo "secrets: no secret material detected"

# Run local preview server with live reload.
serve *args:
    zola serve {{ args }}

# Build Zola site to public/ directory.
build:
    zola build

# Full site gate: build, verify invariants, and validate internal links.
site: build
    ./verify.fish
    zola check --skip-external-links

# Decoupled visual verification harness (Playwright + Bun + system Chromium).
visual:
    ./verify-visual.fish

# Internal parallel aggregator. Invoke `check-fast`, not this.
[parallel]
_check-fast: check-agents lint secrets site

# Parallel fast gate, pinned to 3 workers for reproducible interleaving.
check-fast:
    #!/usr/bin/env fish
    exec just --justfile "{{ justfile() }}" --jobs 3 _check-fast

# Full gate: canonical verification contract (agents hygiene, lint, secrets, site).
check: check-agents lint secrets site
