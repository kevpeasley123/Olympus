# Analyzer contract and conversational corrections implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline, with one final independent review. Steps use failing/passing verification.

**Goal:** Validate structured analyzer output consistently and let clear ordinary-chat corrections update a referenced email without management controls.
**Architecture:** Reuse the gated subscription/local transports and existing revisioned email learning store. Persist bounded briefing references beside messages, resolve only saved operator words and source context, then transact feedback and a turn receipt together. A local deterministic recognizer handles explicit statements; other conversation stays with the normal assistant.
**Tech Stack:** Existing Rust/SQLite/serde and TypeScript/React. No dependencies or migration.
**Spec:** ../specs/2026-11-02-automatic-understanding-correction.md and approved Gmail intelligence design.

## Global constraints

No paid/live provider calls, credential changes, production DB writes, installation,
push/merge or startup changes. Preserve generation/acceptance gates. Temporary
chats neither read nor write learning. No category/forms/learning management UI.
Qualify the contract offline, not real analyzer quality. Later Obsidian audit stays
separate. Existing approval covers this sequence and inline execution.

Builder choices: validate the JSON Schema subset used by existing jobs recursively,
with bounded output/depth and explicit rejection of unsupported contract keywords.
Use unambiguous local phrases for handled statements and explicitly introduced
corrections; do not pretend this is general semantic interpretation. Raw operator
words are retained as attributed evidence, never executed or turned into task facts.
A single email in a single-highlight brief can resolve "that"; multi-item context
requires a short conversational clarification. No fuzzy person/project association.

## Review focus

- Quoted, hypothetical, negative or interrogative text must not mark work handled.
- A mixed/multiple highlight brief cannot silently resolve "that"; clarification preserves original words and source revision.
- Account/source/revision changes, imported/stale turns, privacy settings and repeated requests cannot apply incorrect or duplicate feedback.
- Saved-turn provenance and feedback apply atomically; provider failure cannot falsely claim a local update or erase a completed one.
- Nested malformed analyzer output, unknown fields and unsupported schema rules cannot become completed structured analysis.

### Task 1: structured analyzer contract

Files: new commands/structured_output.rs; subscription_jobs.rs;
gmail/situations/analysis_provider.rs; commands/mod.rs.
Interface: validate/extract an object against the supported schema subset;
subscription and local routes use the same validator before claiming completion.

- [x] Add failing nested object/array/enum/unknown-field/bounds tests and valid contract fixtures.
- [x] Implement bounded recursive validation, preserving existing fenced-object compatibility.
- [x] Apply validation to both routes; verify provider envelopes and blocked gates offline.
- [x] Run focused and full offline Rust tests; expect pass with live tests ignored.

### Task 2: source-bound conversational feedback

Files: new gmail/situations/conversation_feedback.rs and tests; learning.rs;
persistence.rs; briefingIntelligence.ts; new conversationFeedback.ts; types.ts;
useDashboardData.ts; assistant.ts interfaces; command registration.
Interface: conversation_feedback(conversationId, messageId, temporary) returns
null or {content, feedback?}; references carry accountId/threadId/signature/revision/
subject, total item count and bounded clarification provenance. Store references
in existing conversation_turn_context JSON, immutable on repeated appends.

- [x] Add failing ordinary statement -> source-scoped handled/corrected -> changed attention tests.
- [x] Persist/read briefing references; read exact latest saved user turn and immediately preceding app context.
- [x] Resolve explicit local phrases; ask conversational clarification when needed; reject unsupported/quoted/ambiguous source mutations.
- [x] Recheck account, source signature and learning revision; store exact statement/message IDs and idempotent receipt in one transaction.
- [x] Await user persistence before local interpretation; return truthful local acknowledgment before selecting/calling a model. Preserve ordinary provider routing when no local result exists.
- [x] Verify private/off/imported/stale/replay/source-race cases plus meaningful frontend delivery and real ChatPanel rendering.

### Task 3: checkpoint

- [x] Update feature docs, architecture and handoff with supported language and verification limits.
- [x] Run build, all scripts, native suite, focused screenshots and full visual regression.
- [x] One independent review, one RED/GREEN repair pass; ledger all judgments.
- [x] Local source commit and scoped Obsidian milestone reconciliation, no publication/install.

Afterward: the requested broader Obsidian capture/retrieval/use audit. Live model
quality, representative native briefs/Gmail recovery and optional persistence need
separate acceptance; this plan does not open those gates.
