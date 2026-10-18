+++
title = "Agentic System Management: Running AI Agents Inside a Dotfiles Repository"
date = 2026-10-18
draft = false
description = "What it takes to let AI agents maintain a real workstation: how context is loaded, which configuration surfaces are agent-visible, the prompt patterns that keep work safe, and why every mutation stays human-gated."
[taxonomies]
tags = ["AI Agents", "Goose", "Dotfiles", "Prompt Engineering"]
+++

The workstation behind this journal is maintained in part by AI agents working
directly in the chezmoi source tree: drift audits, configuration edits, package
and manifest maintenance, hook updates. That is only sustainable if the agent's
environment is designed, not improvised.

This is a description of the design — how context reaches an agent, which
surfaces it can see, and the instruction patterns that keep its work bounded.

## Context is the real architecture

An agent is only as good as the context it loads automatically. The design
treats three layers of context as first-class, each with a different reach:

- **Repository-local rules** — a repository-root file (`AGENTS.md`) that every
  session auto-loads from the working directory upward. This is the binding
  contract for anything touching the repository.
- **Global floor** — a workstation-wide safety document that is inlined into
  every session by the agent runtime's hints mechanism, so no repository can
  forget it.
- **A home-path symlink** — a symlink at the home directory pointing at the
  same global floor, for tools that read the home path directly rather than
  walking the working directory.

The point of all three is redundancy of the *invariant*: whatever an agent
touches, and whichever reader it uses, the safety floor is in scope.

## Configuration surfaces an agent can see

The agent's own configuration is itself managed declaratively, and it is worth
being explicit about which surface controls what — and what reaches the agent
versus what merely sits on disk.

| Artefact | Controls | How it reaches the agent |
|---|---|---|
| Runtime config | active model/provider, extension set, thinking effort, context limit | loaded by the agent runtime at startup |
| Permission posture | which tools are pre-approved, gated, or blocked | loaded by the runtime; also rewritten by it at runtime |
| Global hints | the workstation-wide safety floor, inlined | injected into the system prompt |
| System-prompt template | base identity and hard shell/safety constraints | rendered as the session's system prompt |
| Sub-agent definitions | role-specialised delegates (drafting, review, audit) | invoked on demand by name |
| Shell environment | the authoritative shell dialect for tool snippets | set at shell startup |

Two lessons generalise from this table. First, **the runtime rewrites some of
its own config** — a permission file may be partially machine-managed — so the
declarative source must tolerate a live file that differs from it and a
verification gate that knows to ignore the runtime-managed parts. Second,
configuration is *capability*. Changing which tools are pre-approved changes
what an agent can do without asking, which is why that surface is deliberately
gated rather than freely editable.

## Instruction patterns that keep work bounded

The value of a good operator prompt is that it encodes the *stopping
condition*. A few patterns carry most of the weight:

- **Audit (read-only).** "Report any drift between the source tree and the live
  system. Change nothing." The explicit "change nothing" is the whole point: it
  turns a potentially mutating task into a strictly observational one.
- **Refinement (report-first).** "Run a complete refinement audit, reconcile
  every package layer and toolchain against the manifests, scan for drift and
  portability issues, and report findings *before* modifying any files." This is
  the periodic-maintenance pattern: survey first, act only on approval.
- **Install (documented).** "Install the tool with the appropriate manager,
  append it to the matching manifest, and verify." A rule of thumb accompanies
  it: read freely, document every install in a manifest, and ask before anything
  destructive.

The common thread is that each prompt names its own boundary — read-only,
report-first, or documented-and-verified — so the agent never has to guess how
much autonomy it has been granted.

## Inheriting the workflow safely

A tempting mistake when adopting someone else's dotfiles is to clone and apply
immediately. But the manifests describe *their* machine, not yours — applying
them installs a stranger's package set onto your system.

The safe adoption path is a reconciliation, not an application:

1. Fork and initialise **without applying**. The source tree is present; the
   live system is untouched.
2. Run a single reconciliation prompt: compare *your* installed packages,
   Flatpaks, and toolchains against the manifests, and report what to add or
   remove so the manifests describe *this* machine.
3. Review the report, approve the manifest edits, and only then apply — at
   which point the lifecycle hooks install everything declaratively.

The agent does the tedious comparison; the human keeps the authority to decide.

## The invariant: human-gated mutation

Everything above is machinery around a single rule: an agent may read freely,
but every change to tracked state passes an explicit review-and-approval
protocol, and destructive operations always stop for confirmation. Pre-approving
*local* execution keeps routine work from stalling, while the surfaces that
change an agent's own capabilities stay gated.

Automation is worth having only when the human retains the boundary. Designing
the context, the surfaces, and the prompts so that boundary is unmissable is
what makes agentic maintenance of a real workstation safe.
