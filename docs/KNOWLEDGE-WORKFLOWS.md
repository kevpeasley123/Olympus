See the adopted [v2 architecture critique](COMMUNICATION-ARCHITECTURE-CRITIQUE.md) for the current skill boundaries and workflow.

# Shared fixed-workflow contracts

See [Communication Intelligence](COMMUNICATION-INTELLIGENCE.md). Communications now leads with a manual, local evidence-backed brief. Two active typed skills use shared GraphNode / SkillContract definitions. The v2 graph has five nodes; project relevance uses a bounded deterministic matcher, not a discovery loop. Analytics remains collapsed. No model calls, Gmail writes, project changes or memory promotion are added. Earlier implementation entries below are historical.

# Knowledge, graphs, loops, and improvement

September 12, 2026. First slice implemented in development; not a release or an
authorization to execute any proposed action.

## Architecture decision

Keep the existing ownership model. Introduce a narrowly scoped, read-only
knowledge audit as the first executable graph. Its durable evidence contract is
the foundation for later generated topic synthesis, interviews, and briefings.
No orchestration dependency, new model route, generic tool executor, or scheduler.

Repository inspection found substantial existing machinery:

| Existing implementation | Reuse / boundary |
| --- | --- |
| `assistant.rs`, `vault_context.rs` | Shared text/voice context, stable operator notes, bounded historical decisions; preserve their distinct authority |
| `research_retrieval.rs`, `pantheon.rs` | Deterministic topic ranking, at most 3 sources / 4,000 excerpt characters; source stance, origin, body fingerprints |
| `conversation_research`, `memory_promotion.rs` | Durable supplied-source snapshots and exact reviewed chat promotion; not a generated knowledge store |
| `vault_write.rs` | Contained paths, normalized SHA-256 fingerprints, explicit write intents; source reads in this slice reuse containment |
| `projects.rs`, `project_notes.rs`, `projectBriefing.ts`, `projectCommandBoard.ts` | Git/intent reconciliation, since-opened briefs, deterministic attention and next-move projection |
| `approvals.rs`, `delegation.rs`, `delegation_review.rs` | Exact-scope approval consumption, isolated worktrees, events, workspace-bound checks, operator acceptance; never bypass |
| `models.rs`, `responses.rs` | Backend model catalog and actual request telemetry; no model call needed for this first slice |
| Dashboard/Pantheon polling | Refresh infrastructure, not a durable autonomous scheduler |
| Current constellation presentation | Category and 80-second yaw; unrelated to workflow execution and unchanged here |

Missing before this slice: persisted audit runs, explicit graph dependencies,
branch/iteration evidence, rechecking source provenance after restart, and an
inspectable generated attention report. Still missing: durable LLM topic pages,
claim-level semantic entailment/conflict checking, interview extraction,
read-only cadence, and live connector adapters.

### First-workflow choice

| Candidate | Assessment |
| --- | --- |
| Knowledge synthesis/update | Highest eventual knowledge value, but requires a generated-artifact write/promotion contract and quality evaluation; build on this evidence foundation next |
| Olympus audit/improvement | Selected: real source health and review needs, bounded read-only discovery, independent branches, durable join/verification, no new execution authority |
| Proactive project briefing | Existing deterministic board already covers much of it; avoid rebuilding it before provenance/recovery primitives are proven |
| Operator interview/extraction | Useful next consumer of evidence/proposal contracts; does not naturally test parallel evidence collection as well |

## Implemented graph

`knowledge-audit/v1` is a compiled, fixed backend workflow. Each run stores a
machine-readable definition (node IDs, kinds, dependencies, iteration bounds),
the route, topic, timestamps, result and generated findings. Definitions are not
accepted from the webview. The code executes the declared structure directly;
this is not a general DAG interpreter or editable workflow platform.

```text
scope
  ├─ research: ranked Pantheon retrieval → bounded source inspections
  ├─ history: recheck sources from 3 previous audits
  └─ reviews: read waiting / awaiting_review delegation records
        ↓ join all branches
deterministic findings
        ↓ verify current source / checkpoint fingerprints
closed route: needs_you | no_findings_in_scope | incomplete
```

Independent branches run on scoped worker threads. Database locks cover short
queries/event writes; no filesystem read holds the shared SQLite mutex.
The outer Tauri command uses the blocking pool, not the UI thread.

Research discovery is a deterministic bounded retrieval loop, **not an LLM
agent loop**. Existing ranking provides at most 3 candidates. Each iteration
reads one permitted research Markdown source (512 KB maximum), validates its
body against the ranked snapshot, reads current metadata, and emits an evidence
packet or a failure event. It stops on candidate exhaustion or 3 inspections.
No shell, external network, arbitrary path, new route, or approval capability is
available. A failed source does not erase successful evidence. The existing
index scan precedes candidate inspection inside the research branch; its
coverage limits remain explicit rather than becoming an exhaustive audit claim.

History inspects at most 3 earlier run records, each with at most 3 normal source
packets. Reviews inspect at most 100 waiting/awaiting-review runs; exceeding that
limit makes the report incomplete rather than silently hiding checkpoints.
The checkpoint branch is portfolio-wide, independently labelled; it does not
infer that every checkpoint is related to the selected research topic.

The join proposes only deterministic observations:

- selected research has a recorded `unevaluated` or `disputed` stance;
- an earlier audit's evidence changed, disappeared, or became unavailable;
- an existing delegation is waiting for operator review.

No semantic contradiction detector, arbitrary quality score, automated source
endorsement, inferred commitment, or successful-execution claim is present.
No matching sources is incomplete coverage, not healthy knowledge.

Final verification rereads selected source files and the review-checkpoint set.
Any mismatch or branch/read failure produces `incomplete`. Otherwise the run is
`snapshot_ready`, with either `needs_you` or `no_findings_in_scope`. Neither state
means the proposed work is complete. The source snapshot can be verified without
the truth of the source's argument being verified.

## Knowledge and authority model

| Dimension | Implemented meaning |
| --- | --- |
| Source ownership | Git facts / local technical files / vault intent and research / SQLite operational state remain separate |
| Source fact | A recorded stance, file body, path, or existing delegation checkpoint at collection time |
| Generated synthesis | Deterministic audit findings; report explicitly carries `generated_proposal` |
| Provenance | Source title/path, stance/origin/date where present, quoted excerpt, body fingerprint, full-file fingerprint and checked time; finding references source path or delegation ID |
| Health | `unchanged`, `stale`, `missing`, `unavailable` from fresh contained reads; independent of node category and source stance |
| Freshness | Equality to the recorded normalized fingerprint, not a time-based claim of truth or relevance |
| Operator-confirmed / approved | Not set by this workflow; existing promotion and exact-scope approval paths retain ownership |
| Executed / verified / complete | Graph observations are distinct from delegated work; this graph never completes a delegation |

Full-file fingerprints include metadata changes that body-only retrieval hashes
cannot catch. Fingerprinting reuses existing line-ending/trailing-space
normalization. Raw evidence is retained as supplied; changes produce new checks
or a new run, never edits to the source note or replacement of a historical
report. Inspection logs its latest source/checkpoint health checks durably.
UI displays collection-time results separately from current evidence health.

Stable / slow-changing / fast-changing / ephemeral classes are design guidance,
not a new generic TTL policy. Profile/Charter and vision should use source-change
invalidation; Git/tasks/approvals/runs should be refreshed at use; transient
diagnostics should not become durable knowledge. This slice needs fingerprints,
not arbitrary stale-day thresholds or confidence percentages.

## Retrieval routing

Implemented route: `knowledge_audit`. Primary source is Pantheon research files;
supplements are previous source snapshots and operational review checkpoints.
The persisted route explicitly cannot override operator intent, curated memory,
approval, execution or completion. The only start inputs are request ID and topic.

Future closed routes should reuse rather than replace current context building:

| Request | Primary | Supplements / constraints |
| --- | --- | --- |
| Implementation status | Git + project-local context | Tasks / run evidence cannot supersede actual Git state |
| Why a choice was made | Recorded decisions + operator notes | Conversations / research remain supplementary evidence |
| Current project status | Reconcile Git, tasks, approvals, runs, notes | No source silently substitutes for another |
| Conceptual research | Pantheon | Generated synthesis must expose source fingerprints and health |
| Operator preference | Curated memory + authored vision | Interview candidates / generated observations are not standing truth |

These future routes are not implemented as assistant dispatch. There is no
hundred-rule prompt or generalized policy language.

## Storage and recovery

Two additive tables are applied through the existing idempotent startup schema:

- `knowledge_audit_runs`: immutable identity/topic/graph provenance and evolving
  operational status/report payload. At most one active run per desktop DB.
- `knowledge_audit_events`: ordered, timestamped node starts/iterations/evidence,
  failures/joins/verification/routes and subsequent inspection checks.

Audit reports are operational artifacts, so SQLite owns them. They are readable
through Research → Knowledge audit & evidence history. This does **not** decide
where future topic knowledge belongs: reviewable Markdown synthesis should live
in a clearly generated vault area only after an explicit write contract is
implemented through the existing gate. No vault schema/folder is added here.
No credentials, hidden chain-of-thought, token estimates or fabricated costs are
recorded. No model was invoked, so model usage is not applicable.

Failure/recovery contract:

1. Persist a run before gathering. Persist evidence packets as events as collected.
2. A branch failure retains independent branch outcomes; join reports incomplete.
3. Persist the joined artifact before verification, so verification failure cannot
   erase the gathered provenance.
4. Identical request ID/topic is idempotent; changed scope with the same ID rejects.
   An uncertain response can be checked/retried with the same ID.
5. Explicit regeneration uses a new ID and fresh reads; no replay of writes is
   involved. Restart marks active runs interrupted and preserves partial events.
6. Historical runs never resume automatically. The operator can inspect history
   and rerun the topic. Database errors surface; there is no browser fake-success
   persistence path in production.
7. Final read checks narrow source races but do not lock Obsidian/OneDrive or other
   writers. A source can change immediately after verification; inspection rechecks
   it. Verification is an observation at a time, not a permanent guarantee.
8. The Pantheon index can omit malformed/unreadable entries and relevance is lexical.
   Reports explicitly cover selected indexed matches, not the entire library.

History lists the latest 30 runs; older records remain in SQLite. A retention /
archive policy and long-running live node progress UI are future work. This first
UI returns a completed snapshot or exposes interrupted/failed history; it does not
stream graph events while gathering.

## Dependency order and deferred work

1. **This slice:** read-only graph, bounded retrieval, provenance, health,
   inspectable proposals and restart-safe evidence.
2. **Generated synthesis:** claim records with explicit supporting source IDs,
   generated-only Markdown artifact ownership, supersession, fingerprint checks
   before retrieval, constrained output schemas, quality evaluation. Never replace
   raw sources or silently inject synthesis into authoritative context.
3. **Assistant routing:** small closed route catalog, source packets reused across
   answer/briefing/audit paths; route choice and actual model metadata when used.
4. **Interviews:** a reusable interview skill within a fixed capture → raw artifact
   → candidate extraction → review graph. Candidates have kinds (preference, fact,
   decision, assumption, goal, constraint, question). Promotion separately reviews
   the exact text/destination through the existing gate. Answering is not approval.
5. **Improvement proposals:** attach observed deficiencies and before/after
   acceptance evidence; execution uses existing delegation approval and recovery.
   Workflow revisions require tests, review, version and adoption, never self-edit.
6. **Read-only cadence:** opt-in opening/periodic briefs with deduplication,
   persisted last-check state, missed-run behavior and notification policy. Existing
   polling is not sold as a scheduler. Scheduling grants no write authority.
7. **External sources:** Rust-owned credential adapters → read evidence →
   reconciliation → proposal → separately authorized action. No browser credentials.

Skills remain reusable instructions. Graphs own known ordering/dependencies and
guards. Loops own bounded discovery within a node. The current loop is deterministic;
model-selected actions, routers and parallel agent execution remain deferred until
a concrete workflow needs them. Do not introduce every future node kind now.

## Acceptance and verification

Acceptance: persisted reports and source evidence survive reopen; source and
checkpoint changes invalidate verification; incomplete collection cannot be an
all-clear; duplicate delivery cannot duplicate a run; restart retains artifacts;
source instructions cannot become executable graph edges or approvals; source
notes remain unchanged; UI distinguishes proposal, snapshot and current health.

Rust module tests cover these boundaries using disposable SQLite databases and
temporary sources. One read-only integration test uses actual Pantheon evidence
with a disposable operational DB. The browser fixture uses the real inspector
with simulated service responses and separate fixture localStorage. These are
different evidence levels from native Tauri end-to-end acceptance.

Final command counts and manual limits are recorded in `NEXT-SESSION.md`.
