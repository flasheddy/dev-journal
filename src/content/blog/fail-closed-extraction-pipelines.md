+++
title = "Fail-Closed Extraction Pipelines: Offline Fixtures, Strict Schemas, and Standalone Packaging"
date = 2026-11-26
description = "How I structure Python web-extraction pipelines so silent DOM drift fails loudly, offline fixture tests run without network access, and standalone packages ship with zero internal dependencies."
[taxonomies]
tags = ["Python", "Data Extraction", "Pydantic", "Testing"]
+++

The most expensive failure mode in a web-extraction pipeline is not a crash. It is a quiet exit `0` after a target site renames a container class, shifts a pagination parameter, or returns an interstitial HTML page with an HTTP `200` status. Downstream tables fill with nulls or empty batches, and nobody notices until a report looks wrong days later.

Two public Python repositories I maintain — [price-drop-monitor](https://github.com/flasheddy/price-drop-monitor) and [event-aggregation-pipeline](https://github.com/flasheddy/event-aggregation-pipeline) — share a small set of design boundaries built to turn silent breakage into loud, deterministic failures.

## Separate transport from pure parsing

A scraper that mixes HTTP calls, HTML parsing, and file writes in one loop is hard to test without hitting live servers. Splitting the pipeline along pure boundaries makes every stage independently verifiable:

- **Ingress:** Fetches raw HTML or JSON payloads behind an injectable fetcher protocol (`httpx` or `curl_cffi` in production, a local file reader in tests).
- **Parsing:** Pure functions using `selectolax` (Lexbor HTML5) or standard-library `json` that take raw text plus a base URL and return typed records with zero network I/O.
- **Validation:** Strict Pydantic v2 models (`extra="forbid"`, `frozen=True`, `str_strip_whitespace=True`) paired with Draft 2020-12 JSON Schema checks on serialized outputs.
- **Storage:** Streaming JSONL or append-only CSV/Parquet exports that only run after validation succeeds.

```python
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class ExtractedItem(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        frozen=True,
        str_strip_whitespace=True,
    )

    source_id: str = Field(min_length=8, max_length=64)
    title: str = Field(min_length=1)
    url: HttpUrl
    price: Decimal | None = Field(default=None, ge=Decimal("0"))
```

When an unexpected field appears or a required selector stops matching, validation aborts before corrupting any output artifact.

## Offline fixture tests before live runs

Parser and end-to-end pipeline tests execute against static, sanitized HTML and JSON captures stored under `tests/fixtures/`. Neither `pytest` nor CI touches external websites.

This pattern keeps test runs sub-second and repeatable:

- A broken CSS selector or malformed date format is reproduced by saving the new response snapshot as a fixture and writing a failing test first.
- Multi-source collectors (as in `event-aggregation-pipeline`) can test fault isolation deterministically: one failing adapter logs its error while healthy sources still produce validated output and preserve last-known-good snapshots.
- Scheduled trackers (as in `price-drop-monitor`) can verify historical state diffs, threshold alerts, and schema validation completely offline via `--offline`.

## Explicit exit-code contracts

When pipelines run unattended from cron or GitHub Actions, exit codes carry operational meaning. Treating every non-success as a generic `1` hides whether the operator needs to fix CLI arguments, update a broken selector, or investigate an empty upstream feed.

A compact, consistent exit contract avoids ambiguity:

- `0`: extraction succeeded and validated deliverables were written.
- `1`: schema validation failed; aborted before writing deliverables.
- `3`: zero records extracted (`EMPTY_BATCH`); halted before overwriting outputs.
- `64`: invalid CLI arguments, malformed URL, or missing fixture path (`EX_USAGE`).

Combining exit `3` with a zero-record alert catches the most common real-world failure — an HTTP `200` page whose markup changed — on the very first run.

## Standalone packaging without leakage

When a pipeline is delivered as standalone source code rather than a hosted dataset, reproducibility on a clean machine matters as much as parser accuracy. Each standalone package pins only public PyPI dependencies in `pyproject.toml` and `uv.lock`, and runs a local verification gate (`ruff`, strict `basedpyright`, `gitleaks`, and offline `pytest`).

To prevent internal tooling or local path dependencies from leaking into delivered repositories, the dependency audit itself lives outside the client package. An external AST and TOML auditor checks every standalone repository for forbidden imports, non-registry `uv.lock` entries, editable local paths in `requirements*.txt`, and stray internal references before handoff.

## Limitations and next work

Offline fixture suites prove that parsers and validators behave deterministically against captured responses, not that a live website has stayed unchanged since the last capture. Detecting live DOM drift still requires scheduled runs, raw response archiving for quick diffing, and alerting on zero-record or sharp-drop anomalies.

The next operational step is expanding fixture-backed regression sets as new target layouts appear, keeping every parser change anchored to a saved snapshot and a passing offline gate before touching production schedules.
