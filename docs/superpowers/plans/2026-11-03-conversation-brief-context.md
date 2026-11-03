# Conversation context in briefs implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline; one final independent review. Steps below include failing/passing verification.

**Goal:** Carry automatically learned, current conversation context into useful briefs alongside email and project evidence, without categorization controls.
**Architecture:** A read-only native projection exposes bounded recent learned summaries and source IDs. Existing brief preparation consumes and revalidates that projection; synthetic native fixtures feed the actual TypeScript selector/delivery path.
**Tech Stack:** Existing Rust/SQLite/Tauri and TypeScript/Vite test tools; no dependencies.
**Spec:** ../specs/2026-11-02-automatic-understanding-correction.md and approved Gmail intelligence design.

## Global constraints

Keep facts, remembered summaries and generated recommendations distinguishable.
No new model calls, credentials, production operational DB writes, installation,
push or merge. Existing worktree and gates remain. Temporary chats neither consume
nor contribute memory. No manual learning UI. No schema migration is needed.
This does not qualify real model quality or replace the later Obsidian audit.

Builder choices: expose at most three summaries from the past seven days, use only
one per brief, rank below concrete decisions/mail and above repository hygiene.
A summary is eligible only when learning covers all current messages, no learning
error remains, its user source is recent and not imported, and Use memory is on.
Label it remembered context, not a new verified fact. Do not infer cross-source
identity or commitments from shared names. An unchanged context item does not
recur on opening merely because a day elapsed; requested briefs may repeat it.

## Review focus

- Temporary/off/excluded current chat must cause no retained-memory read or delivery.
- New messages, deletion, renamed/updated summary and preference changes invalidate prepared context.
- Old/imported/future/unlearned/failed summaries cannot masquerade as current learning.
- Remembered context cannot crowd out urgent source-backed email/project decisions or overwrite facts.
- Source text stays out of delivery receipts; unchanged context does not repeat daily.

### Task 1: native conversation context

Files: create commands/briefing_context.rs; register command in lib.rs and module;
add chat_memory.rs fixture test using its existing injected analyzer boundary.
Interface: briefing_conversation_context(scope: {temporary, conversationId}) ->
{enabled, revision, items:[{id,title,summary,learnedAt,sourceMessageIds,revision}]}.
Revisions are SHA-256 digests. Native function reads the memory preference and
returns empty before reading conversations for temporary/off requests. Select
recent current learned chats, excluding the current chat, with bounded output.

- [x] Write native regression tests for privacy, freshness, watermarks and revision invalidation; observe missing/incorrect behavior.
- [x] Implement the projection with deterministic revision and source IDs.
- [x] Extend actual quiet-chat learning fixture to return projection after persistence; optionally export synthetic JSON only to explicitly supplied test output path.
- [x] Run focused then full offline Rust tests; expect pass, live tests ignored.

### Task 2: brief consumption and end-to-end scenarios

Files: briefingIntelligence.ts, briefingDelivery.ts, situationBriefing.ts,
useDashboardData.ts; new test-briefing-memory.mjs and native fixture runner.
Interface: optional memory() on injected BriefClient; production always implements
it. prepareFactualBrief receives explicit scope (default private) and consumes the
native projection; current() rechecks it. Both production opening/requested paths
pass current temporary/conversation scope. Missing source is a coverage limitation;
disabled/private is an intentional exclusion.

- [x] Write failing selector/delivery scenarios: remembered context changes brief, remains subordinate to mail/decisions, unchanged opening suppression, changed context resurfacing, disabled/private exclusion, stale preparation and read failure.
- [x] Implement scoped collection, context item selection and revision checking.
- [x] Feed Rust-exported synthetic learned context through actual prepare/display/receipt path with changed project/email fixtures; assert IDs, source attribution, ordering and meaningful content, not greeting variation.
- [x] Run all scripts, build and focused/full visual checks for the changed brief path. Inspect screenshots; browser fixtures are not native acceptance.

### Task 3: review and checkpoint

- [x] Update live feature docs, command table and handoff; distinguish persisted evidence, actual recall/brief consumption and unqualified semantic inference.
- [x] One fresh read-only review, one failing/passing fix pass for Important findings.
- [x] Commit verified local source and reconcile shared Obsidian milestone memory.

After this checkpoint: natural conversational correction and qualified analyzer,
then the requested broader Obsidian capture/retrieval/use audit; live acceptance
and optional tray persistence remain later. No additional design approval is
needed for this already-authorized sequence.
