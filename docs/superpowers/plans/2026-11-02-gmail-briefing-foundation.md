# Gmail and Briefing Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver the first independently testable part of the approved design: truthful Gmail/analysis health, retry eligibility, and shared source-grounded factual briefs with durable repetition suppression.

**Architecture:** Extend existing Gmail status and workers; retain closed model gates. Project and mail facts feed a pure brief selector; native SQLite settings hold bounded delivery receipts, without changing mailbox or model behavior. This milestone is explicitly factual; semantic synthesis, workflow-learning edits and tray activation follow in separate subsystem plans after this baseline.

**Tech Stack:** Existing Rust/Tauri/SQLite and React/TypeScript; no new dependencies.

**Spec:** ../specs/2026-11-02-gmail-learning-intelligence-design.md (approved by Kevin).

## Global Constraints

- Preserve Gmail read-only scope, local-only drafts, temporary-chat exclusions and existing spending gates.
- Retain the configured seven-day horizon initially.
- No product install, live model call, credentials read by test code, provider activation or startup registration.
- Preserve unrelated work; source checkpoint is 51bc631; implement on codex/gmail-learning-intelligence in a separate worktree.
- This milestone does not claim live semantic intelligence, adaptive workflow learning, native acceptance or complete design implementation.

## Review Focus

- Stale or mismatched-account mail cannot produce current suggestions (task 3).
- Network failures must not demand OAuth reconnection (tasks 1/2).
- Failed delivery and malformed receipts must not suppress useful items (tasks 3/4).
- Repeated launches must not reissue unchanged dirty-checkout advice (tasks 3/4).
- Closed provider routes must remain closed and cannot be described as analysis-ready (task 1).

### Task 1: Explicit analysis readiness and transport diagnosis

Files: gmail/auth.rs, gmail/mod.rs, new gmail/health.rs; src/services/gmail.ts; GmailSettings.tsx; focused Rust and frontend tests.
Interfaces: Gmail Status gains `analysis: {state, reason}`. Pure `analysis_readiness(provider: &str, local_model: Option<&str>)` returns blocked/paused-until-verified/invalid, never probes a provider. Actual subscription gate remains authoritative. `transport_error(&reqwest::Error)` returns allowlisted timeout/connect/network codes without private details.

- [x] Write tests proving default route is blocked, configured local route is unverified, unknown routes fail visibly; timeout/connect errors are not authentication failures.
- [x] Run focused tests and observe failure before implementation.
- [x] Implement backend projection and safe frontend explanation, preserving existing status fields and fixture compatibility.
- [x] Run Rust tests, frontend health checks and build; inspect Gmail settings browser rendering.

### Task 2: Honor persisted sync scheduling

Files: gmail/mod.rs and gmail/tests.rs.
Interfaces: `sync_due(enabled: bool, status: &str, next_sync: Option<&str>, now: DateTime<Utc>) -> bool` is used only by automatic cadence; explicit Sync still runs immediately.

- [x] Add tests for future retry, overdue retry, disabled/auth-required account, malformed deadline and startup without a deadline.
- [x] Observe RED; implement the predicate and wire cadence to persisted eligibility.
- [x] Verify existing atomic cursor/cache recovery tests and all focused Gmail tests. Do not reset credentials or write live DB.

### Task 3: Shared bounded factual brief selection

Files: new src/services/briefingIntelligence.ts, its harness, test script; existing openingBriefing.ts kept as legacy/harness compatibility if needed.
Interfaces: `BriefItem {id, revision, text, priority}`; `selectBrief(items, receipts, mode, now)` returns at most three items; `Receipt {revision, deliveredAt}`. A pure projection accepts projects, board, GmailStatus, SituationSnapshot and errors. Default 24-hour cooldown; on-demand can repeat; revisions invalidate suppression.

- [x] Write failing tests for repeated dirty checkout, changed evidence, 24-hour reminder, malformed/future receipts, explicit on-demand repeat, unavailable scan, stale sync, mismatched account, disabled analysis and invalid message references.
- [x] Implement pure projection/selection. Prefer pending decisions and valid email attention over repository hygiene; include limitations and label output as factual while analysis is blocked.
- [x] Run new test script and existing opening/situation briefing tests. No model call.

### Task 4: Durable receipts and opening/on-demand integration

Files: new commands/briefing.rs; commands/mod.rs, lib.rs; src/services/situationBriefing.ts, src/hooks/useDashboardData.ts; focused tests.
Interfaces: `briefing_receipts` reads bounded JSON from its own settings key; `briefing_record_delivery(items)` validates and merges receipts using backend time, max 200 records. Existing settings schema avoids migration. TS preparation returns text and selected receipt items; caller acknowledges only after displaying/saving the message. Speech remains separate and unchanged; this milestone receipts describe displayed output only.

- [x] Add in-memory Rust tests for corrupt stored JSON, invalid item bounds, merge, repeat update, cap and timestamp source.
- [x] Observe RED then implement commands and register them.
- [x] Fetch Gmail/situation/receipt snapshots read-only with bounded waits. Do not trigger sync or generation to compose a brief. Catch partial failures and report coverage rather than no news.
- [x] Wire opening and requested briefs to shared preparation. Avoid overlap and stale async completion after session/account change. Do not let receipt persistence failure hide a delivered message.
- [x] Verify offline tests, build and browser integration with synthetic IPC. Receipt failures leave retryable evidence rather than recording success.

### Task 5: Verification, review and handoff

- [x] Run build, offline Rust suite, repository script suite with correct local server prerequisites, and visual regression. Record baseline/environment failures by name.
- [x] Review changed settings/brief screenshots and request fresh whole-change review. Fix important findings with regression tests.
- [x] Update affected live docs and NEXT-SESSION with exact milestone, checks and deferred design scope. Keep version unchanged because this is not a release/install.
- [x] Review intended files, commit only the feature branch changes if validation supports it. No push/merge/install.

## Continuation boundaries

The next plan covers unified semantic evidence, correction/forget/undo learning, and qualified analyzer acceptance. Tray operation is a later optional plan. Current network root cause and Google consent publishing mode require supported runtime/account inspection; no fabricated repair or automatic auth changes. Existing subscription authorization blockers remain separate.
