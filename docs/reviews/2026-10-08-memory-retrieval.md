# Durable memory retrieval review

Date: October 8, 2026. Status: proposed architecture, not implemented or accepted.

Kevin requested a careful reassessment of the earlier selective-retrieval plan so that memory remains useful as the library grows and changes. That request authorizes this review; it does not establish approval of every recommendation below.

The earlier plan correctly favored relevant project context, decisions and session evidence over loading the whole vault. It was incomplete about identity, indexing, corrections, compatibility, coverage and recovery. Build those foundations before enabling general automatic session recall. Retain a small first release, but make it a vertical slice of the durable design.

## Findings grounded in the current implementation

Repository: `C:/Users/kevpe/OneDrive/Desktop/Projects/Olympus`, inspected at `1fb53cb`, branch `codex/command-refinement-dev`. Other-session edits in AgentsConstellation.tsx and VaultConstellation.tsx were present and left untouched.

| Finding | Evidence | Implication |
| --- | --- | --- |
| A question invokes the research scan twice: once for the library inventory and once for selection. The scanner caches parsed files by modification time, but still walks the folder and clones cached bodies. Ranking then considers every body. | `src-tauri/src/commands/vault_context.rs`, `pantheon.rs`, `research_retrieval.rs` | Output is bounded; discovery and ranking work still grow with the corpus. This is not evidence of a measured performance problem today. |
| Decision context is the newest 16,000 characters; the research inventory is capped at 12,000 characters, newest first. | `vault_context.rs` | Age and position can exclude relevant evidence. An old decision can remain current indefinitely. |
| Retrieval uses the latest question, with no explicit active-project ID in the retrieval function or assistant context contract. | `assistant.rs`, `src/services/assistant.ts` | “Where did we leave off?” requires explicit conversation scope, not keyword matching or guessing from a list of projects. |
| Project matching uses filename, title and aliases. The new `project_id` and `repository` frontmatter fields are not consumed by that reader. | `project_notes.rs` | Writing a schema is not implementing it. Migration must preserve existing reader behavior. |
| Research IDs are paths; excerpts fingerprint bodies. `source_date` falls back to the note creation date. | `pantheon.rs`, `research_retrieval.rs` | Renames and metadata changes need identity/revision handling. Import date must not masquerade as a source event date. |
| Missing research folders can return an empty inventory; some per-file read errors are logged and omitted. | `pantheon.rs` | A future index needs distinct empty, partial, stale and unavailable states. |
| Session templates lack a unique milestone-record ID and schema version; historical records have mixed date precision. | Vault templates and October 8 session record | A session can produce several milestones. Backward-compatible adapters must retain unknowns and date precision. |

The earlier cleanup dropped the `Olympus` alias from Project Olympus.md. The existing read-only `debug_join_the_real_project_note` test reproduced the failure. Restoring the alias made it pass: one test, eight project notes, zero folder warnings. The project template now warns that aliases remain required by the current backend. This is a narrow compatibility repair, not implementation of the architecture below.

## Storage and authority

Keep the vault as the human-readable source for curated project memory. Keep operational history and approval receipts in the existing application database. Add a disposable, local SQLite search index derived from eligible vault documents. Store that index in the application's local data area, outside the OneDrive vault; rebuild it on each machine rather than synchronizing a live database.

Prefer a separate `memory-index.sqlite` so corpus indexing does not occupy the existing operational connection's mutex. This adds an internal file and Rust module, not an external service. Existing Gmail search already uses FTS5. Use ordinary document/chunk metadata tables and a consistent FTS5 index, updated in the same transaction. Search-index deletion must never delete source notes or operational records. Persist answer evidence in the operational database, so an index rebuild does not erase provenance.

Start with full-text retrieval, metadata filters, aliases and explicit relationships. Add embeddings only if a representative evaluation shows persistent paraphrase misses. Any later embedding cache must be keyed by source revision plus embedding model/version; upgrades rebuild that cache without changing the memory contract. It cannot establish truth or operator intent.

SQLite provides full-text search and ranking. Its external-content indexes require explicit consistency management; its WAL mode is not a cross-machine database protocol. References: [FTS5](https://www.sqlite.org/fts5.html), [external-content consistency](https://www.sqlite.org/fts5.html#external_content_table_pitfalls), [WAL constraints](https://www.sqlite.org/wal.html). Keeping a derived index outside the synced vault is this review's design recommendation.

## A small, versioned record contract

New contributed records should carry a stable record ID, schema version, record type, project IDs, origin/author, source-session ID when known, and timestamps with explicit precision. Separate when something happened, when it was recorded, when the file changed and when it was reviewed. Preserve unknown values instead of manufacturing timestamps.

Use a project registry with a stable key, display name, aliases and repository/worktree bindings. Titles and paths can change; identity should survive. Support projects without repositories and records involving more than one project. Reject ambiguous bindings instead of joining similar names. Adapt the current title/alias reader during migration; do not require a flag-day rewrite of every old note.

Session milestones are immutable evidence records; corrections are new records. Each milestone has its own record ID even when several share one chat ID. Decisions have proposed/current/superseded/disputed states and explicit links such as `corrects`, `supersedes` and `derived_from`. Reconciliation state should be a separate receipt linking source revisions to a summary revision, rather than requiring edits to an immutable session record.

These are descriptive fields, not approval tokens. A Markdown declaration of operator approval is still a claim with provenance. Runtime execution authority continues to require the backend's real approval records. Research, proposed advice, reported decisions, verified repository facts and approved per-request skill guidance remain distinguishable.

For old notes, use a legacy adapter and report missing fields. Do not assign authoritative IDs by hashing a filename. Where identity cannot be established, retain a provisional source identity and make rename continuity uncertain. Durable source IDs can be added through a separately reviewed metadata migration. Unknown schema versions remain intact and are reported as unsupported; they are not silently reinterpreted.

## Index maintenance and recovery

Index only configured, eligible document classes. Exclude templates, hidden backups, test fixtures and Profile Observations from normal recall. Historical notes can answer historical questions but should not become current state. Research can remain globally relevant without contaminating project-specific decisions. Skill discovery may share search infrastructure while retaining its distinct invocation and approval policy.

Run indexing outside the request path. Use filesystem notifications as hints, debounced retries for in-progress writes, startup reconciliation and periodic reconciliation while the app is running. Hash changed source bytes; use metadata only as an optimization. Incremental integrity sweeps must eventually detect changes with unchanged timestamps. A watcher alone is not a completeness guarantee.

Read and parse bounded documents safely. Chunk by headings and paragraphs, retaining heading context, offsets and parent revision. Make file-size, nesting and indexing limits explicit; report oversized or malformed sources as incomplete. Do not silently claim to have indexed a truncated document.

One index writer publishes transactional updates. Queries read a committed index generation, never half an update. Before supplying selected evidence, check source revisions where practical; on change, retry within a small bound or mark/omit stale material. This gives a coherent index view, not a claim of an atomic snapshot of every file in a concurrently edited vault.

Rename handling uses stable IDs. Duplicate IDs or OneDrive conflict copies become diagnostics, not silent winners. Mark a document deleted only after a successful enumeration establishes absence; an inaccessible vault or failed scan is not mass deletion. Recovery must support full rebuild and integrity checks without modifying source notes. A damaged or rebuilding index can serve verified exact project context where available, but must label reduced coverage rather than silently fall back to an unbounded full-vault search.

## Per-question retrieval

At project activation, resolve and optionally prefetch its current summary. At submission, use the current user question, explicit project scope and a bounded amount of conversation context for references such as “that decision.” Do not use unrelated chat histories to infer scope. A named project overrides the previous conversational project; an ambiguous request gets a narrow clarification when necessary.

For a current-state or resumption question:

1. Read the current project projection and its coverage/revision metadata.
2. Select relevant current decisions and session evidence, including relevant records not yet incorporated into that projection.
3. Expand known correction/supersession links within a fixed depth/source limit. If the limit or missing links prevent resolution, report uncertainty.
4. Deduplicate repeated summaries and their common source. Several paraphrases of one session do not become independent corroboration.
5. Assemble a bounded evidence packet, with source identifiers, revisions, headings, dates, limitations and explicit conflict labels.

For “why,” prioritize the decision and rationale. For “what changed,” compare dated evidence and distinguish branch/worktree results. For a portfolio question, first retrieve bounded project summaries, then selected supporting evidence across the requested scope. Explain coverage if a large portfolio cannot fit. Relevant global research is a separate evidence lane; it is never a cross-project commitment.

Use a total request budget shared with conversation history, system context, other evidence and reserved output, plus per-document/source limits. Begin with a configurable memory allocation around 4,000–6,000 tokens and at most eight passages, then tune with evaluation. These are starting design parameters, not established optimums. Token accounting must follow the selected model when available, with conservative fallback bounds. The library's growth must not automatically enlarge every prompt.

Do not attach the entire research catalog or the newest Decision Log tail to every answer after the indexed path has been validated. Retain the old path behind a rollout switch while migration is tested. Current instructions, current evidence and historical evidence must remain separated in the actual prompt construction.

Known structured corrections can be resolved deterministically. Arbitrary contradictions hidden in natural-language prose cannot be guaranteed to be discovered. Where competing relevant claims are known, retrieve both; source type and direct evidence matter, not simply the newest timestamp or highest similarity score. Ask Kevin only when the unresolved conflict affects the answer or direction.

## Explainability, coverage and growth

Record the exact bounded evidence packet for each request: source revisions and excerpts, index generation, retrieval policy version, scope, selection reasons, truncation and retrieval status. “Sources supplied” means available to the model; it does not prove which source caused a particular sentence. A future Memory details view can explain what was supplied and open the source while indicating if it has since changed.

Distinguish no relevant match, ambiguous scope, index unavailable, partial indexing and stale evidence. Track last successful reconciliation and contributor coverage. Good retrieval cannot recover session records that another tool never wrote. Portable contribution adapters are a separate workstream; neither a new index nor the personal skill proves all concurrent sessions are covered.

Keep summaries concise, linked to source revisions, and rebuildable from primary evidence. New session records can make a summary incomplete even if its file is recent. Avoid repeated summary-of-summary compression that gradually removes rationale. Retain original records; archived records remain searchable for appropriate historical questions. Runtime retrieval never silently rewrites a summary or promotes a recommendation.

Bound cache and diagnostic retention separately from curated source retention. Source deletion removes it from future retrieval; past answer snapshots remain part of recorded answer history unless explicitly cleared through a defined removal policy. Do not claim deletion from the source file erases every retained copy. Rebuildable indexes are not backups; preserve independent source recovery and test restoration.

## Rollout and acceptance

1. **Contract and fixtures.** Define project/record identity, legacy adapters, eligibility, correction handling, budget and failure states. Test current vault compatibility before schema edits.
2. **Index and local diagnostics.** Build/rebuild/search without sending results to a provider. Test restarts, missed notifications, same-timestamp edits, renames, deletion, duplicate IDs, partial writes, unsupported schemas and unavailable OneDrive files.
3. **Active-project retrieval.** Wire one explicit project into the native request path behind a rollback switch. Save provenance and validate known-answer questions before general enablement.
4. **Portfolio and library expansion.** Add bounded cross-project retrieval and reuse the service for research. Evaluate semantic retrieval only against measured misses. A Codex-facing search adapter is a separate integration, not an automatic consequence of native support.

Use fixtures with 100, 10,000 and 100,000 records, varied document lengths, multiple projects, duplicated evidence and distracting recent content. Record corpus bytes/chunks as well as note count. A provisional warm-query target is p95 under 250 ms on a declared reference machine, measured without provider latency; revise only from measurements. Initial build and incremental-update times need separate measurements. Verify that warm requests do not enumerate all vault files and that prompt size stays within its configured limit.

The must-pass factual cases include an old still-current decision; its later explicit reversal; a newer unapproved recommendation; conflicting concurrent branch reports; an unreconciled session milestone; similarly named projects; a project with no recorded commitment; source vs import dates; out-of-scope personal notes; and instruction-like text inside evidence. Measure retrieval recall/precision and answer grounding separately. Passing keyword retrieval does not prove the model reasons correctly from it.

Use a frozen regression set plus held-out paraphrases. Compare each retrieval-policy or model change against it. Run native integration on an isolated acceptance vault and database; no test data in the real vault. Provider answer acceptance is distinct from Rust retrieval tests and requires the applicable explicit paid-run scope. Browser visuals cannot establish backend recall.

## Verification performed for this review

Read repository policies, current memory loaders/parsers/request assembly, schema, relevant vault notes/templates and SQLite documentation. Ran the existing read-only real-vault project-join test: reproduced the missing-alias failure, repaired it through the memory helper with expected hashes, then passed the same test. No performance benchmark, retrieval implementation, browser UI review, full native desktop acceptance or provider call was performed. The scale/latency targets above are proposed acceptance criteria, not measured results.
