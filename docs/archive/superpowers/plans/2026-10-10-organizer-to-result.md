# Organizer-to-result Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for inline execution, or superpowers:subagent-driven-development if Kevin selects delegation. Complete tasks in dependency order. Do not start implementation from this proposal without review.

**Goal:** Connect a stable, editable project task to the existing approved delegation, result review, and explicit completion workflow.

**Architecture:** SQLite owns Organizer identity and history. Existing delegation owns execution and permission checks. Project UI presents the joined state; vault evidence remains source material and is not rewritten automatically.

**Tech Stack:** Existing Rust/Tauri/rusqlite backend; React/TypeScript; existing browser harnesses. No new service or dependency.

**Spec:** `../specs/2026-10-10-organizer-to-result-design.md` (proposed alongside this plan).

## Global constraints

- Planning only has been requested. The design and plan are proposals, not implementation or spending approval.
- Preserve Command's composition, current execution scopes, approval expiration, review fingerprint checks and one-open-run-per-project rule.
- No new model/provider call for Organizer CRUD. No remote worker, scheduling, automatic launch, send, merge, push, install or deployment.
- Follow the exact validation values and state mappings in the spec; all mutation DTOs use camelCase at the Tauri boundary.
- Read current AGENTS/manual/architecture/CLAUDE and Git state before execution. Use isolated worktree at execution time. The baseline had unrelated UI work; do not copy or stage it accidentally.
- Run tests against isolated fixtures/database/vault. Preserve existing real user state.

## Review focus

1. Two windows edit the same task: preserve draft and return a conflict (Task 1/4).
2. Approval consumed immediately before a crash: record/recover honestly, never duplicate launch (Task 2/3).
3. A result file changes after review: reject stale acceptance (Task 3).
4. A source note moves or contains malicious instructions: retain captured identity, mark drift, never elevate source authority (Task 1/4).
5. Project polling replays the same run transition: show one attention event; project completion must not be inferred from one task (Task 3/5).

## File map

Create backend modules `src-tauri/src/commands/organizer.rs` (Tauri commands), `organizer_store.rs` (SQLite transactions/DTOs), `organizer_lifecycle.rs` (run/result reconciliation and projection). Register in `commands/mod.rs` and `src-tauri/src/lib.rs`; add tables in `src-tauri/schema.sql`.

Modify existing `commands/delegation.rs`, `commands/delegation_review.rs` and, only where needed to preserve atomic consumption, `commands/approvals.rs`. Keep legacy non-Organizer requests working.

Create `src/services/organizer.ts`, `src/hooks/useOrganizer.ts`, `src/components/panels/organizer/OrganizerPanel.tsx`, `TaskEditor.tsx`, `TaskDetail.tsx`, `organizer.css`, and `src/services/organizer.harness.ts`. Integrate through `ProjectsPanel.tsx`, `DelegationPanel.tsx`, `DelegationReview.tsx`, and `projectCommandBoard.ts`.

Add `scripts/test-organizer.mjs`, `src/organizer-harness.tsx`, native backend unit tests within the new modules, and `docs/ORGANIZER.md`. Extend `scripts/visual-review.mjs` with Organizer states.

## Task 1 — Stable tasks and transactional editing

**Files:** schema.sql, organizer_store.rs, organizer.rs, commands/mod.rs, lib.rs; tests in organizer_store.rs.

**Interfaces:** `OrganizerTask` fields match the spec. `OrganizerError { code, message, currentTask? }` uses `validation|conflict|not_found|busy|unavailable`. Expose `create_organizer_task({projectId,title,objective,criteria,steps,priority,priorityReason,dueDate,sources,intent}) -> Task`, `update_organizer_task({taskId,expectedRevision,patch}) -> Task`, `list_organizer_tasks({projectId}) -> Task[]`, `set_organizer_intent({taskId,expectedRevision,intent}) -> Task`, `move_organizer_task({taskId,expectedRevision,beforeTaskId|null}) -> Task[]`. New IDs/timestamps are backend-generated; patches cannot set project/id/status/revision.

- [ ] Add failing in-memory SQLite tests: schema applied twice retains rows; edit keeps ID and increments revision; stale revision leaves all bytes unchanged; a 161-scalar title and thirteenth criterion fail; unknown project, invalid date, path traversal and symlink escape fail; active-run edit is refused; moving across priority groups fails; move is transactionally ordered without lost concurrent changes. Treat unrelated stale source paths as source-health errors, not delete instructions.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml organizer_store -- --nocapture`; confirm new assertions fail before implementation.
- [ ] Implement additive tables and DTO validation. Use separate Organizer tables; do not migrate checkbox scans or legacy tasks. Mutations append an event in the same transaction. For ordering, renumber the affected priority group transactionally and increment revisions on changed rows.
- [ ] Run the focused suite; expect all cases pass. Reopen a temporary on-disk DB and assert stored tasks/criteria/steps/sources/order survive.
- [ ] Commit only this task's files: `feat: persist versioned organizer tasks`.

## Task 2 — Bind tasks to existing approvals and runs

**Files:** organizer.rs/store.rs, delegation.rs, approvals.rs as necessary; existing delegation/approval tests plus Organizer tests.

**Interfaces:** `prepare_organizer_delegation({taskId,expectedRevision}) -> ApprovalProposal` returns the existing proposal type. `start_organizer_delegation({proposalId}) -> DelegationRun`; `prepare_organizer_resume({runId}) -> ApprovalProposal`; `resume_organizer_delegation({proposalId}) -> DelegationRun`. Reuse `cancel_delegation_run`; Organizer introduces no alternate launch credential. Internal `OrganizerBinding { taskId, taskRevision, runId, contractSnapshot }` is validated under the existing execution lock.

- [ ] Write failing tests: proposed task cannot prepare; edited task invalidates proposal; changing a task's project via payload is impossible; expired/reused/mismatched proposals cannot launch; another open project run blocks; duplicate start returns the same recorded linked run without invoking the process adapter twice; legacy unlinked delegation still works.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml organizer` and existing `delegation`/`approvals` filtered suites; confirm the new behaviors fail.
- [ ] Refactor the existing start persistence seam so approval consumption, run creation, contract and Organizer link commit before filesystem/process creation. Avoid holding the DB mutex during process work. Preserve failure recording and consumed consent. Bind resume to the original task revision and run contract. Do not call one Tauri command from another; share internal Rust functions.
- [ ] Add fault-injection tests at pre-consumption, transaction failure, post-commit/pre-spawn and post-spawn boundaries. Expect rollback before commit; recoverable linked attempt after commit; no hidden automatic relaunch.
- [ ] Run filtered tests; commit `feat: bind organizer tasks to approved delegation`.

## Task 3 — Recoverable results and explicit completion

**Files:** organizer_lifecycle.rs, organizer_store.rs, organizer.rs, delegation_review.rs, lib.rs startup/recovery integration.

**Interfaces:** `fetch_organizer_task({taskId}) -> OrganizerTaskDetail {task,sources,runs,results,events,displayStatus}`, `accept_organizer_result({taskId,expectedRevision,resultId,workspaceHash}) -> TaskDetail`, `finish_organizer_task({taskId,expectedRevision,action:'complete_manual'|'cancel',reason}) -> TaskDetail`, `acknowledge_organizer_event({eventId}) -> void`. Manual completion requires 20–2,000 Unicode scalars of reason and no open run; label evidence as manual, never verified. `reconcile_organizer_runs(connection, recoveredRuns) -> Result<()>` is deterministic and makes no external calls or launches.

- [ ] Write failing tests: repeated reconciliation yields one result/event; failed run remains open task with failed display; run completion alone never completes task; acceptance needs successful existing review and fresh hash; stale hash fails; acceptance retry returns the recorded accepted result; manual completion is distinct; task cancellation never hides a running process.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml organizer_lifecycle`; confirm failures.
- [ ] Reuse run outcomes, workspace identity, changed files and existing review fingerprint validation. Add result upsert and deduplicated meaningful events. Run recovery precedes Organizer reconciliation. Acceptance uses a transaction and existing execution serialization so a concurrent launch/review cannot bypass checks; disclose the existing filesystem-fingerprint race limits rather than promise an atomic filesystem snapshot.
- [ ] Test close/reopen at interrupted execution, interrupted check, review complete before task accept, and post-accept boundaries; missing workspace yields unavailable evidence. Existing detached-process checks remain enforced. Verify repeated polling and acknowledgements do not produce new notifications.
- [ ] Run Organizer and delegation-review suites; commit `feat: retain organizer results and recover task progress`.

## Task 4 — Usable Project Organizer

**Files:** new organizer service/hook/components/style/harness, ProjectsPanel.tsx, DelegationPanel.tsx, DelegationReview.tsx, scripts/test-organizer.mjs, src/organizer-harness.tsx.

**Interfaces:** TypeScript mirrors backend DTOs. `useOrganizer(projectId)` supplies tasks/loading/error/lastSuccessAt/refresh and mutation methods. `OrganizerPanel({projectId,onInspectRun})` selects tasks; existing delegation and review components receive an optional Organizer binding, retaining current behavior when absent.

- [ ] Write failing harness tests for create/edit/adopt/move, source-link rendering, explicit launch proposal, unavailable executor, conflict with retained input, cancelled-run retry, awaiting review, and accepted completion. Include keyboard access, empty/loading/error/stale states and return after project navigation.
- [ ] Run `node scripts/test-organizer.mjs`; expect failures for the new UI behaviors.
- [ ] Implement Project-only panel and detail editor using existing design primitives. Add no new effects unless the installed Kinetics patterns justify them. Show the captured objective/criteria at approval time; never hide or auto-confirm the existing stage approvals. Render source content as text, not HTML or commands. Selecting a source does not run a provider.
- [ ] Make active-task edits a retained local draft with an explanation and existing cancel control. Do not claim an edit steered an executing process. Use real backend phase transitions; show result-ready distinctly from completed.
- [ ] Run harness and `npm run build`; inspect browser screenshots at supported desktop sizes including narrow layout, long title and long error text. Commit `feat: add project organizer task and result views`.

## Task 5 — Project next action and meaningful attention

**Files:** projectCommandBoard.ts and its harness, ProjectsPanel.tsx, useOrganizer.ts; organizer lifecycle event tests; scripts/test-project-board.mjs.

**Interfaces:** Extend `buildProjectCommandBoard` with an optional typed Organizer snapshot containing availability, tasks and attention events; legacy callers keep current behavior when omitted. Include an explicit source marker on the displayed Organizer next action.

- [ ] Write failing tests: waiting/review checkpoints outrank next task; an accepted task advances to the next committed item but never launches it; proposed items are not commitments; completing all Organizer tasks never declares the project archived; conflicting vault next step remains visible as source-labelled attention; failed Organizer loading does not show zero tasks as fact.
- [ ] Run `node scripts/test-project-board.mjs` and `node scripts/test-organizer.mjs`; confirm new assertions fail.
- [ ] Implement deterministic projection and acknowledgeable in-app attention. Routine progress remains history. No operating-system notifications or scheduling. Preserve source distinctions between vault commitment, Organizer commitment and generated recommendation.
- [ ] Run both harnesses and backend event-deduplication tests; commit `feat: connect organizer progress to project next actions`.

## Task 6 — Full workflow acceptance and recovery documentation

**Files:** scripts/test-organizer.mjs, scripts/visual-review.mjs, docs/ORGANIZER.md; focused backend acceptance fixtures; docs/NEXT-SESSION.md only after implementation acceptance.

- [ ] Add the full fixture scenario: create -> adopt if proposed -> prepare -> explicit start -> waiting plan -> explicit resume -> result ready -> review -> task accept -> next task. Assert the archive's research source reference survives and is never treated as authority.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml --lib`, `node scripts/test-organizer.mjs`, `node scripts/test-project-board.mjs`, and `npm run build`. Expected: no regressions; record any pre-existing ignored tests accurately.
- [ ] Run `npm run visual:review`; inspect affected Project and shared-surface screenshots, repair regressions, then complete the full visual pass. Browser verification remains distinct from native acceptance.
- [ ] In an isolated native acceptance profile, verify create/edit/reopen, stale proposal rejection, duplicate launch rejection, cancellation/recovery and result acceptance. Do not disable an acceptance profile's executor protection: use its documented approved live-execution path or a separately authorized disposable repository/profile. Obtain the existing concrete runtime approval before each live stage. If unavailable, record live acceptance as pending rather than claiming success.
- [ ] Back up and restore the isolated SQLite database including Organizer tables and verify task/run/result/event links after restoration. Document that vault backup alone excludes operational SQLite state. Verify an older build on a DB copy ignores added tables without data loss; never test downgrade on production data.
- [ ] Record exact verification level, limitations, recovery behavior and the remaining cloud/scheduling/threading backlog. Create an Olympus memory milestone using its compare-and-write helper. Commit `test: verify organizer workflow recovery and acceptance`.

## Completion and review

Six sequential tasks; later interfaces depend on earlier contracts. Inline execution is the simplest option for this slice, with focused review of the approval transaction and restart behavior before integration. Independent agents remain optional if Kevin selects them.

The plan was checked against the design for state mappings, validation limits, proposal binding, source authority, crash boundaries, stale review, attention deduplication, rollback and native acceptance. No implementation tests were run during planning. These documents require review before execution; existing unresolved live-provider acceptance is disclosed, not a reason to invent a separate prerequisite project.
