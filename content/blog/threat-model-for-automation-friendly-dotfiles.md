+++
title = "A Threat Model for Automation-Friendly Dotfiles"
date = 2026-10-24
draft = false
description = "Four boundaries that keep routine automation — human or AI — from becoming system compromise: an isolated blast radius, controlled privilege escalation, a zero-secret baseline, and human-gated mutation."
[taxonomies]
tags = ["Security", "Threat Model", "Dotfiles", "AI Agents"]
+++

A dotfiles repository that installs packages, enables services, and deploys
root-level configuration has a real attack surface. Add AI agents that edit and
apply that repository, and the surface grows: now *automation itself* is a
potential vector.

The goal of this threat model is not to defend against a determined nation-state.
It is narrower and more practical: to make sure that routine automation — a
script, a hook, or an agent acting on an instruction — cannot silently become
system compromise. Four boundaries do most of the work.

## 1. Isolated blast radius

Developer toolchains live entirely in user space: Rust, Python, JS/TS, and Go
binaries all install under the home directory and never touch the package
manager or system paths.

This is a security boundary, not just a convenience:

- A broken or malicious user-level tool cannot corrupt the system package layer.
- A system upgrade cannot silently replace a pinned toolchain.

The outermost layer — the operating system and its package manager — is only
ever changed through one reviewable path. Everything else is contained.

## 2. Controlled privilege escalation

Root mutations are dangerous precisely because they are rare and easy to
improvise. The countermeasure is to make them *few and reviewable* rather than
*frequent and ad hoc*:

- All repository-managed root changes live in tracked, checksummed lifecycle
  templates — not in one-off commands run by hand.
- Those templates are idempotent (re-running changes nothing) and graceful
  (optional steps do not abort the whole run).
- Any change to a root-invoking template must carry an explicit **root-impact
  declaration** naming the affected services, files, and privileges.

That last rule is the one an agent most often needs: it converts "was there an
undeclared root side effect?" from an audit question into a mechanical
requirement. No undeclared root side effects.

## 3. A zero-secret baseline

Secrets are the boundary where a mistake is unrecoverable, so the design keeps
them out of tracked state entirely:

- No private keys, tokens, or credentials are ever tracked — only client
  *configuration*, with key material excluded by an ignore rule inside the
  protected directory.
- Hooks never print secrets or dump the full environment.
- Untrusted external code is never executed or folded into tracked state.

Because the baseline is *zero*, the audit is simple: if a credential ever
appears in a diff, something is wrong by definition. There is no "acceptable
amount" of tracked secret to reason about.

## 4. Human-gated mutation — even for agents

The final boundary guards the newest actor: the AI agent. Agents operate under
an explicit contract that layers three protections:

- **Read freely, write deliberately.** Every change to tracked state passes a
  review protocol: ground-truth probes, a constraint audit, a refined prompt,
  and explicit approval before anything is written.
- **Forbidden actions stop the task.** When a request hits a prohibited
  operation, the correct response is to stop and flag it — never to refine
  around it.
- **A pre-approved local posture.** Local execution tools are pre-approved so
  routine work does not stall on approval prompts, while the capabilities that
  change an agent's own reach — extension management, privileged session
  surfaces — stay gated or blocked.

Behind all of this sits a deterministic, fail-closed verification gate and a
pre-push hook: whatever reaches tracked state has already been checked, and
whatever is about to leave the machine has passed the repository's full
verification.

## Reading the model

The four boundaries share a shape. Each answers one question mechanically:

| Question | Boundary |
|---|---|
| If a component is compromised, what else does it reach? | isolated blast radius |
| Where can root changes come from, and are they declared? | controlled privilege escalation |
| Could a mistake leak something unrecoverable? | zero-secret baseline |
| Who authorises a mutation, and what stops it? | human-gated mutation |

None of these is novel in isolation. The value is in stating them together and
enforcing each with a mechanism — isolation, declarations, a zero baseline, and
approval gates — rather than with good intentions.

Routine automation is safe only when the boundaries are structural. That is the
whole point of treating a dotfiles repository as a system to be designed rather
than a folder of files.
