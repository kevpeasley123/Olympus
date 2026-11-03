# Source-linked Email Correction Learning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Continue inline in the existing isolated worktree; one independent whole-change review follows implementation.

**Goal:** Make explicit feedback durable, inspectable and reversible, and let current source-linked corrections change the next factual brief even while model generation remains gated.

**Architecture:** Add an account/thread-scoped SQLite learning projection through an additive migration. Every mutation checks the source signature and expected record revision; operator decisions override generated attention at the snapshot boundary. Reuse the existing source and situation stores and keep correction text out of model calls in this milestone.

**Tech Stack:** Existing Rust/Tauri/SQLite and React/TypeScript; no new dependency.

**Spec:** ../specs/2026-11-02-gmail-learning-intelligence-design.md, sections 3-5. This plan implements explicit source-scoped learning, not inferred cross-thread workflow patterns, semantic synthesis, sync recovery or tray persistence.

## Global Constraints

- Preserve existing provider/consent/spending gates and seven-day horizon. No credential changes, live generation, installation, production migration, push or merge.
- Temporary chats do not feed learning. Controls operate on explicit email-source feedback only, separately from chat memory.
- No category-wide suppression, inferred completion or inferred preferences from clicks/inactivity.
- Keep original source, operator correction and generated interpretation distinct. Changed/expired source prevents application of earlier correction; retain it as stale history.
- Forget removes retained correction text and history from this feature and retains a source-scoped suppression tombstone. Undo applies to reversible feedback, not permanent Forget. Existing conversation history/source retention remains separately controlled.
- Use additive migration 3; do not edit prior migrations/schema.sql. Only isolated test databases execute migrations here. Native rollout requires verified operational DB backup.

## Review Focus

- Concurrent/stale UI writes must not overwrite a newer correction: expected revision and source-signature tests (task 1).
- Account switches, source expiry and new source evidence must not apply another scope's learning (tasks 1/2).
- A failed or stale analyzer must not overwrite explicit feedback; changed feedback invalidates pending analysis/briefs (tasks 1/2).
- Forget must clear correction/original/history text and prevent resurrection by old source projections; cache deletion must remove records (task 1).
- Handled is not completion; a correction is operator context, not a verified email fact; UI and brief tests pin those labels (tasks 2/3).

### Task 1: Durable feedback with optimistic concurrency

**Files:** new src-tauri/migrations/0003_email_learning.sql; commands/migrations.rs; new gmail/situations/learning.rs; situations.rs; attention.rs; gmail/store.rs; lib.rs.
**Interfaces:** `LearningRequest {account_id, thread_id, signature, expected_revision:i64, action, text}` (camelCase JSON); `change(&mut Connection, LearningRequest)`; `snapshot(&Connection, account_id, signatures) -> Vec<Value>`; `project(&[Value], &[Value], now_ms) -> Vec<Value>`.
Records expose threadId, signature, revision, action, correction, original suggestion, updatedAt, current and canUndo. History holds up to 20 prior states without nested history; corrections limited to 1000 characters. At most 2000 thread records/account; reject rather than silently evict explicit feedback. New/current-source writes validate current cached thread and its analyzed suggestion. Undo/forget also work on stale retained records but require exact expected revision and stored signature. Forget redacts history/original/correction and keeps a tombstone; it cannot be undone. Mutations bump situation context revision in the same transaction. Existing legacy decision command delegates to this store and preserves attentionDecision compatibility.

- [x] Add failing native tests for correction persistence/reopen, expected-revision conflict, account/source isolation, stale source nonapplication, snooze expiry, handled semantics, undo chain, forget redaction/no-undo, failed write atomicity, and account cache purge.
- [x] Run `cargo test --lib --offline --locked learning` and observe RED before implementation.
- [x] Add migration and implement checked store/projection, native command, snapshot integration and cache removal.
- [x] Run focused learning, attention, situations and migration tests; expected all pass, no live inputs.

### Task 2: Factual briefs honor explicit correction

**Files:** services/situations.ts, briefingIntelligence.ts, briefingIntelligence.harness.ts, scripts/test-briefing-delivery.mjs.
**Interfaces:** optional `learning: EmailLearning[]` on SituationSnapshot; EmailAttention optional operatorCorrection and learningRevision. Corrected items retain validated source evidence, but display only operator correction as the recommendation with explicit attribution. Fresh sync/matching account/current valid evidence are still mandatory; fresh model understanding is not required for explicit correction. All source decisions enter snapshot revision, so prepare/revalidate guards reject stale drafts.

- [x] Add failing checks for correction with blocked analysis, stale sync/account rejection, learning-revision receipt invalidation and forget/undo changes during preparation.
- [x] Implement scoped corrected projection and receipt revisions; keep original generated recommendation gated.
- [x] Run selector, delivery and situation briefing scripts; expected all pass.

### Task 3: Readable learning controls and final verification

**Files:** EmailAttentionBrief.tsx, new EmailLearningReview.tsx, emailAttentionBrief.css, services/situations.ts, scripts/test-email-attention.mjs and new scripts/test-email-learning.mjs; feature/manual/architecture/handoff docs.
**Interfaces:** `emailLearningChange(request)` native wrapper. Correction editor requires explicit Save. What Olympus learned view lists retained source-scoped feedback, original interpretation, correction, source currency and action; offers Edit, Undo when available, and explicit Forget confirmation. Refresh after mutation; prevent cross-account stale async updates; pending state blocks overlapping mutations. No generated animations or design-system change.

- [x] Write failing browser workflow tests for correct/save, learned view, edit, undo, forget confirmation, stale feedback handling and failed-save preservation.
- [x] Implement controls with existing visual primitives and explicit scope/forget/handled wording. Preserve existing source review and decision behavior.
- [x] Verify focused browser checks and inspect narrow/desktop screenshots.
- [x] Run frontend build, full offline Rust and repository script suites and standard visual regression. Keep baseline flagship ring failure documented without changing its assertion.
- [x] Request independent whole-change review, fix important findings with RED/GREEN regressions, update documentation/memory and commit only local feature work.
