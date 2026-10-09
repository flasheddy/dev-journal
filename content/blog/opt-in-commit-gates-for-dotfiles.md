+++
title = "Commit Gates That Opt In: Enforcing Discipline in a Dotfiles Repository"
date = 2026-10-10
draft = false
description = "A machine-wide pre-commit hook that only activates in repositories which declare themselves in-scope, and a pre-push gate that dispatches to each repository's own full verification entry point."
[taxonomies]
tags = ["Git Hooks", "Continuous Integration", "Dotfiles", "Security"]
+++

A dotfiles repository that installs packages, deploys root-level config, and
bootstraps toolchains is not a collection of text files. It is a small
deployment system, and it deserves the same guardrails as any other: nothing
leaves the machine without passing a gate.

The design problem is that the useful gates are *repository-aware*. A check for
"documentation references resolve" or "the inherited safety floor is current"
makes no sense in an unrelated clone. So the gates must be global in
implementation but opt-in in effect.

## Opt-in by declaration, not by configuration

The commit gate is a single global hook, wired machine-wide through the Git
configuration (`core.hooksPath`), so no per-clone setup is ever required. It
decides whether it is relevant by looking for a declaration:

- If the repository carries an `AGENTS.md` — the marker that it is
  agent-operated and in scope — the gates run.
- Otherwise the hook exits successfully without touching anything.

That one-line guard is what lets a personal gate be installed globally without
ever leaking into third-party clones or scratch trees.

## Gate 1 — documentation drift

The most common decay in a heavily documented repository is a dangling
reference: a document cites `docs/foo.md`, the file is renamed, and nobody
notices until the wrong file is opened months later.

The gate walks the repository's `AGENTS.md`, extracts every backticked token,
and validates two kinds of citation:

1. Every cited `*.md` path must exist.
2. Every cited heading must exist verbatim in the document it follows.

Globs and `<placeholders>` are patterns, not paths, so they are skipped. A
heading counts as a citation only when it directly follows a cited path, which
keeps prose mentions of a heading from being mistaken for pointers.

Two properties make this gate trustworthy rather than annoying. It is
**deterministic and offline** — pure string and filesystem checks, no network.
And it is **detection-only**: it reports and blocks, but it never rewrites a
document. Repair stays an operator-gated edit, so the tool can never silently
"fix" a reference into something wrong.

## Gate 2 — inherited safety-floor freshness

Rules that apply across many repositories are best kept in one place and
inherited, not copied. The risk of inheritance is staleness: a repository
asserts "I follow the current floor" while the floor has moved on.

The gate models this with a marker line in `AGENTS.md`:

```
<!-- floor-contract: sha256:... -->
```

The hash records which revision of the shared floor the repository was last
reviewed against. The semantics are deliberately calibrated:

- **Marker matches, or is absent** — pass silently. Absence is an opt-out, so
  repositories that do not inherit the floor are unaffected.
- **Marker stale, and `AGENTS.md` is part of the commit** — block. This is
  precisely the commit that must re-affirm the inheritance.
- **Marker stale, but `AGENTS.md` is not staged** — warn only.

The middle case is the important one. Editing the file that declares
inheritance is the moment to re-read the floor, and the gate refuses to let that
moment pass unexamined.

## Gates 3 and 4 — the boring ones

The remaining two gates are deliberately unglamorous:

- **Whitespace and conflict markers** — the staged-diff equivalent of
  `git diff --check`.
- **Secret scan** — a dedicated secret scanner over the staged diff, with a
  fail-closed fallback when the scanner is unavailable.

That second point matters. A missing scanner must never be a *silent downgrade*
to no scanning. When the primary tool is absent, a lightweight pattern scan
still runs, and a hit still blocks the commit. Fail closed, always.

## The pre-push gate dispatches, it does not decide

A pre-commit hook is the wrong place for a full test suite — it would make every
commit slow. Instead, the repository's *complete* verification runs on push, and
the hook's job is only to find and invoke it.

The contract is a single convention: a `just check` recipe is a repository's
**full** gate. The dispatcher:

- runs `just check` if the repository defines it;
- fails closed if the entry point exists but cannot run;
- leaves repositories without a `check` recipe untouched.

Crucially, partial checks must use other recipe names. If a repository has both
a fast lint and a full gate, only the full one may be called `check` — otherwise
the dispatcher could be pointed at something that looks like the whole gate but
isn't. Naming is part of the safety model.

And the dispatcher never composes commands of its own. It does not know how to
run tests; it only knows how to call the repository's declared entry point.
That keeps the global mechanism dumb, stable, and free of per-project
knowledge.

## Why this shape

Three principles recur:

- **Global but inert until declared.** Install once, activate by declaration.
- **Detection, never mutation.** Gates report and block; humans repair.
- **Fail closed.** A missing tool degrades the *quality* of a check, never its
  existence.

A dotfiles repository is a deployment system. Treating it like one — with
opt-in, deterministic, fail-closed gates and an explicit full-verification
entry point — is what keeps it safe to automate.
