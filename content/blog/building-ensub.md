+++
title = "Building Ensub: Local-First Vocabulary Practice"
date = 2026-08-17
description = "How Ensub turns words encountered while reading into durable, private vocabulary practice."
[taxonomies]
tags = ["Rust", "SQLite", "SM-2"]
+++

Ensub started with a narrow question: how can a word encountered during real reading become something you actually remember, without sending your reading history to another service?

The answer is a local-first application suite. Ensub captures a word together with its source sentence, enriches it from an offline lexicon, and schedules review with a deterministic SM-2 implementation. Native data stays in SQLite, so the useful path remains available without an account or network connection.

> Vocabulary practice works best when the word stays connected to the sentence that made it worth noticing.

## One domain, several surfaces

The project is a Rust workspace, but the important boundary is not the number of crates. The domain and language engines are portable policy. Interfaces and storage adapters depend on those engines, never the reverse.

| Layer | Responsibility |
| --- | --- |
| `core_engine` | Vocabulary records, review scheduling, and storage contracts |
| `language_engine` | Tokenization, morphology, documents, and lexicon contracts |
| `ensub-sqlite` | Native persistence and the bundled offline lexicon |
| CLI, TUI, GUI, and applet | Different ways to capture, read, and review |

That separation lets the command line, terminal reader, COSMIC desktop application, and panel applet share the same scheduling behavior. Portable WASM bindings can use a browser storage adapter without pulling native SQLite into the browser graph.

## A small capture loop

After installing the CLI, a word and its source context can be captured directly:

```fish
cargo install --path crates/cli --locked

esb add immersion \
  --context "Immersion turns ordinary reading into deliberate practice." \
  --source "reading-notes"

esb due
esb review
```

The first captured card is immediately due. Later intervals are calculated from explicit timestamps and review grades, keeping the scheduling logic reproducible and straightforward to test.

## Local-first as an engineering constraint

“Local-first” is more useful as an architectural constraint than as a label. It means native capture and review must not depend on a remote API, data must live in familiar platform locations, and core behavior must remain independent of a particular interface.

For Ensub, that led to a few durable decisions:

- embed the native lexicon instead of requiring a separate dictionary download;
- keep SQLite behind a storage contract outside the domain engine;
- accept timestamps in scheduling functions rather than reading the system clock;
- make source context part of the vocabulary record, not an optional afterthought.

There is more to build, especially around the reading workflow, but the foundation is intentionally quiet: capture a useful word, retain why it mattered, and bring it back at the right time.

The source is available on [GitHub](https://github.com/flasheddy/ensub).
