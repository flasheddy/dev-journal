+++
title = "Dual-Harness Engineering: Spec Planning with agy and TDD with OpenCode"
date = 2026-11-07
draft = false
description = "How pair programming across macro-architecture in Antigravity CLI and micro-TDD in OpenCode establishes clean phase boundaries and eliminates cognitive fatigue."
[taxonomies]
tags = ["Antigravity", "OpenCode", "Architecture", "Workflow"]
+++

Pair programming with agentic AI frequently breaks down at the boundary between broad architectural planning and concrete code mutation. Asking a single long-lived conversational session to synthesize an entire repository, draft a multi-phase specification, write unit tests, and implement surgical diffs invariably introduces context drift, hallucinations, and cognitive fatigue for the human operator.

To eliminate this degradation, the engineering workflow behind this workstation decouples the macro-architectural phase from the micro-implementation loop into two specialized harnesses: Antigravity CLI (`agy`) for deep context synthesis and spec generation, and OpenCode for compiler-aware, test-driven execution.

## The macro vs. micro split

The fundamental tension in agentic coding is context breadth versus execution precision. Macro-architectural tasks require broad peripheral vision: digesting entire directory trees, reconciling cross-repository contracts, and evaluating systemic trade-offs. Micro-implementation tasks require narrow focus: fast turnaround, deep language server protocol (LSP) integration, compiler diagnostics, and targeted test cycles.

Attempting to run both within a single harness forces an awkward compromise:

- **Macro-architecture in Antigravity CLI (`agy`):** With its 1M+ token context window and structured planning primitives, `agy` excels at full-codebase ingest, architectural roadmapping, and generating machine-readable plan artifacts. It surveys the system state, validates cross-cutting constraints, and drafts comprehensive execution plans without modifying application code.
- **Micro-TDD in OpenCode:** Once a plan slice is locked, execution transitions to OpenCode. Operating in terminal sessions with low latency, OpenCode focuses strictly on the immediate red-green-refactor loop. It pairs directly with the local compiler and test runner (`just`, `cargo`, `bun`), applying surgical diffs and iterating autonomously on diagnostic output.

Separating these concerns prevents the implementation agent from getting bogged down by hundreds of thousands of conversational tokens, while keeping the planning agent detached from low-level compiler iteration.

## The 3-phase lifecycle

Every non-trivial engineering task flows through a strict three-phase lifecycle that enforces clear boundaries between discovery, mutation, and verification:

1. **Architecture and specification (macro):** The operator engages `agy` in exploration mode. The agent reads repository contracts (`AGENTS.md`), architecture notes, and existing tests to produce a bounded specification or step-by-step checklist (such as an implementation plan artifact). No source files are mutated during this phase.
2. **Implementation and TDD (micro):** The operator hands the bounded specification to OpenCode. Working in the active checkout, OpenCode introduces interface contracts and failing test cases first, followed by the minimal surgical diff required to satisfy them. Each step is anchored by fast, targeted feedback loops (e.g. running a single test function or linter).
3. **Workstation verification (gate closure):** Before any change is presented for operator review, the full canonical gate (`just check`) is executed locally. This executes static analysis, secret scans, link checkers, and visual rendering assertions in parallel.

Because each phase has an explicit entry and exit criterion, work never drifts into unstructured edits.

## Adversarial auditing

One of the most insidious failure modes in conversational pair programming is sunk-cost bias. When an agent has generated several iterations of a flawed design, subsequent prompts within the same session often reinforce the error rather than correcting it.

The dual-harness workflow counters this through adversarial auditing: severing the conversational context.

Before an implementation plan is executed, the operator can invoke a fresh, read-only subagent or a secondary `agy` instance with no prior conversational history. The auditor's prompt is explicitly adversarial:

```text
Evaluate this proposed implementation plan against the repository AGENTS.md
contracts and live source tree. Identify missing failure modes, hidden breaking
changes, unverified assumptions, and unnecessary state mutations.
Do not modify any files.
```

By presenting the specification to an agent unencumbered by earlier chat turns, blind spots and unverified assumptions are exposed immediately. If the audit uncovers architectural flaws, the plan is refined in the macro harness before a single line of application code is touched.

## Results and invariants

Adopting a dual-harness workflow enforces several structural invariants that keep the repository reliable:

- **Clean active checkouts:** Development occurs directly in the active working tree without ephemeral branch sprawl or detached worktrees. Changes remain unstaged until the human operator conducts the final review.
- **Zero-drift verification gates:** All verification commands are codified in the repository `justfile` and fail closed. The agent cannot invent build flags or skip failing checks.
- **Human execution authority:** State mutations, Git staging, and commits remain strictly under operator control. The harness generates candidate changes and single-line conventional commit messages, leaving the ultimate execution authority with the human.

By drawing a clean line between macro planning and micro execution, the dual-harness architecture turns agentic coding from an unpredictable chat session into a deterministic, disciplined engineering process.
