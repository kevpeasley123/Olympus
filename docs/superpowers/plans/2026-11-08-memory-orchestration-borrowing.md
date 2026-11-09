# Memory and Agent Orchestration Borrowing Plan

> **For agentic workers:** Use superpowers:executing-plans if this proposal is approved for implementation. Steps use checkbox syntax. Kevin approved all four slices in the subsequent implementation request. Concrete schemas and compatibility decisions are recorded in the implementation receipt.

**Goal:** Make ordinary Olympus conversations and bounded agent work retain useful context, reuse corrected knowledge and contribute durable evidence across projects.

**Architecture:** Extend the existing Rust commands, SQLite operational state, derived memory index and Obsidian records. Replace whole-note learning as the authoritative memory mechanism with source-bound contributions and a readable projection. Prove one existing agent workflow before considering general orchestration.

**Tech Stack:** Existing Tauri/Rust, rusqlite, React/TypeScript and Obsidian Markdown; no new runtime dependency proposed.

**Spec / evidence:** [Pinned code comparison and proposed design](../../reviews/2026-11-08-gbrain-memory-orchestration.md). Kevin subsequently authorized implementation in sequence.

## Global constraints

- Keep the existing SQLite database and rebuildable memory index; do not introduce Postgres, a vector database, a graph database, Redis or a new service.
- No gbrain package, daemon, automatic updater or copied agent-instruction bundle.
- Preserve account-bound subscription eligibility, explicit task routes and no paid/provider fallback. Qualification is task-specific; currently unqualified local models do not become qualified because of this redesign.
- Preserve Temporary chat exclusion, source revisions, operator edits and existing approval boundaries. Stored memory cannot grant execution permission.
- No new global chat collector, mail scope, external transmission destination or overnight autonomous work.
- No rating/filing chores for Kevin. Normal conversation remains the correction interface.
- No general workflow builder or recursive agent spawning. First pilot retains the existing researcher/verifier graph and one clarification round.
- Additive migrations only; never alter shipped migrations. Preserve legacy memory and rollback reads. Any data-rewriting migration needs separate review before execution.
- Each slice must remove or supersede a duplicative path when enabled; temporary compatibility must have an explicit removal criterion.

## Review focus

1. A corrected or withdrawn fact reappearing after replay/rebuild: Slice 2 recovery tests.
2. Two projects or sessions sharing words and leaking task state: Slice 3 isolation tests.
3. A cancelled or interrupted agent publishing late output: Slice 4 generation/source checks.
4. Trimming a long chat discarding an important constraint: Slice 3 context-pressure test.
5. Provider changes or exhausted allowance rerouting work silently: Slices 1 and 4 dispatch tests.

## Slice 1 — Establish the quality baseline and finish research routing

**Files:** existing `src-tauri/src/commands/research_verification.rs`, `research_agents.rs`, `execution.rs`, `subscription_jobs.rs`, `inference_routes.rs`, relevant model-route settings and tests. New synthetic evaluation fixtures under `scripts/acceptance/` only if existing fixtures cannot express the cases.

**Interface:** existing `execution::structured(provider, purpose, instructions, input, schema, record)` remains the structured inference boundary. Bind the selected provider/model policy at the parent-run start and carry it to each child; explicit changes invalidate or require a new run. The model may not choose its own authority or billing route.

- [ ] Capture a small fixed scenario set: long task continuation, reversed decision, similar project names, unsupported suggestion, irrelevant newsletter, completed research reuse, changed source, interrupted publication and cancelled request.
- [ ] Assert the present failures before changing behavior. Score relevant evidence selection, correction handling, lost constraints, unsupported claims and user-rated usefulness separately.
- [ ] Replace the research/verifier calls that implicitly default to Claude with the explicit common execution route. Audit other call sites and record remaining exceptions; do not expand this slice into rewriting every worker.
- [ ] Test selected Codex and Claude dispatch with stub transports; no fallback on denial or exhaustion. Local selection remains explicitly configured and unqualified until separately evaluated.
- [ ] Run `cargo test --lib commands::research_verification`, the model-routing tests and relevant frontend setting tests if touched. Review and commit this slice independently.

**Done when:** choosing a research route actually controls both stages and receipts name their actual execution. No coding-adapter parity is claimed.

## Slice 2 — Turn learned memory into addressable, source-backed records

**Files:** existing `commands/chat_memory.rs`, `chat_memory_jobs.rs`, `memory/record.rs`, `memory/index.rs`, `memory/retrieve.rs`, their tests and `docs/CONVERSATIONS-AND-MEMORY.md`. Isolate contribution validation in a small adjacent module rather than enlarging the prompt module indefinitely.

**Proposed record contract:** stable record ID, subject/project scope, assertion kind (operator statement, observed fact, provisional inference), text, exact source references/revisions, source event time, recorded time, status, optional expiry and correction/supersession target IDs. Source excerpts establish traceability; semantic support still requires evaluation.

**Storage decision:** use versioned, source-backed vault records and the existing derived index. Keep source messages in their existing store. Extend the current contribution job's prepared output to a deterministic manifest of records so a retry can finish publication without another model call. Do not create a second permanent fact database. Exact record granularity and on-disk path must be finalized with the slice design; the chosen path must be explicitly eligible, not accidentally classified as historical-only evidence.

- [ ] Test one explicit preference, one project decision and one tentative suggestion: only the first two become operator assertions, and every emitted item resolves to its exact source.
- [ ] Change model output from an entire memory replacement to bounded candidate additions/corrections. Validate source identity and scope before publication; reject unsupported IDs.
- [ ] Publish through the existing prepared-result/attempt fence and vault compare-before-write mechanism. Cover partial multi-record publication with deterministic IDs, manifest receipts and restart recovery.
- [ ] Preserve the existing learned note as a human-readable compatibility view, not the sole source of truth. Keep Kevin's authored edits; do not re-extract old summaries as fresh facts or silently discard them.
- [ ] Implement correction and withdrawal as durable records. Retrieval suppresses withdrawn current assertions after rebuild; historical queries may explain the old record and its correction. Distinguish withdrawal from erasure of underlying sources/backups.
- [ ] Test repeated input, concurrent user edit, changed source, corrected statement, expired transient state, interrupted write and replay after index rebuild.
- [ ] Run the memory/chat-memory suites and the scenario set; review and commit. Enable the new writer only after comparisons show retained decisions and correct source links.

**Done when:** a later conversation can retrieve a specific learned decision and its correction without requiring the whole summary note, and restarting cannot duplicate its publication.

## Slice 3 — Add working checkpoints and one bounded context assembly path

**Files:** `commands/assistant.rs`, `vault_context.rs`, `memory/retrieve.rs`, conversation persistence, a new working_context module alongside the existing command modules, next additive migration if required, and context tests. The working_context module does not exist yet. Reuse existing turn-context receipts where possible; do not overload an evidence receipt with mutable task authority.

**Proposed checkpoint:** conversation/task ID, project IDs, current objective, explicit constraints, verified accomplishments with evidence references, unresolved questions, suggested next action versus committed action, source watermark/revision, checkpoint revision and status. It stores a concise work summary, never hidden chain-of-thought. No global singleton checkpoint.

**Context contract:** one request-scoped result with core preferences, task checkpoint, selected evidence and internal omissions/coverage. Budget whole items with a reserved output allowance. Use the same evidence objects for ordinary chat and the agent pilot; retain domain-specific Gmail authorization checks. Do not expose a routine coverage disclaimer in conversational prose; material failures remain available and actionable.

- [ ] Add the failing long-conversation fixture: an early constraint falls outside the present history window but must survive into the next turn.
- [ ] Persist a checkpoint before discarding necessary task context and at meaningful task milestones. If checkpointing fails, retain/retrieve the essential source or report the limitation; do not silently imply full continuity.
- [ ] Assemble bounded core/task/evidence context with deduplication and source-revision checks. Choose the initial partition from fixture measurements within existing model input limits, then pin it in tests.
- [ ] Replace the unconditional whole learned-note prefix when the new records are ready; keep an explicit compatibility path while older memory remains unmigrated.
- [ ] Test restart, project switch, same-name projects, Temporary chat, stale checkpoint, corrected instruction and oversized UTF-8 sources. Current user instruction outranks older checkpoint content.
- [ ] Run context/memory/conversation tests and the scenario set; review and commit. Do not auto-promote all working state into permanent memory.

**Done when:** restarting or changing engine preserves an ordinary task's objective and constraints while unrelated sessions remain isolated.

## Slice 4 — Close one agent-to-knowledge loop with existing execution machinery

**Files:** `research_verification.rs`, `research_agents.rs`, existing run/checkpoint persistence, contribution validator from Slice 2, request/activity receipts and the existing inspection UI only where needed.

**Interface:** a verified parent result envelope containing run/stage IDs, source revisions, findings, unresolved questions, actual model and terminal status. It is evidence, not a memory-write capability. Parent-owned publication validates that envelope and uses the same contribution format as chat learning.

- [ ] Use the existing researcher/verifier pair as the sole first pilot. Keep its one clarification round and bounded deadline. Do not add a third coordinator model merely to concatenate results.
- [ ] Preserve completed read-only stage outputs in existing checkpoints. On restart, revalidate source/route identity and reuse valid stages; resume remaining work only under still-valid authorized scope. Source or policy changes require re-evaluation.
- [ ] Distinguish replayable reads from uncertain side effects. Coding delegation remains on its existing explicit resume boundary; do not replay CLI edits as if they were database reads.
- [ ] Publish a provisional source-linked finding from a successful parent result using deterministic identity derived from the run/result revision. Failed, cancelled and insufficient outcomes must not become established facts or commitments.
- [ ] Use the finding in a later ordinary conversation and in a second research task. Verify original evidence, not only the previous model's wording. Re-indexing or retry must not duplicate the finding.
- [ ] Test child failure, cancellation during verification, source modification before publication, crash after publication before receipt and duplicate terminal notification.
- [ ] Run research-verification, memory and recovery tests. Conduct one authorized native end-to-end acceptance on non-sensitive fixture evidence using the chosen subscription; compare against a single-agent baseline for usefulness and latency. Private evidence needs its existing scoped authorization checked.

**Done when:** the app demonstrably completes a bounded investigation, remembers its supported outcome once and uses it later. Passing storage tests alone is insufficient.

## Deferred work and trigger conditions

- **Semantic search / reranking:** only if measured retrieval misses persist after source consolidation and scope fixes. Prefer the smallest local addition; do not preselect a vector database.
- **Learned ranking:** only after evidence receipts and enough scoped correction examples exist. No mandatory ratings UI.
- **General scheduler / parent-child fan-out:** only after two real workflows need the same coordination and the fixed pilot improves outcomes enough to justify it.
- **Codex coding-delegate parity:** separate adapter work with equivalent workspace/tool/recovery tests. It is not delivered by shared structured inference.
- **Continuous dream cycles:** only after a useful bounded maintenance task is demonstrated with explicit resource limits. No automatic ingestion of unrelated chats.
- **External harness access:** use one thin adapter over the eventual common contracts; do not distribute copied memory stores. Not necessary for the initial pilot.

## Rollout and stopping rules

Each slice ships independently after its focused checks, semantic scenario comparison and review. Keep source data intact and a reversible read path. Do not promise unchanged implementation complexity: the goal is fewer overlapping responsibilities, with small explicit additions justified by observed behavior. If a slice needs a new daemon, database, generic plugin framework or broad unrelated refactor, stop and revisit the scope.

The first delivery should be Slices 1–2; Slices 3–4 follow only after source-backed memory behaves correctly. Conversational briefing polish remains a separate small consumer change, including Kevin's request to omit routine “About this brief” copy and discuss whichever work is actually relevant.

## Implementation receipt — November 8–9, 2026

The four development slices are implemented on feature/source-backed-working-memory. This is not an installation receipt. Native and regression evidence is recorded in [implementation acceptance](../../reviews/2026-11-09-memory-workflow-acceptance.md).

Finalized storage: one immutable assertion per learned Markdown record; publication manifests use the existing contribution/run journals and hidden vault receipts. Working checkpoints use additive migration 0007, keyed by conversation and resolved project scope. Short checkpoints are extractive; compaction uses the selected structured runtime. The old learned note is preserved and topic-filtered, never re-extracted as fresh evidence.

Scope boundaries: no local-model promotion, coding replay, broader mail scope or new service. Conversational opening-brief polish remains a separate consumer change. Model semantic quality is tested on synthetic scenarios, not claimed universally. Arbitrary edits to a checkpoint's original messages currently fail explicitly rather than silently rebuilding task authority.
