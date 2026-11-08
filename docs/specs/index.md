# Specifications Index

Completed design records for Dev Journal. Each spec captures the contracts,
edge cases, and machine-checkable criteria for one feature at the time it was
implemented. These are historical records, not live process documentation, so a
status label inside a spec reflects when it was written.

- [`date-hierarchy-and-updates.md`](date-hierarchy-and-updates.md): optional
  top-level `updated` front-matter field, unified single-column feed cards, and
  natural (non-zero-padded) date rendering.

## Authority

`verify.fish` is the executable contract for the invariants these specs
describe, and `AGENTS.md` holds the binding architecture and safety rules. If a
spec contradicts either, the executable contract wins and the spec is stale.

Authoring and validation process lives in
[`docs/editorial-workflow.md`](../editorial-workflow.md).
