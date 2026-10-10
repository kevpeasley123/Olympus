# Indexed curated memory

Implemented in the development backend on October 8, 2026. This is the first retrieval slice of the approved [durability review](reviews/2026-10-08-memory-retrieval.md). It does not collect Codex/Claude chats automatically. Contributors must write curated records using the [continuity protocol](MEMORY-CONTINUITY.md).

## Request behavior

Each native assistant request resolves project scope and prepares one evidence packet, reused by the OpenAI and Anthropic routes. Explicit project names take precedence over the active project; recent operator questions and the preceding request's single project scope support follow-ups. The present app has one persisted conversation; clearing it removes those saved scope/evidence receipts. A future multiple-conversation implementation must partition scope and receipts by conversation identity.

Ambiguous project aliases require clarification. Resumption without an established project returns `scope_required`. Portfolio questions receive bounded project summaries and explicit partial-coverage warnings. Current project sessions/decisions take priority over global research during resumption. General research may cross project boundaries; it does not establish another project's commitments.

Full-text search selects heading-aware passages. Project summaries do not replace unreconciled session evidence. Summary `source_revisions` are checked against the index; absent or stale coverage stays explicit. Structured `corrects`/`supersedes` relationships bring related records together, including substantive correction sections after introductory material. Incomplete, invalid, inaccessible or out-of-scope correction relationships omit the affected candidate. Oversized correction bundles are omitted together. Arbitrary contradictions in prose are not guaranteed to be discovered.

At dispatch, selected files are re-read and their exact SHA-256 revisions checked. Changed/unavailable bundles are omitted. This is a consistent committed index generation plus individual source checks, not an atomic filesystem snapshot. The evidence is quoted data in the current turn, never an authoritative system instruction or an execution approval.

## Storage and indexing

- `commands/memory/record.rs`: versioned metadata, legacy adapter, eligibility and UTF-8-safe chunks.
- `index.rs`: separate SQLite/FTS5 cache, contained source reads, transactional reconciliation, diagnostics and recovery.
- `retrieve.rs`: scope resolution, ranked retrieval, correction bundles and bounded evidence packets.
- `mod.rs`: background worker, native commands and immutable request receipts.

`memory-index.sqlite` is derived data under Tauri's application-local data directory, outside the vault and its OneDrive synchronization. The existing operational database retains `request_memory` receipts keyed to real backend model requests. Index rebuilds do not erase response evidence. Source deletion removes future retrieval after a successful scan; saved request excerpts remain until the conversation is cleared. Index archives retained during explicit corruption recovery are local diagnostic copies; source retention is independent.

The single index writer reconciles at startup, after debounced filesystem notifications, and every 60 seconds. A full source-hash sweep runs approximately every ten minutes while the process is running; these intervals are scheduling targets, not cross-machine consistency guarantees. Watcher failure is reported and periodic reconciliation continues. Metadata avoids needless parsing; hashes establish revisions. Queries use separate read-only connections and never enumerate the vault.

Eligible collections: `01 - Projects`, `02 - Research`, `04 - Decisions`, `08 - Daily Briefs/Sessions`, and `09 - System/History`. Research must carry the existing `olympus/research` tag. Hidden/backup paths, templates, test fixtures and `memory_exclude: true` notes are excluded. Profile Observations are outside this index. Existing fixed operator/system configuration still loads through the established stable-context path.

A missing root or incomplete enumeration must not become mass deletion. Explicit rebuild reparses reachable records and retains unreachable inventory until absence can be established; request-time revision checks still prevent serving missing bytes. Duplicate stable IDs and ambiguous aliases are diagnostics, never silent winners. Unknown schema versions and malformed/oversized documents remain intact but are not supplied. Legacy notes retain provisional identity and unknown metadata; aliases remain compatible with the older project readers.

## Contract and limits

New notes use `schema_version: 1`, unique `record_id`, exact `project_ids`, `origin`/author, and actual `recorded_at`. `observed_at`, `source_date` and `source_session` remain unknown when unavailable. Projects declare `project_id`, title, aliases and optional repository. Each milestone has its own record ID, even within one chat. Corrections are new records. Reconciliation receipts and summaries can declare `derived_from` plus `source_revisions` mapping record IDs to exact file hashes; existing session records remain immutable.

Use `python scripts/new-memory-record.py --help` to prepare a new session, decision or reconciliation note. The helper creates an output file exclusively and generates actual creation time and identity; it does not write the vault. Publish through the personal Olympus memory skill's compare-and-write helper. Decision defaults remain proposed.

The `curated-memory/v1` policy currently limits:

| Boundary | Limit |
| --- | --- |
| Source size / frontmatter | 2 MiB / 32 KiB |
| Traversal | Depth 8; 300,000 eligible paths per scan |
| Chunk | 2,400 UTF-8 bytes with heading and exact source offsets |
| Query / recent question text | 16 KiB each |
| Project scope / portfolio summaries | 8 projects / 4 summaries |
| Full-text candidates | 48 |
| Correction traversal | 3 levels, 4 records; whole bundle must fit |
| Request evidence | 8 passages, 24,000 serialized JSON bytes |
| Diagnostics in evidence | Bounded by serialized UTF-8 bytes |

The combined request also enforces a conservative 160,000-unit local ceiling: reserve the configured output-token allowance, then bound input text by UTF-8 bytes, removing oldest history first while preserving current evidence and question. This is deliberately **not** exact model token accounting. Large current evidence/attachments can still fail with an explicit budget error. Future models with smaller context windows require catalog-specific capacity before being enabled. Library size never increases the per-request memory allocation.

## Inspection and recovery

Native commands: `memory_status`, `memory_preview(query)`, `memory_rebuild`, `memory_request_evidence(requestId)`. Preview uses the same bounded reader and health state as real requests without calling a provider. Status includes generation, last reconciliation, document/chunk/byte counts and indexing issues. A queued rebuild is asynchronous; inspect status to confirm completion.

Per-response model **Details** includes the backend's saved packet, scope, limitations, exact excerpts, dates, revisions, offsets and source-note links. It stays closed by default. A receipt means evidence was prepared for a request, not proof that every source influenced the answer or that dispatch succeeded. Source notes opened later may have changed since the saved snapshot.

On open failure, explicit rebuild archives the derived index/WAL/SHM family before recreating it; recovery never rewrites vault sources. Ordinary failures return unavailable/partial state. There is no automatic full-vault prompt fallback. `OLYMPUS_MEMORY_MODE=legacy` is an explicit local rollback to the earlier bounded research/Decision Log path; receipts disclose that indexed recall is disabled.

## Verification and remaining acceptance

Native fixtures cover identity, dates, scope, pending sessions, corrections, concurrent branch reports, stale summaries, source mutation/deletion, same-timestamp edits, malformed saves, missing collections, rebuild/restart, corruption recovery, actual filesystem notifications, UTF-8 budgets and immutable receipts. Assistant tests cover evidence isolation and combined request limits. Record-preparer tests cover distinct milestone identities and proposal defaults.

Opt-in diagnostics (no providers):

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --lib commands::memory::tests
cargo test --manifest-path src-tauri/Cargo.toml --lib real_vault_index_recall -- --ignored --nocapture
cargo test --manifest-path src-tauri/Cargo.toml --lib scale_100_10000_100000_records -- --ignored --nocapture
python scripts/test-memory-record.py
node scripts/memory-evidence-review.mjs
```

The scale diagnostic generates 100/10,000/100,000 indexed records, records corpus bytes/chunks, and checks 30 warm queries against a provisional 250 ms p95 target. It is a synthetic database benchmark, not a 100,000-file OneDrive cold-ingestion test or answer-quality evaluation. The real-vault diagnostic creates a temporary derived index and does not write the source vault.

Browser review covers memory-details disclosure, keyboard closure, readable wrapping and composer visibility at 1280, 1440 and 1920 widths, alongside existing conversation/model-picker and full visual regression checks. Browser fixtures do not validate native WebView2, Tauri IPC, installed builds or live-provider reasoning. Those acceptance levels, representative held-out paraphrase evaluation, and additional contributor adapters remain explicit follow-up work; no provider calls or automatic chat collection are added by this change.
