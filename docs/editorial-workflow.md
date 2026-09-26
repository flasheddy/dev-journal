# Editorial Workflow

This document defines how an engineering note becomes an article in Dev
Journal. It keeps the writing process evidence-bounded and makes the checks
required before a change reaches the Zola site explicit.

## Article status

Every working draft carries one of these status labels in its working notes:

- `draft`: editorial work is in progress, or a required evidence/approval
  gate is missing.
- `locally validated`: the article and site checks pass in the local checkout;
  this does not imply remote verification or publication.
- `published`: the owner has approved publication and the approved change has
  been published through the repository's configured deployment workflow.

Do not infer a status from prose quality, a passing unit test, or a local build.
Record the evidence and the approval that justify a transition.

## Inputs and evidence

Start with an approved stage note, a reviewed source diff, and the relevant
test or benchmark output. The stage note should include the decision, failed
attempts, limitations, explicit uncertainty, and the next experiment. Keep
these source-of-truth labels visible when they matter:

- `challenge`: an external challenge or acceptance contract;
- `project`: a decision observed in the repository;
- `exploratory`: an option being investigated, not an adopted design;
- `hypothesis`: an unverified explanation or expectation.

Attribute each factual claim to an observed command, reviewed source,
challenge contract, or clearly marked hypothesis. Never invent metrics,
completion status, causality, benchmarks, or remote verification. Use
synthetic examples and redact credentials, personal data, and private logs.

## Drafting sequence

1. **Frame the problem.** State the user or engineering problem and the
   observable contract. Name the constraints that shaped the solution.
2. **Set the conceptual boundary.** Explain which layer owns the behavior and
   which interfaces or storage adapters depend on it. Keep explanations tied
   to the actual Python or systems model used by the project.
3. **Compare decisions.** Describe rejected alternatives and why they did not
   satisfy the stated constraints. Mark unsettled choices as exploratory or
   hypotheses.
4. **Describe the selected design.** Use small, representative snippets or
   commands. Link only to stable public references; avoid embedding private
   paths, logs, or data.
5. **Attach evidence.** Include the exact local command, the relevant result,
   and environment assumptions. Distinguish `locally passing`, `remotely
   verified`, and `independently explained` evidence.
6. **State limitations and next work.** Leave unresolved questions open and
   identify the next experiment rather than implying completion.

## Python wording

When an article discusses `pygrep`, describe the behavior using Python's own
runtime and standard-library concepts (for example, Unicode strings,
iterators, generators, exceptions, and process exit codes). Do not import Rust
ownership, borrowing, lifetime, enum, or pattern-matching assumptions into a
Python explanation; label any cross-language analogy as an analogy and verify
the Python behavior separately.

## Zola article format

Create an article under `content/blog/` with the established TOML front
matter. Dates use ISO year-month-day values; tags use the configured `tags`
taxonomy. The `description` is the short summary used by article lists and
metadata.

```toml
+++
title = "Post title"
date = 2026-09-26
description = "A short summary used by article lists and metadata."
[taxonomies]
tags = ["Playwright", "Bun", "CSS", "Zola"]
+++
```

The blog section orders articles by `date`, and the page template supplies the
article date, reading time, and tag links. Use Zola URL helpers for internal
links; do not introduce root-relative asset or navigation URLs. Keep Markdown
headings and code fences consistent with existing articles. The repository targets
the host system Zola and requires 0.23 or later for component syntax; a local
executable that lacks component support must be reported rather than silently
treated as equivalent.

## Review and approval gates

Before calling an article `locally validated`, a reviewer checks:

- every factual claim has attributable evidence or an explicit uncertainty
  label;
- the front matter has a title, ISO date, description, and valid tags;
- the article does not expose secrets, personal information, private logs, or
  unapproved remote results;
- the diff changes only the intended article or documentation and preserves
  existing templates, configuration, workflow, and tests;
- the local build, site contract, and visual rendering checks all pass.

Drafting and local validation are read-only editorial activities. Before
writing a final article, committing, pushing, submitting, or publishing,
obtain explicit approval from the project owner. If approval or evidence is
missing, stop at `draft` and list the missing gate; do not imply that the
article is published or that a milestone is complete.

## Required validation

Run these commands from the repository root for any article or site-document
change:

```fish
zola build
./verify.fish
./verify-visual.fish
git diff --check
# Replace <path-to-new-file> with each newly created, still-untracked file.
set new_file "<path-to-new-file>"
set check_output (git diff --no-index --check /dev/null $new_file 2>&1)
set check_status $status
test $check_status -eq 1; and test (count $check_output) -eq 0
git status --short --branch
```

`zola build` must complete successfully and produce the local `public/`
export. `verify.fish` verifies required files, front matter and template
contracts, asset URL portability, internal link integrity, and the decoupled
(unpinned) Zola deployment references. `./verify-visual.fish` runs the decoupled
Playwright harness (Bun + system Chromium at `/usr/bin/chromium`; install once
with `bun install`) and writes full-page screenshots to `.visual/screenshots/`;
inspect them to confirm new content renders without overflow or console errors.
Review the resulting diff and status output to confirm
that no unrelated file changed. A local pass is evidence for
`locally validated` only; remote challenge or deployment checks require an
authorized remote operation and should be recorded separately. The regular
`git diff --check` covers tracked changes. For the untracked article or
site-document path, replace `<path-to-new-file>` with the actual path and run
the no-index check once per new file. `git diff --no-index --check /dev/null
<path>` returns status `1` because the files differ; the `check_output`
assertion above treats that expected status as success only when Git emits no
whitespace diagnostics.

## Editorial record

Keep a short review record alongside the change containing the article status,
evidence commands and outputs, reviewer name or role, approval timestamp, and
any remaining uncertainty. The record should make it possible to explain why
the article is accurate without relying on unpublished context.
