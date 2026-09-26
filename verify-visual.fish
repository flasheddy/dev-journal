#!/usr/bin/env fish
# Decoupled visual verification harness (Playwright + system Chromium, Bun-managed).
# Does NOT modify or invoke verify.fish; not wired into deploy.yml.
# Run from the repository root.

set -l root (status dirname)
cd $root

for c in bun chromium
    command -v $c >/dev/null 2>&1; or begin
        printf 'FAIL: missing required tool: %s\n' $c >&2
        exit 1
    end
end

if not test -f node_modules/.bin/playwright
    printf 'FAIL: Playwright not installed. Run: bun add -d @playwright/test\n' >&2
    exit 1
end

bun run test:visual
set -l rc $status

if test $rc -eq 0
    printf '\nScreenshots: .visual/screenshots/\nHTML report: .visual/report/index.html\n'
end

exit $rc
