# Next session

## Current state - November 2, 2026, America/Phoenix

Version 0.42.0. Unreleased branch `codex/gmail-learning-intelligence` in the
`2026-11-02/task/olympus-gmail-intelligence` isolated worktree. Foundation commit
2e223c9 and learning-store commit 93fce5f precede the current interface correction.
No push, merge, install, native launch, production DB change, credentials or live
model calls. Installed Olympus is unchanged.

## Kevin's corrected direction - automatic understanding

Kevin rejected the added manual learning workflow. Olympus must build understanding
of projects, preferences and workflows through normal conversations and connected
sources. He should not categorize/file conversations, approve individual memories,
or maintain learning records. Corrections should work in ordinary conversation.
The manual is authoritative; read
superpowers/specs/2026-11-02-automatic-understanding-correction.md before more work.
It supersedes the manual UI part of the previous Gmail/learning design.

Removed Correct suggestion, its editor, and What Olympus learned with Edit/Undo/
Forget controls from the console. Existing source review and optional attention
actions remain; neither should be necessary for automatic learning. Internal
revision/source/account safeguards and existing data remain recoverable. The
correction/undo/forget backend is not yet connected to ordinary conversation.

## Next implementation

Audit and repair the existing chat_memory.rs and Gmail situation-analysis paths:
eligibility, watermarks, source coverage, provider readiness, persistence and recall.
The current chat worker waits for a quiet chat and tracks watermarks; after four
consecutive failures it stops retrying until learning is toggled. Audit provider-blocked
versus real inference failures and safe resumption without making Kevin babysit it.
Do not bypass generation gates or silently reactivate paid retries.
Use offline end-to-end conversation/project/email fixtures to prove useful context
and briefs without any categorization or feedback-management steps. Then connect
natural-language corrections and qualify an authorized analyzer. Do not replace
the missing intelligence with another management panel.

## Verification

Interface correction build, focused source-review/revisioned-action/account-switch
browser checks and guidance verification pass. Standard visual regression passed
21/21 captures, 14 functional checks and 22 Organizer checks. The simplified narrow
card was inspected; no manual learning panel remains. Build retains the existing
chunk-size warning. Evidence: output/automatic-understanding.
Prior full verification is recorded in
archive/NEXT-SESSION-before-2026-11-02-automatic-direction.md (646 offline Rust,
24 ignored; 66 scripts and standard visual regression passed before this UI removal).
No Rust/schema behavior changed in this correction. The known separate flagship
ring-count assertion mismatch remains documented; no assertion was weakened.

## Remaining boundaries

Live Gmail recovery and Google consent publishing mode remain unverified. Preserve
the seven-day horizon and provider/consent/spending gates. The existing learning
worker's presence is not proof it is running successfully or producing useful
understanding. Do not claim live intelligence from fixtures.

Migration 3 remains additive and uninstalled. Verify a restorable operational DB
backup before native rollout; older binaries reject the newer schema. Prior
credential/acceptance blockers are preserved in
archive/NEXT-SESSION-before-2026-11-02-gmail-foundation.md. Optional tray operation
follows useful reliable intelligence. Research import and original Zeus edits remain
separate. Local-model readiness still labels unsupported nonblank names unverified;
the actual adapter validation remains authoritative.
