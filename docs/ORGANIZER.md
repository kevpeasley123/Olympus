# Project Organizer

Organizer connects a saved project task to Olympus's existing delegation and review workflow. Its records live in the application's SQLite database. The original Research archive remains a separate vault artifact.

In Project detail, create a task with an objective and acceptance criteria. Optional fields include checklist steps, priority and reason, due date, and source references. A suggestion must be explicitly adopted before delegation can be prepared. Saving or adopting a task does not authorize execution.

“Review delegation scope” prepares the existing planning proposal. Read its task, criteria, repository, base, model and permitted actions before approving. Planning still stops for the existing implementation approval; use the delegation section below Organizer to review, resume or cancel. There is no new executor or provider call for task management.

Edits use stable task IDs and expected revisions. Conflicting saves retain the local draft; loading the latest revision is an explicit discard operation. Drafts survive Project navigation during this application launch, but are not durable across app restarts. The backend refuses edits to tasks with open linked runs; an edit is never presented as steering an active process.

A completed run produces **Result ready**, not a completed task. Complete the existing criterion review, then choose **Accept reviewed result and complete task**. Acceptance rechecks the current workspace fingerprint. A manually completed task requires an explanation and records an operator statement, distinct from verified run evidence. Completing a task never archives its project or launches the next task.

## Records and recovery

- Task revisions, sources, approval bindings, run links, results and events are stored separately from legacy vault checkbox tasks.
- Approval consumption, the attempted run, its contract and Organizer link commit in one SQLite transaction before workspace/process preparation. A failed preparation retains an attempted run. Repeated start requests for the same consumed, session-bound Organizer proposal return the recorded attempt; they do not relaunch it.
- Existing delegation recovery runs before Organizer reconciliation. Repeated reconciliation does not duplicate result-ready events or results. Acknowledgements persist. Recovery never starts a replacement process.
- Accepted results retain their original review fingerprint. Task detail labels unavailable or changed workspace evidence. Existing fingerprint checks do not provide an atomic filesystem snapshot: another process could modify files after hashing.
- Source paths and HTTPS URLs are references, never authority. Vault paths are checked for containment, including existing ancestors. Missing sources remain in the record. Saving a new vault reference reads at most 2 MiB, captures the file hash and up to 8,000 characters of source text, and preserves that capture through later task edits. Missing, oversized or unreadable sources can have no capture and are labelled accordingly. Unchanged historical references remain editable even while the vault is unavailable; new or changed references still require containment validation. URLs are not downloaded.
- Task detail and the delegation review section retain every linked Organizer run, including results older than the usual 20-run history window.

The next committed task is chosen by priority and manual order, with an Organizer source label. Existing run checkpoints outrank it. A different vault next step stays visible as source-labelled attention. An unavailable Organizer connection is reported explicitly.

## Backup and rollback

Vault backup alone does **not** contain Organizer state. Back up the application's `olympus.sqlite` using SQLite's backup API or `VACUUM INTO`, or copy the database only after Olympus has exited and any WAL state has been checkpointed. Preserve delegated workspaces separately: database manifests do not contain their files.

Restore first into an isolated acceptance profile. Verify task IDs and revisions, source references, run links, result IDs and review fingerprints, and `PRAGMA foreign_key_check`. Never restore over a running production database. This change adds tables; it does not rewrite legacy task rows. An older build may ignore these tables but cannot maintain Organizer state while it is running. Downgrade acceptance must use a database copy.

## Verification scope

Automated checks cover persistence/reopen, stale revisions, validation, priority ordering, active-run edit guards, proposal binding, atomic approval rollback, safe duplicate-start lookup, result/event deduplication, stale result rejection, explicit/manual completion, and SQLite backup/restore with linked reviewed results. The browser fixture covers drafts, conflicts, sources, adoption, explicit planning approval, result gating, completion, narrow layout and unavailable state. Run transitions in that fixture are synthetic; it does not prove a live provider or native Tauri IPC.

Commands: `cargo test --manifest-path src-tauri/Cargo.toml --lib`, `node scripts/test-organizer.mjs`, `node scripts/test-project-board.mjs`, `npm run build`, and `npm run visual:review`.

Native Windows/WebView2 acceptance, process-crash fault injection at each launch boundary, and an older-binary downgrade run remain release gates. The isolated acceptance profile intentionally forbids live delegation. Do not disable that guard or interpret implementation approval as approval for a paid agent run. This branch is not an installed release.

Deferred scope: cloud execution, schedules, scoped conversations, live task steering, other executors, automatic Research archival and memory promotion.
