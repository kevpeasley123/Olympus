# Personal briefing implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task. Kevin approved the design and requested the build; continue without intermediate permission checks for authorized work.

**Goal:** Source-grounded personal briefs with supported subscription and local execution.
**Architecture:** Incrementally consolidate existing stores and routes; prove runtime capabilities before enabling inference; migrate briefing behind a reversible setting.
**Tech Stack:** Rust, Tauri, SQLite, React/TypeScript, provider-owned CLIs, Ollama.
**Spec:** ../specs/2026-11-08-personal-briefing-architecture.md

## Global constraints
- No gbrain adoption, paid fallback, credential extraction or destructive migration.
- Preserve pending 0.52 changes; do not package an incomplete architecture migration.
- Backend enforces source identity and tool authority; display acknowledgments remain exact.

## Review focus
- Mail provider unavailable must not disable an independently configured briefing model (Task 1).
- Unknown billing/isolation is distinct from failed Gmail authentication (Task 2).
- Quiet receipts can be tracked without creating attention items (Task 3).
- Corrections survive old conversations and prevent repeat recommendations (Task 3).
- Cancellation, restart and source changes cannot publish stale/wrong-conversation output (Task 4).

## Task 1: Independent local task routing
Files: create commands/inference_routes.rs; modify commands/mod.rs and gmail/situations/analysis_provider.rs.
Interface: local_model_for(task: LocalTask, email_provider: &str, email_model: Option<&str>, brief_model: Option<&str>) -> Result<String,String>; configured_local_model(task) reads compatibility configuration once per resolution.
- [x] Add failing tests: explicit briefing model works without email route; extraction still requires configured local email route; absent briefing override inherits only an eligible local email model; cloud/malformed overrides fail without fallback.
- [x] Run focused native tests and observe failure.
- [x] Implement resolver and route current local briefing/extraction through it. Preserve local transport revalidation and acceptance isolation.
- [x] Run focused and existing local-provider regressions; document actual boundary.

## Task 2: Runtime qualification and central execution
Files: subscription.rs, claude_subscription.rs, subscription_jobs.rs, engines.rs, models.rs; move general Ollama transport out of gmail/situations/analysis_provider.rs.
- [x] Inspect installed CLI/protocol without generation; record supported auth, tools, quota and spending controls separately.
- [x] Prove scoped tool isolation with synthetic evidence; if unsupported, use Olympus-controlled retrieval and text synthesis.
- [x] Resolve included-allowance billing behavior before generation; do not replace one unconditional gate with an unchecked boolean.
- [x] Add route-selection tests for explicit provider choice, unavailable engine, local fallback only when selected, cancellation and actual model recording.
- [x] Integrate common execution with one extraction task before memory or full briefing migration.

## Task 3: Shared situation changes and durable recall
Files: gmail/situations/engine.rs, learning.rs, conversation_feedback.rs, situation_contract.rs, memory/retrieve.rs, briefing_context.rs; additive migration only if required.
- [x] Test receipt -> shipment -> delay and cancellation -> superseded appointment sequences with exact source references.
- [x] Extend current situation domain with quiet transactions; paginate active queries instead of dropping records at the old cap.
- [x] Expose revisioned change and related-source retrieval; separate operator corrections from interpretations.
- [x] Test durable preferences beyond seven days, withdrawal, unrelated same-sender purchases and already-handled matters.

## Task 4: Bounded investigative briefing
Files: briefing.rs, briefing_native_evidence.rs, briefing_synthesis.rs, briefing_lifecycle.rs, frontend briefing services.
- [x] Test tool allowlist, 12-call/120-second bounds, cancellation and source revalidation on synthetic fixtures.
- [x] Compose from situation changes and retrieved history; preserve cited evidence, saved text and exact display acknowledgments.
- [x] Shadow runs do not write knowledge or acknowledge display. Show dated prior brief while updating; never autoplay stale speech.
- [x] Compare qualified engines on same fixtures and consented private snapshot; judge semantic quality separately from schema validity.

## Task 5: Contributions, consolidation and release
- [x] Route existing background memory/reconciliation through qualified execution; test retry/restart idempotency and contribution receipts.
- [ ] Migrate callers and delete obsolete snippet/duplicate synthesis paths only after replacement acceptance.
- [ ] Update manual, architecture, model routing and handoff; run required release gates and installed acceptance.
- [x] Independent whole-branch review before merge/install; report actual remaining provider limits.

## Execution ledger
- Design approved by Kevin: "Yes this captures it. Continue with the build".
- Installed read-only discovery: Codex 0.167.0-alpha.3.2, Claude Code 2.1.312. Claude supports safe/restricted modes; bare mode excludes subscription login. Generated Codex protocol schema locally for inspection, no model request.
- No included-only request control found in initial Codex schema search. Kevin confirmed paid extra usage and automatic credit purchases are disabled on both accounts. This is operator confirmation, not a provider-enforced per-request guarantee.
- Task 1: resolver tests went RED to GREEN; four focused tests passed. Shared local transport moved out of Gmail, retaining local-host/model checks and source validation. The native suite passed 785 tests with 31 intentionally ignored before the later runtime compatibility change.
- Task 2: Codex's removed realtime flag was replaced by the active in-app voice flag in isolation verification, retaining the older disable argument. Focused account tests passed (8 passed, 2 ignored). An isolated synthetic subscription turn returned OLYMPUS_OK in about six seconds. This does not establish production briefing quality or enable production generation.
- Task 2: explicit background engine selection test went RED to GREEN. Existing callers retain Claude until migrated; the selected adapter owns eligibility. Removed the obsolete fallback loop. Full native regression verification passed: 788 passed, 31 intentionally ignored; guidance documentation check passed. These results do not complete Task 2 or enable production subscription generation.
- Claude login follow-up: Kevin reported signing in, but both the npm native executable and WinGet executable still report loggedIn=false. No credential contents were read. Asked which terminal/environment shows the successful login; independent work continues.

- Runtime qualification completed after Kevin finished Claude login: exact first-party Pro account verified; production isolated Claude and account-bound Codex synthetic turns passed. This supersedes the unresolved-login ledger entry above.
- Tasks 3/4: durable quiet transactions, forget propagation, change journal, curated indexed recall and bounded investigation implemented. Synthetic Codex/Claude investigative briefs passed; local missed a delay and remains under quality review.
- Root integration: independent briefing/memory settings, dated prior preview, cancel status, distinct empty/shadow/completed IPC outcomes and browser regressions passed. Full visual gate passed 21/21 captures and 22 Organizer checks.
- Final review is active: selected-mail dependency invalidation, prior timestamp normalization, memory route-revert recovery and changed-situation retrieval priority are being checked/fixed. Release acceptance is not complete.

- Final current-tree native gate passed:856 tests,37 intentionally ignored; production frontend build passed. All89 release scripts have passing results, including changed-file reruns. Independent whole-branch review approved code after verified fixes; private conversational-quality acceptance and install remain separate.

- Task 4 acceptance completed on the bounded investigative path. The same synthetic change corpus passed Codex and Claude subscription execution; final exact-build Codex regression passed in 37.6 seconds with both material changes and no invented action. Claude private-data acceptance was not authorized or run. Local qwen3:14b remains unqualified for investigative briefing: its planner repeatedly reread one source and omitted another material change, despite schema-valid output; no subscription fallback masked that failure.
- Explicitly consented private Codex acceptance passed in 95.1 seconds with 12 native reads. It used a bounded fresh cache export, the actual selected registered project, relevant curated memory, and the exact installed project delivery ledger. Independent source checks confirmed the cited revisions and material claims. The result surfaced actionable personal information without generic news, repeated already-delivered project changes, or retrieval diagnostics in speech. This is acceptance of the bounded baseline, not an exhaustive account audit or a claim of user-rated personalization; remaining inventory and partial recall stay explicit metadata. Private message content and model artifacts remain outside the repository.
- Final Task 4 robustness verification: 132 native briefing tests passed, four intentional live tests ignored; shared cached-body normalization tests passed. HTML-only layout no longer consumes body-read sections, while original source bytes and fingerprints remain unchanged. Whole-read rollback at packet/history limits retains only fully bound prior evidence and records partial coverage, including the final-read/recoverable-error edge. Repository-wide gates and installed acceptance remain owned by the release task.

- Final release gate: 877 native tests passed, 38 intentionally ignored; all 89 release scripts passed. Private Codex extraction passed in 29.36 seconds retaining independently verified details without destructive model retry. Independent final review approved strict optional-detail omission. Local 8B extraction remains unqualified after quote/output/repetition failures; explicit Codex rollout is selected. Legacy workflow remains a deliberate reversible rollout path until installed acceptance, not an automatic fallback. Installation remains pending.
