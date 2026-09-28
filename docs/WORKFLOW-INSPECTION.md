# Communication Intelligence inspection — Phase 1 and Phase 2

Implemented September 23, 2026 (Phoenix). Source changes in Olympus Memory
Worktree, based on release 0.18.0 / `cb25daf`. Not packaged or installed.

The approved first slice makes the existing fixed workflow inspectable through
**Communications → Thread analysis history → Inspect analysis**. **About this
workflow** opens the compiled definition without requiring a new analysis.
Graph Detail links to the actual saved `communication-assess` and
`project-relevance` contracts; Skill Detail returns to its originating graph or
run. Existing source review remains in the brief. No permanent navigation was
added.

## Essential trace corrections pulled into Phase 1

The v3 trace could not establish exclusive project-node duration: project
preparation started before assessment, and project completion followed it.
Its declared sibling dependencies also did not describe concurrent execution.
The new **communication-intelligence/v4** definition and boundaries describe
the actual sequential runner:

`snapshot → select/preparation → assess → project finalization → synthesize`

Catalog reads and context validation belong to select/preparation. Deterministic
project suggestions supplied inside each assessment pass are bound to
`project-relevance@2` as an assessment context skill. Final project validation
and matching start after assessment completes. The model prompt, selection
limits, matching policy, assessment skill version and expansion budget are
unchanged by this slice. The implementation filename remains `intelligence_v3.rs`
because it retains that assessment policy.

New runs save the compiled workflow descriptor, original node/skill contracts,
definition fingerprint, trace version and package build version. New node events
wrap their original output in `{traceVersion: 1, attempt: 1, elapsedMs, data}`.
`elapsedMs` is measured from the runner's monotonic clock; arrays remain arrays
inside `data`. The fixed runner currently executes one attempt per node. Manual
retry still creates a new run, not a second inferred attempt in the old run.

Request-start events now retain the requested model/effort/route record as well
as request ID, pass number, thread count, source references and excerpt
fingerprints. Existing request-result records provide actual model, status,
latency, error and usage when returned. A pass is a batch request. Each thread's
iteration record describes its assessment and expansion decision; it is not a
transport retry or another model invocation.

## What the UI can establish

| Display | Evidence and limits |
|---|---|
| Workflow structure and skill bindings | Compiled descriptor for About; exact saved definition/contracts for a run. Lines express dependencies, not inferred concurrency. |
| Event order | Original SQLite sequence, returned explicitly and ordered. Wall-clock display does not determine ordering. |
| Node lifecycle | Last loaded running/completed/failed/stopped event. Pass, iteration and catalog events cannot promote node state. Missing records remain unknown. |
| Node duration | Only a fully loaded trace with one start, one terminal boundary, matching explicit positive attempt and nondecreasing monotonic elapsed values. Otherwise unavailable. This is elapsed time, not CPU time. |
| Model provenance | Latest recorded receipt per request ID. Requested and actual models are separate; absent actual model stays unconfirmed. No per-thread token allocation or exclusive skill cost. |
| Loop behavior | Pass/thread/stop-reason events and source references. No guessed retries or invocation totals. |
| Run completion | Saved analysis result, never operator approval or completion of an external obligation. |
| Interruption | Existing restart recovery result. Its timestamp is detection time, not a measured execution-end boundary. |
| Supporting evidence | Recorded source IDs/fingerprints, project source metadata, assessment impact, stop reasons and original event output. No claim of immutable source retention or exact replay. |
| Feedback | Number of feedback events in loaded history, with original records. Repeated events are not unique ratings; opening a source is not usefulness. No score. |

The inspector uses 100-event pages with an explicit sequence watermark. Loading
more retains the first page's run snapshot and watermark; explicit **Refresh
saved evidence** starts a new read. Partial coverage is visible, and node duration
is withheld until all pages through that watermark are loaded. This replaces
the old UI's silent 200-event cap without changing the legacy endpoint.

Historical v1–v3 payloads and events are returned verbatim. They are never updated
or enriched with current contracts, new dependencies, timing or attempts. Exact
ID/version resolution requires one saved contract; missing or ambiguous contracts
are shown as unavailable. v3's overlapping project span is explicitly qualified.
Package build version and definition fingerprint do not establish a source commit,
tamper protection or reproducible execution.

## Authority and isolation

Two read commands were added: `communication_workflow` and
`inspect_communication_run`. Run reads validate the currently enabled account and
ownership on every page. The inspector neither invokes analysis nor writes
feedback, mail, projects or memory. It accepts a run ID and numeric cursors, not
arbitrary model names, file paths or executor instructions. Existing schema and
storage tables are reused; there is no migration or generalized tracing service.

Account changes remount the brief, failed history reads clear stale detail, and
inspection responses use generation guards. Refresh hides account-owned evidence
until the next authorized read succeeds. Closing returns focus to the entry;
view changes focus their heading. Diagram buttons support keyboard activation,
legacy branches scroll within the map, and narrow layouts stack the inspector.
There is no continuous inspection animation; reduced-motion CSS disables motion.

## Verification reached

- Production TypeScript/Vite build passed, output outside OneDrive in the local
  temporary directory. Existing dependency warnings concern `gray-matter` eval,
  the browser-externalized `buffer` module and bundle size.
- Full offline Rust suite: **320 passed, 0 failed, 2 paid tests ignored**.
  New coverage checks closed definitions, account ownership/disconnect,
  unchanged saved JSON values, read-only behavior, 205-event pagination
  with a stable watermark, exact five-node lifecycle order, monotonic timestamps,
  request/pass/thread linkage and failure boundaries. Synthetic inference was used.
- Pure frontend projection checks: **12 passed**, covering missing and ambiguous
  contracts, legacy unknowns, partial/mismatched/repeated timing boundaries,
  interruption, receipt deduplication and branch bounds.
- Workflow browser harness: **23 passed** at both 390 × 844 and 1440 × 1000;
  desktop and narrow layouts were visually inspected. Enter-key graph-to-skill navigation and focus return
  were verified. Cases include completed, failed, interrupted, running, empty,
  historical, missing contract, paged, account denial and late response.
- Existing Communications browser suite: **58 passed** at 1440 × 1000, including
  analysis entry, source review, disconnected state and persistent chat geometry.
- Read-only projection checks against all **four real saved CI runs** passed:
  one v3 (20 events, one linked request), three v2 (11 events each). All have
  five saved nodes and two exact saved contracts. Historical node timing remains
  unavailable. The database was opened read-only; zero changes were made and no
  private source content was exported.

Native installation and a fresh paid v4 run were not exercised. The installed
0.18.0 application is unchanged. Existing GPT-6 model-routing/error-reporting
edits remain separate in the worktree; their previous paid acceptance was blocked
by exhausted API credits. No paid calls were retried for inspection work.

Reproduce with:

```powershell
cargo test --lib --manifest-path src-tauri/Cargo.toml -- --test-threads=1
node scripts/test-workflow-inspection.mjs
# Explicit optional read-only installed-history check (prints metadata only):
node scripts/test-workflow-inspection.mjs --local-history
npm.cmd run build -- --outDir "$env:TEMP\olympus-inspection-dist"
npm.cmd run dev -- --port 31427
# Browser: /workflow-inspection-harness.html?check
# Browser regression: /communications-harness.html?run
```

## Stop point

Phase 1 and Phase 2 are implemented and verified at the levels above. Only
essential Phase 3 instrumentation was pulled forward. The approved Home semantic
navigation pilot remains the next independent slice; no Home map changes were
made in this implementation. Broader phases wait for this report, as requested.
The original authority boundaries, roadmap and defer list remain in force:
no authoring/DSL, dynamic executor, runtime plugins, marketplace, agent framework,
capability map, new top-level section, autonomous rewriting or opaque scores.

See [the approved planning report](SKILLS-GRAPHS-INSPECTION-PLAN.md) for the
unchanged longer-term design.
