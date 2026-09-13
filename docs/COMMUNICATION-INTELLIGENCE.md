# Current development: Communication Intelligence v3

See [Communication Intelligence v3](COMMUNICATION-INTELLIGENCE-V3.md). Explicit Analyze/Refresh now sends bounded selected excerpts to the existing OpenAI primary route for interpretation, with a genuine three-pass cached-thread expansion loop. Two skills and the five-node graph remain; background findings and operator feedback are visible. No mail/project actions or automatic learning. Installed release remains 0.16.0. Earlier sections below describe historical versions and their verification.

# Communication Intelligence v2 — current design

The adopted [architecture critique](COMMUNICATION-ARCHITECTURE-CRITIQUE.md) supersedes the v1 skill/loop/graph design below. Current skills are `communication-assess@1` and `project-relevance@2`. Current graph: snapshot -> select -> assess/project -> synthesize. Project matching checks all supplied names and aliases deterministically; it does not run a discovery loop. Synthesis owns recommendation and ranking policy and validates source identity. Active guidance uses REVIEW / VERIFY / MONITOR; no-action is an assessment, and no confirmed operator checkpoint is inferred. No additional runtime or database schema was added. v1 stored runs remain immutable and inspectable; refresh is required to publish a v2 brief.

The manual local privacy boundary, source limits, read-only authority and evaluation storage remain. The critique documents current contracts, generalization, reuse, tradeoffs and deferred work. The following v1 description and receipt are historical, not the current design.

---

# Communication Intelligence v1

September 12, 2026. This is a fixed local workflow, not a general orchestration engine.

## Product and trigger

Communications leads with **Olympus Communications Brief**. Click **Analyze communications** / **Refresh intelligence** to analyze the current cached view. At most five supported findings appear, with recommendation, source context, uncertainty, and source access. Fewer items are valid; no-attention means only that the bounded selected candidates yielded none. It is never proof that the whole mailbox is clear. Metrics, activity, received/sent, thread counts, and sender distribution remain under collapsed Analytics.

This v1 is deterministic, local and conservative. It detects possible attention from existing fingerprint-current candidates; it does not claim semantic delivery-date changes, actual commitments, or that a sent reply resolved a request. Summaries quote a bounded source excerpt and describe observable cached message sequence. Source text is evidence, never executable instructions.

## Existing architecture and reuse

Knowledge Audit already executes a fixed read-only graph. Its `GraphNode` definition moved without behavioral change into `commands/workflow.rs`, alongside the new reusable `SkillContract`. Both workflows retain SQLite run/event conventions and backend-owned edges. There is no graph DSL, dynamic tool router, or alternate delegation approval system. Coding delegation's launch/review authority remains separate.

The vault Skill Index describes installed Codex skills and Olympus integrations/templates. Agent Index is a draft catalog. These do not constitute an executable Olympus skill runtime. The compiled registry below is included as a compact runtime inventory in assistant context; full contracts are inspectable through `communication_skills` and run details. The operator-owned vault indexes are not rewritten.

## Skills and contracts

All are version **1**, bound explicitly by graph node kind:

| Skill | Input | Output |
| --- | --- | --- |
| communication-triage | ThreadInput | attention yes/no/uncertain, reason codes, summary, evidence, disposition |
| thread-summarize | ThreadInput | what happened/changed/matters/likely next move, evidence |
| project-relevance | ThreadInput + backend-owned bounded project provider | suggested/ambiguous/unresolved, project evidence, ambiguity, lookup records |
| communication-recommendation | Triage + Relevance | disposition, guidance, categorical priority, evidence |

`SkillContract` includes purpose, JSON-shaped input/output schemas, capabilities, prohibited effects, evidence requirements, loop budget, success criteria and implementation identity. Rust structs reject unknown fields; typed construction and validators enforce message sizes, chronological order, common thread identity, required IDs/fingerprints, candidate enums and evidence joins. There is no public arbitrary skill executor. Recommendation vocabulary is REVIEW, RESPOND, CONFIRM, DECIDE, MONITOR, NO ACTION, INVESTIGATE; v1 intentionally emits only evidence-supported categories, generally REVIEW/CONFIRM/INVESTIGATE/NO ACTION.

Availability does not grant execution permission. Pure skills have no network, database write, Gmail mutation, shell, or vault-write capability. The fixed runner alone reads permitted sources and appends its own operational evidence.

## Graph and joins

`communication-intelligence/v1`:

```
snapshot -> select -> triage ------------------+
                  -> project (max 3 lookups) --+-> join -> priority -> recommendations -> brief
                  -> summary -----------------+
```

Triage, project and summary depend only on selection. They are independently recorded but run sequentially: these small local computations do not justify thread overhead. No parallel scheduler is claimed. Join requires all three successful outputs with equal cardinality. Priority uses categorical attention, uncertainty and project ambiguity; no opaque numeric importance score. Deadline/response candidates lead, uncertain signals follow, background items do not fill the brief. Within a category, deterministic newest-thread order is preserved.

Failed source/schema/node processing stops publication; completed evidence remains. Remaining nodes are stopped, with failure and manual-new-run retry reasons. Reusing a request ID with identical scope is idempotent; conflicting scope is rejected. Restart marks unfinished runs interrupted. Retry is a fresh run, not an automatic replay. Backend-owned graph definitions cannot be supplied or altered by callers.

## Selection and bounded loop

Selection uses current-fingerprint candidate messages within the requested view and configured horizon, available/in-scope only. It selects at most **12 newest candidate threads**, then at most **4 latest messages per thread**, each at most **2,000 body characters**, 300 sender/subject characters. Maximum inspected body text is 96,000 characters, local only. This is not comprehensive mailbox analysis. Existing candidate-generation limitations carry forward (INBOX relevance/IMPORTANT with question/deadline cues).

Project discovery performs conditional retrieval:

1. Declared project file names.
2. Declared aliases/name keys, using the existing project-note parser.
3. Recorded vision text, requiring a literal multi-word phrase rather than loose keyword matches.

Stop after one supported candidate or at iteration three with ambiguity / no supported match. A suggested relationship remains unconfirmed. Sources are only top-level Markdown project notes in `01 - Projects`, at most **24 files**, each **16 KiB**, at most 12 alias keys and 2,000 description characters. Canonical paths must remain in the allowed folder. Missing/unreadable/oversized context fails closed. No web, research, arbitrary filesystem or self-expanded source list. Every completed lookup immediately records iteration, source layer, matches and stop reason. A 30-second cooperative budget is checked before each project retrieval; it is not a hard OS filesystem timeout.

## Evidence and freshness

SQLite tables: `communication_runs`, `communication_events`, `communication_evaluations`.

Runs retain graph/skill versions and contracts, source signatures, selected evidence, status, real timestamps and elapsed milliseconds, generated brief, failure, and model/usage null (no model). Node events retain start/end state and structured outputs; project iterations have their own timestamped events. No hidden reasoning is stored. Existing SQLite is ordinary local storage, not newly encrypted by this feature.

Mail identity includes account at run level, message/thread IDs, timestamp and source fingerprint. Project references include note path and fingerprint. No entire input bodies are copied to events; concise source quotes and derived findings are persisted. Cache changes and project metadata changes invalidate the presented brief; it also expires after 15 minutes. Historical evidence remains inspectable and is not silently rewritten. Same SQLite lock keeps a run's mail snapshot consistent with cache operations; project reads detect changed fingerprints across retrievals. Disconnect blocks run/history access for that account. Previous analyses are bounded to ten in the UI; storage is retained (no automatic deletion/retention policy yet).

## Evaluation and authority

Opening a recommendation records `opened`. Explicit correction controls record `false_response`, `false_deadline`, or `project_dismissed`, tied to an actual run/item and current enabled account. These are evaluation records, not edits to mail, candidates, tasks or project state. Absence of a click is not recorded as "ignored". Project acceptance, missed-message feedback, evaluation dashboards and automated skill revision are not implemented.

Future improvement lifecycle:

RUN -> EVIDENCE -> EVALUATION -> PROPOSED SKILL/GRAPH REVISION -> TEST -> OPERATOR REVIEW -> VERSIONED ADOPTION.

No automatic rewriting of skills or graphs. No task/decision creation, memory promotion, project edits, mail drafting/sending/deleting, or authority widening.

## Privacy

Analyze/Refresh makes **zero model calls** and **zero Gmail requests**. Opening Communications loads prior local runs only; it does not launch analysis or expose the mailbox to a provider. The existing explicit Ask Olympus about this thread flow is unchanged: preparing a question does not send it; submitting supplies existing bounded Gmail evidence to the configured reasoning provider. The compact skill inventory contains no Gmail contents.

## UI and development

`CommunicationsBrief.tsx` adds restrained recommendation rows, Why this?, source review, correction feedback, inspection and prior-run selection. Stale/failed output is withheld. The inbox retains its source inspector, search, groups and page scrolling, with chat in its reserved layout row. Briefing introduces no continuous motion and honors reduced motion.

`/communications-harness.html` contains clearly marked synthetic fixtures; `?run` executes browser checks. Browser fixtures do not prove native invocation or real mailbox quality. No real Gmail content is committed in fixtures.

## Next graph

A manual **Project Readiness Brief** can reuse `SkillContract`, fixed `GraphNode`, source fingerprints and evaluation conventions: snapshot Git facts + accepted vault intent -> independent drift/blocker checks -> evidence join -> review recommendations. It should not launch coding agents or change intent without the existing approval flow.

## Verification receipt

- `npm run build`: passed.
- `cargo test --quiet --lib --manifest-path src-tauri/Cargo.toml --target-dir C:\Users\kevpe\dev-target\olympus-memory`: **281 passed, 0 failed, 2 ignored** (283 total). Includes 13 added skill/graph/cache integration tests.
- Communications browser harness: **47 checks passed**, sidebar and 1280x720; also tests constrained layout, source feedback, run inspection, stale/failed withholding, no continuous motion, analytics reachability and reserved chat layout.
- Gmail UI: **17 passed**. Knowledge Audit UI: **12 passed**. Command/instrument UI: **82 passed**, including reduced motion.
- Native debug process restarted successfully; read-only schema inspection confirmed all three new tables exist. No manual real-mailbox analysis was performed, so native Analyze invocation and real-world recommendation quality remain acceptance work.
- Existing frontend dependency/bundle warnings and the assistant ContentBlock dead-code warning remain. No commit, push or installation performed.
