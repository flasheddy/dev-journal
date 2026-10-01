# Verification entry point. Canonical: AGENTS.md -> Verification Contract.
# `check` is the FULL gate. Partial checks use other recipe names.

set shell := ["fish", "-c"]

# Full gate: site builds, contract invariants, link resolution.
check:
	zola build
	./verify.fish
	zola check --skip-external-links
