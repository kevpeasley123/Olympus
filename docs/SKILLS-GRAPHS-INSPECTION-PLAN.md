# Olympus — Skills, Graphs, Run Inspection, and Semantic Zoom

Planning report · September 23, 2026 · **Approved for the first slice and Home pilot**

Implementation update: the operator approved both decisions below, requested
essential instrumentation before runtime UI claims, and asked for a report after
Phase 1–2 before broadening. Those phases are now implemented in source; see
[WORKFLOW-INSPECTION.md](WORKFLOW-INSPECTION.md) for verification and limits.
New traces use CI v4. Home remains the next independent slice. The following
planning analysis describes the pre-implementation baseline and preserves the
approved roadmap and defer list.

Source: Olympus Memory Worktree, release 0.18.0 / `cb25daf`, plus the existing uncommitted GPT-6 migration. That migration changes PRIMARY to GPT-6 Sol and improves provider-error reporting; it has not been installed and live acceptance is blocked by exhausted API credits. This report introduces no runtime, schema, model, navigation, or vault changes.

Evidence level: repository/document/schema inspection and read-only inspection of the actual vault indexes. The Obsidian CLI was unavailable on PATH, so the two known index files were read directly. No production run counts, operator ratings, private mailbox contents, live map behavior, or fresh test results are claimed here. Earlier verification receipts are historical evidence. The current release checkpoint outranks stale “installed 0.16.0” notes in feature documents. See [NEXT-SESSION][next], [manual][manual], [architecture][architecture], [agent adapter][agents], [implementation constraints][claude], and [handoff][handoff].

## EXECUTIVE SUMMARY

**Make the existing runtime inspectable before generalizing its execution.** Olympus already has compiled skill contracts, fixed workflow definitions, versioned run snapshots, node events, bounded context expansion, model receipts, and operator feedback. It does not need a new orchestration platform to expose these.

Recommended first slice: expand **Communications → Thread analysis history → Inspect analysis** into a read-only workflow/run inspector for Communication Intelligence v3. Link its two real skills: `communication-assess@2` and `project-relevance@2`. Provide a small structural diagram, a chronological execution record, and a selected-node inspector. Definitions remain code-owned; existing SQLite records remain the source of execution truth.

Recommended semantic-navigation pilot: **Home → workstream → contextual actor → document/evidence**, using existing dossier components. Add predictable parent/return behavior and preserve scope. Keep camera zoom controls separate. Do not create a universal hierarchy database or force every evidence reference into a tree.

Three prerequisites matter more than new graphics:

1. Bind every historical view to its saved definitions and contracts, never today's registry.
2. Describe what recorded events actually establish. Logical branches, overlapping node lifetimes, model calls, thread assessments, and retries are different things.
3. Preserve source and authority boundaries. A completed analysis is not a completed obligation; a catalog entry is not permission to execute.

## CURRENT STATE

“Implemented” below means present in source, not newly demonstrated in the installed application. “Partial” identifies a real implementation with a specific missing contract or surface.

| Area | Classification | Actual implementation and limits |
|---|---|---|
| Runtime Skills | Implemented | Shared `SkillContract` includes ID/version, purpose, schemas, allowed capabilities, prohibited effects, evidence, loop budget, success criteria, implementation. Active Communications registry has exactly two contracts. No arbitrary skill executor. [Types][workflow], [registry][skills] |
| Skill Index | Implemented as documentation | Actual vault note catalogs Codex skills, integration conventions, templates and linked workflows. Its opening claim that Olympus can “call on” them is broader than runtime registration. It is not a compiled registry. [Index][skill-index] |
| Agents | Partial | A real Claude Code delegation driver, run/session/process identity and bounded stages exist. There is no general collection of autonomous agent objects, nor an agent per skill. [Driver][delegation], [contract][delegation-doc] |
| Agent Index | Conceptual catalog | Actual note has `status: draft`, candidate personas and Codex roles. These are not proof of registered launchable drivers. [Index][agent-index] |
| `skill_recipes` | Partial/schema only | Table exists; source search found no runtime reader/writer or frontend contract using it. Do not repurpose it as execution authority based on its name. [Schema][schema] |
| Workflow definitions | Implemented, fragmented | Shared `GraphNode` supports ID, kind, dependencies, max iterations. Communication Intelligence v3 and Knowledge Audit use it. Situations saves a different inline shape (`after`, `effect`, `contract`). No common versioned workflow descriptor. [Types][workflow], [CI runner][ci3], [audit][audit], [Situation engine][situation-engine] |
| Graph versioning | Partial | Versioned graph strings (`communication-intelligence/v3`, `knowledge-audit/v1`, `communication-situations/v1`) and saved definitions exist. No enforced immutable definition identity, contract hash or active/historical lookup policy. |
| Graph runs | Implemented | `communication_runs` stores both thread analysis and Situation runs; `knowledge_audit_runs` stores audits. Payloads hold identity, status and graph snapshots. History access is bounded and scoped. [Schema][schema], [CI API][ci-api], [audit][audit] |
| Node runs | Partial | Durable ordered events, not separate node-run rows. CI emits node starts/completions/failures and pass events. Knowledge Audit emits evidence and verification events. Situation events use prose phase names, usually marked `completed`, rather than stable definition node IDs. |
| Loops | Implemented, distinct | CI v3 conditionally expands cached evidence for up to three model passes; Project Relevance v2 is a deterministic matcher with no discovery loop. Knowledge Audit has bounded deterministic retrieval. Situation discovery includes a conditional repair request. [CI][ci3], [assessment][assessment], [matcher][relevance], [Situation engine][situation-engine] |
| Run evidence | Implemented with gaps | Source IDs/fingerprints, assessments, project catalog snapshots, request receipts, outputs and errors exist. CI does not preserve immutable copies of every model input excerpt after cache replacement/deletion. No general artifact registry. |
| Evaluation/feedback | Partial | `communication_evaluations` records run/thread-scoped events; feedback is also exposed through run events. Useful/incorrect/missed-needs-me and narrower corrections exist. No skill-attributed evaluation history, deduplicated score denominator, acceptance count or global quality metric. [API][ci-api], [UI][brief] |
| Approval checkpoints | Implemented for delegation | Backend proposals, exact scope, session/expiry, immutable approvals, one-time consumption and revocation. No approval node in Communication Intelligence. [Approval design][approval-doc], [schema][schema] |
| Verification checkpoints | Implemented, domain-specific | Delegation checks/review bind workspace fingerprints and criteria; successful agent exit is `awaiting_review`. Knowledge Audit verifies source/checkpoint fingerprints. CI validates schema, source joins and freshness. These are different verification claims. [Review][review], [audit][audit], [CI][ci3] |
| Model diagnostics | Implemented | Requested/actual model, route, effort, status, usage, total/first-token latency, failures; no prompts. CI pass events link request IDs. Model selection can change without a skill ID change, so comparisons must include configuration. [Models][models], [routing][routing] |
| Visual run inspection | Partial | CI has per-node disclosures and JSON receipts/contracts; audit has its own inspector; delegation has progress/check/review UI. No unified structural-plus-temporal graph-run surface. [CI UI][brief], [audit UI][audit-ui], [delegation UI][delegation-ui] |
| Situation hierarchy | Implemented | Situation → workstream → contextual actor, with workstream/actor dossiers and documents/related/timeline details. Local document foundation is separate from generated email interpretation. [Map][document-map], [dossiers][dossier-tabs], [Situations][situations] |
| Camera zoom | Implemented | Five scales: 1, 1.2, 1.5, 1.9, 2.4; focus-scoped keyboard controls, pan, bounds-derived fit and reset. Reset does not change semantic selection. [Layout][situation-graph], [renderer][relationship-web] |
| Semantic drill-down | Partial | Workstream focus, actor selection and parent controls already exist. State is local component state; no shared navigation contract, complete return stack or scope-specific camera restoration. Evidence is often a tab/disclosure or external file, not a new map. |
| Contextual actors | Implemented projection | Cited person/organization relationships produce role-scoped visual actors while preserving canonical IDs. Ambiguous affiliations remain separate. This is presentation, not global identity resolution. [Projection][actors-projection] |

## GAPS

1. **Readable definitions:** schemas and metadata are available, but there is no useful Skill Detail or Graph Detail independent of raw run JSON.
2. **Historical binding:** CI snapshots are a strong foundation, but no typed invariant proves each node's skill reference matches the saved contract. The legacy v2 builder calls the current registry; new executions of that helper could pair its `communication-assess@1` node with today's `@2` contract. Existing saved rows must not be assumed wrong or rewritten. [Legacy builder][ci-api]
3. **Actual execution semantics:** v3 starts `project`, prepares its catalog, then assesses using project suggestions, and later finalizes relevance. Its declared sibling branches are not independent computations. Start-to-end project time includes assessment time; it is not matcher CPU time. [Runner][ci3]
4. **Stable event identity:** SQLite sequence exists, but the CI API omits it and silently caps results at 200. History caps at ten runs. Reliable timelines and aggregate statistics need explicit cursors/coverage, not client-side guessing. [API][ci-api]
5. **Running-state fidelity:** v3 builds much of its payload in memory and saves it at the end. Pass events/request records are more current than `run.loop` or `run.usage` during execution. The UI must not present stale payload counters as live truth.
6. **Invocation accounting:** one assessment pass can contain several threads; deterministic project matching occurs within assessment preparation and again at finalization. Current records do not provide a clean “skill called N times” counter.
7. **Evaluation attribution:** feedback targets a recommendation thread in a run, not an unambiguous skill invocation. Repeated clicks create repeated events. Opened is engagement, not quality. Missing feedback is unknown.
8. **Navigation continuity:** entering a workstream remounts the map and resets framing; actor Back clears selection. There is no consistent distinction between hierarchical parent and return-to-origin across cross-links.
9. **Catalog trust:** vault indexes enter `STABLE_NOTES` alongside profile/charter; the loader describes this as authoritative context. Runtime authority still lives in Rust, but capability claims and candidate agent roles can mislead the assistant. [Loader][vault-context]

## ARCHITECTURE CRITIQUE

The premise is sound when “first-class” means **stable identity, truthful contracts, inspectable history, and useful links**. It does not imply a new SQL table, universal executor or editable runtime object for every noun.

**Keep Skills and Workflows distinct.** Communication Assessment earns its status through a validated model contract, independent tests and an authority boundary. Project Relevance earns it through a provider-independent `EvidenceArtifact` input, independent tests and deterministic behavior. Reuse across many production workflows is not a prerequisite; a meaningful boundary is enough. Snapshotting, sorting, grouping and rendering remain ordinary code unless a distinct recovery/evaluation need emerges.

**Do not adopt the prompt's example graph literally.** Today's CI graph has five nodes, no independent Group step, and a combined validated join/policy in Synthesize. Communication Intelligence v3 uses Assessment **v2**, not v3. Splitting it into nine nodes would reverse an earlier, evidence-based simplification. [Adopted critique][ci-critique]

**“Graph” has two meanings here.** `workflow::GraphNode` is execution structure; `situationGraph.ts::GraphNode` is a visual relationship/layout object. They must not share a runtime domain type. Use names such as `WorkflowNode` and `MapNode` at any new public boundary; do not rename unrelated code just for consistency.

**Declare the diagram's meaning.** For historical CI v3 show “declared workflow” beside “recorded execution.” Annotate that Project supplies context during assessment and finishes afterward. Do not animate sibling branches as concurrent workers or infer a critical path. Knowledge Audit genuinely uses worker threads; that is a better later test of parallel-run rendering.

For new instrumented CI runs, recommend a truthful five-step descriptor: Snapshot → Select/prepared context → Assess → Finalize project relevance → Synthesize. Project catalog preparation and assessment-time literal suggestions remain ordinary internal operations; they need no extra skills or nodes. Rebinding event boundaries and changing the saved graph description should ship under a new graph version (recommended v4), even if recommendation policy is unchanged. Historical v3 remains supported as recorded. This is a focused trace/definition correction, not a scheduler rewrite.

**Do not make deployment claims from catalog status.** “Active” means selected by a compiled route in this build; “live verified” needs separate evidence. Source tests, synthetic runs and real operator evaluations are different evidence classes. The existing API-credit block is a concrete example.

**Avoid treating semantic zoom as a mandatory four-level tree.** Documents can support multiple actors; a skill can be used by multiple graphs. Provide a stable parent within a browsing context and an explicit return path for cross-links. A dossier tab may be the right deeper view; another graph is not required.

## SKILL MODEL

Extend the existing `SkillContract`; do not create separate `SkillDefinition` and `SkillVersion` persistence entities yet. The immutable identity is `(id, version)`. Call the inspectable result a **versioned skill contract**.

| Keep/add | Recommendation |
|---|---|
| ID/version, purpose | Keep. Add a short display name, or provide a compiled label map initially. Never use the label as identity. |
| Input/output contract | Keep schemas and typed validators. Document actual scope: supplied thread, supplied project catalog, or model batch envelope. |
| Capabilities/prohibitions/evidence/success | Keep current fields. Explain which restrictions are enforced by handler/source construction and which are prompt guidance. |
| Implementation | Replace vague display text only when useful with a closed execution kind: deterministic or model-assisted; keep implementation reference for developers. No executable path supplied by clients. |
| Model route | Optional symbolic capability such as PRIMARY; actual model and effort belong to each request receipt. No model ID copied into UI components. |
| Loop budget | Clarify ownership. The runner owns the three-pass batch budget; a thread assessment can request expansion but cannot retrieve arbitrarily. Zero means no discovery loop for Project Relevance. |
| Lifecycle | Compiled active/deprecated metadata; experimental/live-verified labels must cite explicit evidence, not successful compilation. Historical contracts may have unknown lifecycle. |
| Used by / recent activity / evaluation | Derived from graph bindings and run/feedback queries. Do not store duplicate counters in contracts. |

The current assessment registry advertises a single `ThreadInput` and per-thread result while the runner invokes a batch with expansion flags and project suggestions. Preserve the useful per-thread skill contract but document the runner-owned batch envelope and pass budget separately. Do not pretend the registry's input schema alone describes the complete API request. [Registry][skills], [assessment validation][assessment], [runner][ci3]

Minimal registry: a compiled, closed lookup returning the two current contracts and explicit references from workflow descriptors. Static handlers remain called by existing runners. A metadata registry does not need handler closures, dynamic dispatch, installable packages or a public `execute_skill` command.

Future Evidence Summarization or Source Reconciliation fits only if it establishes a comparable contract/test/authority boundary. It is not registered by this proposal.

## GRAPH MODEL

Add one typed **WorkflowDescriptor** around the existing node structure. It holds a parsed graph identity/version, name, purpose, node definitions, completion meaning, bounded failure/recovery description, authority summary, and referenced skill keys. Derive edges from dependencies; do not persist a duplicate edge list unless richer edge semantics become necessary.

A node identifies its role and optional exact skill key. Deterministic selection, validation, routing and approval checkpoints are legitimate node kinds without being Skills or Agents. No generic schema interpreter executes the descriptor.

Definitions and active version mapping are compiled Rust. The catalog validates unique node IDs, dependency references, acyclicity outside explicitly bounded node internals, exact skill bindings, and declared completion semantics. Existing runner functions remain execution owners. Checkpoint metadata may reference an existing authority mechanism; it never grants permission itself.

At run creation, save a self-contained descriptor plus exact referenced contracts. Historical lookup reads that snapshot, not a live catalog. A minimal read-only catalog can start with CI alone; Knowledge Audit and Situations must advertise their real compatibility rather than be coerced into complete support.

Use **Workflow** in operator-facing labels and **Graph** in technical details. This avoids making a Situation relationship map sound executable. A possible future System surface can consume the same descriptor API.

## RUN MODEL

Keep `communication_runs` / `communication_events` as authoritative storage for the first slice. Add a typed **inspection projection**, not a parallel runtime database.

| Proposed type | Why / owner / lifecycle / persistence |
|---|---|
| `WorkflowDescriptor` | Rust-owned immutable versioned definition; compiled current registry, copied into new run payloads. Reuses `GraphNode`; not a new SQL table. |
| Versioned `SkillContract` | Existing Rust type extended minimally; compiled active contracts, copied at run creation. Old snapshots are never upgraded in place. |
| `RunInspection` | Read-only Rust DTO with original run ID/type, saved descriptor, raw status, outcome/verification, timing, completeness and links. Derived from existing rows; not separately persisted. |
| `NodeExecution` | Projection keyed by run + stable node ID + attempt where recorded. Includes first/terminal events, request links, evidence references and honest timing. Derived, not a `node_runs` table. |
| `PassEvidence` | CI-specific projection of pass_started/model_result/iteration events. Identifies pass, batch/thread scope, request ID, expansion decision and stop reason. Persist through existing event payloads. No generic `LoopIteration` table. |
| Evaluation event | Existing communication evaluation row initially; optional versioned target details added later for new feedback. Immutable observation/correction, not an executable instruction. |
| `InspectionLocation` | Frontend discriminated navigation state with parent/return context. In-memory lifecycle, no SQLite hierarchy. |

New event envelopes should expose sequence, stable node ID, event kind, event schema version, optional attempt/pass/thread/request IDs, timestamp and bounded evidence data. Continue storing them in the existing JSON event payloads. Include build revision and definition/contract fingerprints in new run snapshots. Use hashes for drift detection; SQLite is not a tamper-proof audit ledger.

**Loops:** show one pass row per model request, with the number of threads assessed and per-thread expansion outcomes beneath it. Three passes is a run-level budget, not three calls per thread. Do not double-count a shared batch's tokens across its thread rows. An empty selection can legitimately complete with zero model passes.

**Timing:** total run duration is available; model request latency is available when recorded. A node's start/end span is elapsed lifetime, not exclusive compute time. Missing start/end means duration unavailable. Interleaved event order alone is not proof of parallel compute. Future instrumentation can record operation-level elapsed time without retroactively manufacturing it.

**Recovery and visible states:** retain raw domain state plus a small visual treatment; do not introduce a new authoritative state machine.

| Existing state/evidence | Display meaning |
|---|---|
| CI `running`, `completed`, `failed`, `interrupted` | Analysis lifecycle. Completed means its bounded analysis published, not that the operator's work is done. |
| Node `running`, `completed`, `failed`, `stopped` | Recorded node lifecycle. Stopped includes upstream failure; show the cause. |
| No event | “Not started” only when justified by a complete new trace; otherwise “No recorded event.” |
| `pass_started`, `model_result`, `iteration`, catalog snapshot | Events inside a node, not new terminal statuses. Do not pick the last arbitrary event as the node status. |
| Audit `snapshot_ready`, `incomplete` | Source-snapshot verification outcome; never relabel as task completion. |
| Delegation `waiting`, `awaiting_review`, `complete`, `cancelled`, `failed` | Preserve existing phase and checkpoint/review reason. “Blocked by approval” or “verification failed” is a reason/badge when evidence supports it. |

CI retry means a new explicit run, not node replay. Add an optional `retryOf` link for future requests if useful; do not infer links from similar timestamps. Situation repair calls are a different kind of retry and need their own recorded reason. Restart preserves partial evidence and marks interruption. New inspection endpoints never restart or resume work.

## EVALUATION MODEL

Use existing events before adding a generic evaluation framework. Show raw feedback with its run/thread/source context and exact version bindings. Derive associations conservatively:

- `project_dismissed` is relevant to a project suggestion but does not alone establish why the matcher was wrong.
- `incorrect` and `useful` currently rate the presented thread finding; they cannot be assigned entirely to Assessment when selection, matching and synthesis also contributed.
- `opened` measures source-review activity, not usefulness or acceptance.
- `missed_needs_me` applies to a thread already in the run. It does not measure missed messages outside the selected subset or mailbox recall.

Initial metrics: runs by graph version/status and time window; assessed threads; pass counts and stop-reason frequency; model calls and reported usage; known run/request latency; raw feedback-event counts and distinct rated run/thread pairs. Always show sample size, filters, unknowns and trace coverage. “No model call” differs from “usage unavailable.”

For a usefulness percentage, first define one effective usefulness judgment per `(run, thread, rating dimension)`—latest explicit judgment wins while earlier events remain visible. Keep independent project/deadline corrections separate. Report the denominator of rated items and unrated count. Do not ship an “87% useful” badge before this policy and sufficiently attributable data exist.

Later add optional evaluation target metadata: exact graph/skill key, node ID, pass if needed, subject reference, basis, and supersedes-event ID. Use an additive column/payload or narrowly scoped companion table after the second consumer is proven; never silently reinterpret legacy rows. Synthetic acceptance fixtures and operator judgments stay separate cohorts. Version comparisons also stratify by model/effort, selection policy and evidence scope; they are not controlled experiments by default.

Improvement remains: run → evidence → explicit feedback → reviewed evaluation → proposed code/contract revision → tests → operator review → versioned adoption. No model rewrites or adopts its own skill.

## SEMANTIC ZOOM

Treat semantic zoom as **focus navigation**, with ordinary labels: Explore, Back to [parent], Documents, Source details. Camera controls remain Zoom in/out and Reset view. Clicking plus never changes the workstream; Back never silently changes scale in an unrelated scope.

The Home pilot uses existing information:

```text
Home overview
  → selected workstream (map + workstream dossier)
    → contextual actor (same scope + actor dossier)
      → document/evidence detail (retain actor/workstream return context)
```

What already works: bounded orbital pages, stable source/entity references, contextual actors, workstream focus, actor parent button, dossier tabs, source locators and restricted native document opening. What needs formalization: parent/return state, invalid-target handling, focused-control restoration, scope-specific camera/page retention, and consistent names. [Map][document-map], [actor projection][actors-projection], [dossiers][dossier-tabs], [document boundary][documents-backend]

Use a small discriminated UI state (`overview`, `workstream`, `actor`, optional `evidence`) rather than independent strings that can describe impossible combinations. It should carry situation ID and selected workstream/actor/source IDs. Derive labels and parent relationships from current data, never cached display names. Keep dossier tab/page and camera state in separate view-state records keyed by scope. No generic domain `parent_id` column is needed.

**Parent versus return:** actor → its workstream is structural parent; a Skill opened from a Node Run should offer “Back to this run” while still exposing “Used by workflows.” Cross-links are not hierarchical ownership. Switching situations resets incompatible descendants; if data refresh removes a selected actor, return to the nearest valid parent with a brief explanation. Role-scoped actor IDs can change when cited role data changes; never guess a replacement by matching names.

**Stable mental map:** keep situation/workstream labels visible; maintain actor IDs across compatible projections; retain the selected workstream's overview slot cue. Do not promise identical coordinates when focusing changes the layout. First entry fits its scope; returning restores the prior framing/page where valid. An explicit Reset view fits only the current scope. Actor selection should not remount or rescale the map.

**Accessibility/motion:** keyboard-operable node buttons, focus restored to the originating control on Back, visible selection and text status independent of color, restrained optional transitions, immediate reduced-motion navigation. Decorative traveling lights are not execution evidence and should not be copied into run diagrams as fake activity.

Other maps adopt the convention with their own relationships: Project → subsystem → workflow → run; Research → topic → source → claim/evidence. Reuse a breadcrumb/back helper and location semantics, not the Situation SVG layout or a mandatory numbered depth system.

## UI PLAN

Start inside Communications' existing secondary Thread analysis history, not a new top-level System section. Keep the current Command / Projects / Research / Communications structure. The first view can use a dedicated in-surface inspection mode with an explicit return, avoiding an ever-growing stack of nested disclosures.

| Surface | Primary content | Secondary detail |
|---|---|---|
| Skill Detail | Name/version, purpose, compiled availability, execution kind, allowed sources/effects and prohibitions, used-by links | Schemas, evidence contract, loop ownership, version-scoped recent activity and attributable feedback; tests/live verification clearly distinguished |
| Graph Detail | Purpose/version, truthful five-node structure, skill links, trigger/selection bounds, completion meaning, failure/recovery behavior | Saved/current definition distinction, recent scoped runs, actual failure/usage summaries with coverage |
| Graph Run | Saved version, outcome/start/end, graph with recorded node states, selected-node detail | Chronological pass/event timeline, request receipts, feedback, evidence availability and retry ancestry if recorded |
| Node Run Inspector | Node role, exact contract link, recorded lifecycle, pass/attempt boundaries, inputs by source reference, outputs/artifacts, validation/failure reason | Requested/actual model, effort, known latency/usage, full bounded technical receipt; no prompts or hidden reasoning |

Suggested wide layout:

```text
Back to Thread analysis history          Workflow/version · Run time · Outcome
┌────────────────────────────────┬─────────────────────────────┐
│ Five-node workflow structure   │ Selected node / skill       │
│ statuses and evidence counts   │ result, authority, evidence │
├────────────────────────────────┤                             │
│ Recorded execution / passes    │ request and failure detail  │
└────────────────────────────────┴─────────────────────────────┘
```

The timeline is initially a compact ordered list with timestamps and pass boundaries, not a Gantt chart implying measured execution intervals. Select an event to focus its node, select a node to filter/highlight its events. Never lose the unfiltered chronological view. Add interval bars only where paired events support them.

Use existing dark surfaces, compact type, restrained borders and amber selection. Failed/interrupted states need text/icons, not color alone. Build the five-node layout directly with existing React/SVG/HTML patterns; a graph editor library or physics engine is unnecessary. On narrow windows stack the graph, selected details and timeline; preserve the existing chat exclusion geometry. Keep technical receipts collapsed but reachable.

First-class definitions should remain discoverable before any run exists. Provide “About this workflow” next to analysis history, using the compiled descriptor. Historical skill links open the contract saved with that run. If a historical contract is missing, label it unavailable and offer the current contract separately—not as a substitute.

Read-only inspection must not trigger Analyze, Gmail sync, model calls, source mutation or feedback. Existing explicit feedback controls remain distinct. Account disconnect/change must clear sensitive run/detail state; definitions can remain visible without revealing old account history.

## FIRST IMPLEMENTATION SLICE

**Recommend Communication Intelligence inspection, with historical v3 support and a small trace-contract correction for future runs.** It already has two real skills, bounded model passes, feedback and an existing entry point. Knowledge Audit is the second consumer for true parallel branches and verification; delegation is later because it introduces execution authority. Situation understanding is a poor first run-visualization pilot because its prose milestones are not reliable node traces.

Deliverables, in dependency order:

1. Typed read-only descriptor and run-inspection DTOs over existing CI rows. Expose saved sequence numbers, pagination/coverage, original versions and trace gaps. Provide descriptor-only access when there are no runs.
2. Validate skill bindings and freeze snapshots at start. Correct new CI trace/definition semantics under a new graph version; preserve old v1/v2/v3 rows and version-specific views. No selection/prompt/policy rewrite.
3. Five-node structural view, timestamped event/pass list and selected-node inspector. Two linked Skill Detail views and Graph Detail. All navigation reversible within the existing surface.
4. Show existing feedback evidence and bounded factual metrics. Defer new ratings and percentages until attribution/denominator policy is implemented.

Proposed file boundaries: extend [workflow types][workflow]; use a small compiled CI descriptor module and read-only inspection projection near [CI APIs][ci-api]; add typed frontend inspection DTOs beside [service][ci-service]; extract dedicated inspection components from [CommunicationsBrief][brief]. Reuse model receipt and evidence types rather than fork them. Do not expand the already dense brief component into a general framework.

Acceptance requires synthetic fixtures for success, zero candidates, multi-pass expansion, partial failure, restart interruption, missing source, unavailable usage, old definition versions, contract mismatch, repeated feedback and event pagination. Tests must prove old snapshots survive a changed current registry. Event pairing must not invent duration or concurrency; a partial trace must remain visibly partial. Account-crossing run IDs must fail. Inspecting must issue zero model/Gmail calls and must not append `opened` feedback.

Browser acceptance covers graph/list/node linking, Back, long receipts, keyboard focus, narrow/short layouts, reserved chat space and reduced motion. Native acceptance confirms the read-only APIs and actual stored history. Model quality evaluation is a separate gate for behavior changes; the inspection slice can be built and tested with fixtures while API credits are exhausted.

## DATA / STORAGE

| Owner | Owns | Must not own |
|---|---|---|
| Compiled Rust | Handlers, validators, workflow structure, version selection, authority checks, descriptor catalog | Editable user definitions that silently become executable |
| Existing SQLite run/event tables | Run snapshots, original status, node/pass evidence, request links, feedback and review records | Authoritative operator intent inferred from generated prose |
| `model_requests` | Actual request route/model/effort/usage/timing/failure metadata | Duplicated prompts or a new source-of-truth counter per UI card |
| React/TypeScript | Read-only projections, graph layout, semantic navigation and view state | Authorization, arbitrary native paths or execution routing |
| Obsidian | Human documentation, authored guidance, explicit links to runtime identities | Handler registration, executable Markdown or inferred approval |

No new generic run/node/loop tables are required for the first slice. Use additive versioned JSON fields and backend DTO validation. If later cross-domain queries justify a small index, make it a rebuildable projection over native records; do not dual-write two authoritative histories.

Separate definition snapshots from mutable operational status in code even when they share a JSON payload. Record fingerprint/build provenance for future runs. Preserve run/event/feedback records during migrations; test idempotent startup schema application on a disposable copy. Current run immutability is application behavior, unlike approval tables' explicit SQL triggers—do not overstate it.

Provide cursor-based bounded read endpoints or explicit `hasMore`/coverage. Do not calculate lifetime metrics from the latest ten displayed runs or first 200 events. Keep all joins account-scoped. Treat malformed legacy JSON as an inspectable unavailable record, not permission to fall back to current definitions.

Keep existing privacy posture: references/fingerprints and already retained bounded output, not new raw mailbox/prompt archives. A fingerprint proves identity comparison, not the continued availability or truth of content. Show “source changed,” “source unavailable,” and “recorded excerpt” distinctly. Exact replay would require a separately reviewed retention policy and is deferred. Storage growth/retention must be measured before adding another evidence store.

The Skill/Agent indexes remain documentation. Optional runtime references in notes may resolve to compiled objects, but an unknown key displays “not registered.” No index import installs or enables anything. In a separately tested small prompt-context correction, distinguish descriptive catalogs/candidate roles from profile/charter policy, and make compiled availability win for capability claims. Do not rewrite operator notes automatically. [Memory boundary][memory-doc], [loader][vault-context]

## VERSIONING

- Keep existing stable string IDs; parse graph version separately at the API boundary. Skill identity and graph identity version independently.
- Material contract/behavior/source-budget/effect changes require a new skill version. Composition, checkpoint, completion or meaningful trace-structure changes require a new graph version. Cosmetic labels/layout may use a presentation revision; they must not alter historical semantics.
- Future CI trace correction becomes v4; unchanged Assessment/Project Relevance remain @2 unless their contracts or behavior change. Graph version 4 does not imply skill version 4.
- Snapshot the exact descriptor and referenced contracts at run creation. Persist build revision, event-schema version and definition fingerprints for new records. Record actual route/model/effort through request receipts.
- Active/deprecated refers to current invocation availability. Historical inspection always remains available within existing account/privacy rules, without requiring old code to remain executable.
- A read-only version adapter may interpret a known legacy record shape; it cannot fill absent fields from current definitions. Preserve both original payload and derived explanation. Contract mismatch is an explicit historical-integrity warning, not auto-repair.
- Legacy Situation runs have skill-name strings rather than full contracts and mismatched phase/node names. Show those limits; do not reconstruct an authoritative original contract from current source.
- Model-route changes can preserve the procedure's skill version when its contract is unchanged, but evaluations must use the run's model/effort/build provenance. Missing provenance excludes a record from fine-grained comparisons.

## AUTHORITY

Skill Detail must explain both **what is supplied** and **who can fetch or act**. Communication Assessment reads supplied cached-thread evidence, uses the configured reasoning route and requests allowed expansion. The runner alone chooses/cache-checks that expansion. Project Relevance reads supplied artifacts/catalog data and performs literal matching; it has no model, network, shell or independent filesystem authority.

CI may read scoped cached mail/project metadata, call assessment, validate outputs and persist generated operational evidence. It may not send email, create tasks/commitments, modify projects, promote memory, register a skill or change policy. Persisting its own run is an effect; label it accurately instead of calling the whole workflow “no writes.”

Graph/Skill inspection grants no extra authority. Native endpoints accept closed IDs/version keys and validate account ownership, not arbitrary SQL, file paths, commands or model names. Document opening continues through the existing backend-owned source-ID resolution and permitted file types. Viewing workflow diagrams never invokes them.

Delegation approvals, consumption, verification and completion remain owned by their existing tables and Rust handlers. Future diagram nodes may reference those records, but cannot duplicate or bypass them. A passed schema/fingerprint check is not human approval, and a model answer is not verification of a real-world action. [Approval design][approval-doc], [delegation review][review]

## PHASED ROADMAP

| Phase | Work and dependency | Exit criterion |
|---|---|---|
| 0 — Review this plan | Confirm slice and placement; no runtime changes in this pass | Operator accepts/revises the proposed architecture |
| 1 — Definition and evidence contract | Extend existing types minimally; truthful CI descriptor; saved contract binding; raw sequence/coverage; legacy adapters | Fixture tests prove historical isolation, no fabricated data, account boundaries and no execution side effects |
| 2 — First vertical inspection slice | Graph Detail + two Skill Details + run/node/event views in current analysis history | One real saved run and synthetic edge cases can be understood without reading JSON; keyboard/narrow/reduced-motion checks pass |
| 3 — Temporal accuracy and new traces | Ship new trace version, pass/request links, honest duration/attempt coverage, interruption behavior; enrich only measured gaps | New runs show exact recorded order and loops; legacy limitations remain visible. Fold essential instrumentation into Phase 1 if needed for Phase 2 |
| 4 — Home focus-navigation pilot | Formalize location/back helpers, source return path and independent camera restoration using current map/dossiers | Overview/workstream/actor/evidence/back round-trip preserves context, handles removed data, and does not grant new effects |
| 5 — Evaluation and second consumer | Attributable feedback summaries, explicit denominators; adapt Knowledge Audit to the inspector | Parallel audit branches/verification fit without special-casing a scheduler or changing completion meaning |
| 6 — Broader cross-links if useful | Situation trace normalization, optional Project links and existing delegation evidence links | A demonstrated operator need justifies each addition; no automatic new System navigation |

Skill ↔ Graph ↔ Run links belong in Phase 2, not a late separate milestone. Evaluation links to original evidence also belong there; quantitative summaries follow later. Home navigation can proceed independently after review because it requires no runtime registry or database work. These are implementation dependencies, not a recommendation to delegate this planning pass.

## DEFER

- Drag-and-drop workflow authoring, graph DSL, dynamic executor, generic scheduler, model-controlled routing and per-node arbitrary retries.
- Skill marketplace, runtime plugin installation, executable Markdown, arbitrary handler/model/path selection.
- A universal Agent entity, persona registry, autonomous agent proliferation or one agent per node.
- New permanent Skills/Graphs/Analytics/System navigation; system-wide capability hairballs.
- New workflows or speculative future skills solely to demonstrate the abstraction.
- Replacing delegation approval/completion machinery or turning approval into a generic graph flag.
- Universal status enums, global semantic hierarchy tables, shared execution/map node models, forced reuse of orbital layout for workflows.
- Automatic skill rewriting, self-modifying graphs, auto-adoption based on feedback, opaque intelligence/health scores.
- Lifetime usefulness percentages without denominators; inferred acceptance, ignored feedback, mailbox recall, exclusive compute cost or per-thread token allocation.
- Exact replay, indefinite raw-input retention, immutable content archives, encryption redesign and automatic deletion policy in this slice.
- Live graph animation, fake concurrent workers, timing bars without measured boundaries, and camera zoom that changes abstraction level.

## RISKS

| Risk | Mitigation |
|---|---|
| Attractive diagram overstates execution | Distinguish declared structure from recorded trace; correct future CI descriptor; never infer concurrency from sibling edges. |
| Old runs silently acquire current semantics | Snapshot-bound resolution, version adapters, contract-hash checks, explicit unknowns and regression fixtures. |
| Metadata diverges from handlers | Typed compiled catalog and binding tests, plus independent contract validation. Metadata never grants authority. |
| Stable-context indexes overstate available agents/skills | Label documentation/candidates distinctly; prioritize compiled availability in capability claims; review prompt-context adjustment separately. |
| Metrics reward clicks or mix changed models/data | Distinct rating dimensions, deduplicated subjects, sample sizes and cohorts; retain raw events and unknown coverage. |
| Situation reuse creates fake node history | Preserve phase-only legacy view; normalize future events only before claiming node durations/statuses. |
| History leaks after account change | Backend account checks and frontend generation/reset guards for every detail/query result. |
| Run inspection triggers work | Read endpoints only; test no model/Gmail/write/feedback action on navigation. Audit current source-health checks separately when adopting that workflow. |
| Navigation obscures source ambiguity | Contextual IDs, cited relationships, explicit scope, nearest-valid-parent fallback; no name-based identity merge. |
| New inspector overwhelms Command/chat | Secondary Communications entry, compact graph, progressive detail, existing reserved chat geometry, responsive stacked fallback. |
| Evidence retention is mistaken for reproducibility | Show content availability and fingerprint basis; do not promise replay or stronger tamper protection than SQLite supplies. |
| Scope expands into platform work | Stop after CI vertical slice and Home navigation pilot; require a second consumer before shared execution/storage abstractions. |

## QUESTIONS / DECISIONS

Only two decisions are needed before implementation:

1. **Approve the first slice and location?** Recommended: Communication Intelligence inspection through existing Thread analysis history, with linked Skill/Graph Details and a corrected new-run trace version. No top-level System section.
2. **Approve the Home navigation pilot as the next independent slice?** Recommended: keep the current visual composition and add consistent parent/return/focus behavior, preserving camera zoom as a separate control.

No decision is needed now on a marketplace, graph editor, agent framework, global evaluation schema or raw-input archive. The recommended defaults deliberately leave those unbuilt. Exact input retention, editable workflows and any widened execution authority would require a later concrete proposal.

## SOURCE REFERENCES

Links below identify inspected source rather than implying installed-runtime verification. Documentation with historical sections was checked against current code. No production SQLite content was needed; the current checked-in schema and its read/write paths establish the storage inventory.

[manual]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/OLYMPUS-MANUAL.md>
[architecture]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/ARCHITECTURE.md>
[agents]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/AGENTS.md>
[claude]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/CLAUDE.md>
[handoff]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/docs/HANDOFF.md>
[next]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/docs/NEXT-SESSION.md>
[workflow]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src-tauri/src/commands/workflow.rs>
[schema]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src-tauri/schema.sql>
[skills]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src-tauri/src/commands/gmail/communication_skills.rs>
[ci3]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src-tauri/src/commands/gmail/intelligence_v3.rs>
[ci-api]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src-tauri/src/commands/gmail/intelligence.rs>
[assessment]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src-tauri/src/commands/gmail/assessment_v3.rs>
[relevance]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src-tauri/src/commands/project_relevance.rs>
[ci-critique]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/docs/COMMUNICATION-ARCHITECTURE-CRITIQUE.md>
[audit]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src-tauri/src/commands/knowledge_audit.rs>
[audit-ui]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src/components/panels/KnowledgeAudit.tsx>
[brief]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src/components/panels/CommunicationsBrief.tsx>
[ci-service]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src/services/communicationIntelligence.ts>
[models]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src-tauri/src/commands/models.rs>
[routing]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/docs/MODEL-ROUTING.md>
[situation-engine]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src-tauri/src/commands/gmail/situations/engine.rs>
[situations]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src-tauri/src/commands/gmail/situations.rs>
[document-map]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src/components/panels/DocumentSituationMap.tsx>
[dossier-tabs]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src/components/panels/DossierTabs.tsx>
[situation-graph]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src/services/situationGraph.ts>
[relationship-web]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src/components/panels/SituationRelationshipWeb.tsx>
[actors-projection]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src/services/contextualActors.ts>
[documents-backend]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src-tauri/src/commands/gmail/situations/documents.rs>
[delegation]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src-tauri/src/commands/delegation.rs>
[delegation-ui]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src/components/panels/DelegationPanel.tsx>
[review]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src-tauri/src/commands/delegation_review.rs>
[delegation-doc]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/docs/AGENT-DELEGATION.md>
[approval-doc]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/docs/OPERATOR-APPROVAL-DESIGN.md>
[memory-doc]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/docs/CURATED-MEMORY.md>
[vault-context]: <C:/Users/kevpe/OneDrive/Documents/New project/Olympus Memory Worktree/src-tauri/src/commands/vault_context.rs>
[skill-index]: <C:/Users/kevpe/OneDrive/Desktop/Projects/Obsidian vaults/Olympus Obsidian Vault/05 - Skills/Skill Index.md>
[agent-index]: <C:/Users/kevpe/OneDrive/Desktop/Projects/Obsidian vaults/Olympus Obsidian Vault/06 - Agents/Agent Index.md>
