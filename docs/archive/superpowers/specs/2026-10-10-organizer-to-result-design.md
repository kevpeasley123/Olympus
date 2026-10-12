# Organizer-to-result workflow — proposed design

Date: 2026-10-10 (America/Phoenix). Status: proposed for review; planning requested, implementation not authorized by this document.

## Outcome

Kevin can select a project, record an objective and acceptance criteria, edit an ordered plan, delegate supported work through the existing approval flow, return after an interruption, inspect evidence, and explicitly complete the task. Olympus retains what happened and shows the next operator-selected task. This implements a first slice of the personal-agent-platform vision while preserving Command's visual composition and existing permission boundaries.

Success scenario: create a small repository-documentation task, link the archived Lee Robinson lecture as context, approve the existing planning stage, inspect and approve the implementation stage, interrupt/reopen Olympus, resume through the existing gate if required, inspect the result and checks, accept the result, then see the next planned task. A coding-capable executor is reused because it exists; this is not a revival of a mandatory coding-pilot prerequisite or a restriction on the broader Organizer vision.

## Baseline inspected

Repository: `C:/Users/kevpe/OneDrive/Desktop/Projects/Olympus`, HEAD `2d9132d`, package 0.25.0. Existing unrelated changes: AgentsConstellation.tsx, OlympusArmory.tsx, ZeusLightning.tsx, zeusLightning.css and scripts/zeus-lightning-review.mjs. Recheck before execution; do not overwrite or stage them.

- `src-tauri/src/commands/tasks.rs` scans Markdown checkboxes; identity is tied to source location. `useActionQueue.ts` is a polling reader.
- `src/services/projectCommandBoard.ts` is a deterministic, read-only project projection with explicit operator checkpoints and recommendations.
- `delegation.rs` has proposal preparation, approval-bound starts/resumes, run IDs, checkpoints, cancellation, and interrupted-run recovery. Existing open-run checks already prevent a second open run per project.
- `delegation_review.rs` validates criterion evidence against a workspace fingerprint; successful agent execution alone does not equal accepted work.
- SQLite has operational state and a legacy `tasks` table. Add distinct Organizer tables rather than repurposing historical rows with different semantics.
- Indexed memory supplies bounded, revision-checked source evidence. The application currently has one persisted assistant conversation; full conversation/thread migration is outside this first slice.

## Approaches considered

1. Editable Markdown checkboxes alone: smallest surface change, but source-line identities are unsuitable for stable run/result links and concurrent editing. Keep as reference input.
2. **Recommended: SQLite Organizer connected to existing delegation and review.** Add stable identity and orchestration links, reuse executor and approval machinery, and publish curated vault notes only through the established explicit write flow.
3. General workflow engine plus remote workers: better long-term breadth, but introduces infrastructure, scheduling and credentials before the task-to-result experience is proven. Defer.

## Scope and product behavior

- Organizer lives inside Open Project, above the existing delegation detail. Command retains its current composition; Project board receives a small next-task/checkpoint projection.
- User-created tasks start committed. Imported suggestions start proposed until Kevin adopts them. Adoption records intent but never grants launch authority.
- Tasks support title, objective, acceptance criteria, priority rationale, manual order, optional user-specified due date, source links, and an ordered checklist. Checklist items have stable IDs and explicit manual completion; no AI-inferred completion.
- The first version can organize any task but delegates only work the existing executor supports in a registered repository. Unsupported tasks remain editable and show why delegation is unavailable.
- No new model/provider call is needed to create or edit a task. Existing delegation calls retain existing approvals and limits. No new tool, provider, scheduler, cloud worker, email send, push, merge, release or installation is included.
- No automatic imports, source-checkbox edits, or bulk vault rewrites. An optional source reference records vault-relative path, source hash, line and captured text. Source drift shows as stale; it does not change the Organizer task.

## Data and authority

Use additive tables in `src-tauri/schema.sql`, with foreign keys enabled:

- `organizer_tasks`: UUID id, project_id, revision (starts at 1), title, objective, criteria_json, steps_json (UUID/text/done), priority (`high|normal|low`), priority_reason, position integer, due_date nullable, intent (`proposed|committed`), state (`open|completed|cancelled`), created_at, updated_at. Ordered by priority then position then id; manual move changes position only within a priority group.
- `organizer_sources`: UUID id, task_id, kind (`vault|url`), reference, captured_text nullable, sha256 nullable, line nullable. URLs must be HTTPS; vault paths must remain inside the configured vault after canonical resolution. Sources are reference data, never instructions or implicit permission to read other files.
- `organizer_run_links`: run_id primary key, task_id, task_revision, contract_snapshot_json, linked_at. Snapshot includes objective, criteria, steps and source references, not an unrestricted concatenation of source files.
- `organizer_proposal_links`: proposal_id primary key, task_id, task_revision, run_id, created_at. An internal binding record, not a second approval token.
- `organizer_results`: UUID id, run_id unique, task_id, summary, workspace_hash, manifest_json, review_state (`pending|accepted|superseded`), created_at, accepted_at nullable. Manifest records existing run workspace/base/changed files and referenced source identities, not arbitrary shell commands or executable links.
- `organizer_events`: monotonic sequence, task_id, kind, payload_json, created_at, acknowledgement_at nullable, dedupe_key unique nullable. Routine events remain in history; only waiting-for-user, failed, result-ready and completed events are attention-worthy.

All new mutations use `expectedRevision` and SQLite transactions. A mismatch returns a structured conflict and the latest task; preserve unsaved form input. Suggested validation limits: title 1–160 Unicode scalars; objective 1–8,000; 1–12 criteria each 1–1,000; 0–30 checklist items each 1–500; 0–20 source references; priority reason at most 2,000. Validate project identity in the backend. An optional due date is a real YYYY-MM-DD calendar date; never infer it.

Changes to execution-bearing fields are refused while a linked run is open (including waiting/review). Preserve the attempted edit as a client draft and offer the existing cancel path. After cancellation is confirmed, save the change and prepare a new proposal. A failed/cancelled attempt remains history. This deliberately avoids pretending the current executor supports live steering. Priority/order/due-date edits may also wait until the run closes in v1, keeping one revision contract simple.

## State and launch boundaries

Persist user intent separately from execution. Derive display status from the linked run: open with no run = Planned (or Proposed); preparing/planning/editing/testing/reviewing = In progress; waiting = Needs you; awaiting_review or completed run without task acceptance = Result ready; failed = Failed; cancelled run on an open task = Planned with cancelled-attempt history. A cancelled task reads Cancelled. Completed requires an accepted result or a separately labelled manual completion with a reason.

Preparation constructs the existing delegation request from the stored task snapshot and stores the proposal binding. Start revalidates task revision, commitment, project identity and existing approval under the same execution lock. The approval-consumption/run-insertion seam must persist the task/run link transactionally before any filesystem or process preparation. Repeated start requests never launch twice; an already-consumed proposal returns the recorded run if its Organizer binding matches, otherwise an explicit consumed error. A consumed approval without a run is an interruption requiring a fresh proposal, not an automatic retry.

Resume follows existing proposal preparation and validation; it must check the linked task revision and contract snapshot. Cancel continues to use the existing backend cancellation control. The Organizer never stores approval in task intent, source content, or a browser flag.

## Results, recovery and completion

Result reconciliation uses recorded run output, not a model's claim that it finished. Upsert one result per run, hashing the reviewed workspace with the existing review fingerprint helper. Changed workspace evidence invalidates acceptance eligibility. Opening a result uses existing guarded diff/review UI, not an arbitrary path opener.

After the existing backend review succeeds, `accept_organizer_result` validates run phase, task revision, current fingerprint and completed review, then atomically marks result accepted, task completed and records one completion event. Failure between run review and task acceptance leaves Result ready so the user can safely retry acceptance. Accepted results retain their historical fingerprint; later workspace changes are labelled drift, never silently rewritten history.

On app reopen, use existing delegation recovery first, then reconcile Organizer run/result links. Polling must not create repeated events. Unknown external-process state stays unknown/waiting; never start a replacement based on a stale frontend timer. Detached-process protections remain in force. Recovery preserves work; v1 does not promise continued execution while the computer is off.

Project state reflects recorded Organizer progress without overwriting Git/vault claims. Operator checkpoints outrank next-task suggestions. Completing one task does not archive its project. The next selected committed task is displayed but never auto-launched. Proposed tasks remain clearly labelled suggestions.

## Acceptance and risks

1. Stable task identity survives title edits, priority changes, source movement and app restart.
2. Two editors cannot silently overwrite each other; unknown projects and stale proposals cannot launch.
3. Duplicate start/resume/accept requests do not create duplicate runs or completion events.
4. Crash before launch, after approval consumption, during process work, during review and after review-before-task-completion all preserve an explainable state.
5. Missing/deleted source and changed workspace cannot masquerade as current evidence. Source text cannot promote itself into a commitment or approval.
6. A completed run awaits explicit task acceptance; a manually finished nondelegated task is labelled accordingly.
7. A native Windows acceptance run proves SQLite persistence, Tauri IPC, real approval UI, executor behavior, recovery and result inspection. Synthetic browser fixtures alone do not establish this.

Existing application-state backup coverage does not automatically include Organizer rows. Before migration acceptance, back up and restore an isolated database containing the new tables; do not claim the vault-only backup covers them. No automatic production database restore/downgrade is planned. New tables are additive, so older code can ignore them, but use a copied database for rollback testing.

## Source lessons and deferred work

Lecture: 15:30–18:07 recoverable work; 23:31–25:00 coordinator/helper results; 26:30–27:26 authority boundaries; 27:26–34:26 bounded memory. Reference `02 - Research/2026-10-10 How always-on agents work - Lee Robinson.md` in the vault.

Later separately scoped work: scoped conversations, inline steering of running tasks, recurring events and deduplication across connectors, remote workers, general research executor support, automated artifact archival and memory promotion, cache optimization. This plan proposes prioritizing a connected Organizer slice; it does not silently replace the separately recorded Monid expansion direction.
