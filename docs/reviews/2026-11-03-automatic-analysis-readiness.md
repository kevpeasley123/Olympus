# Automatic analysis readiness checkpoint

November 2, 2026 America/Phoenix (November 3 UTC). Base bf3c8b6 on
codex/gmail-learning-intelligence; unreleased local implementation.

## Result

Read-only preflight separates queued/blocked analysis from an inference failure.
Chat saving continues while learning waits; eligible pending chats resume without
operator management. Real retry caps remain. Local email configuration uses one
validator for status and execution. Existing preferences describe pending work
truthfully and add no learning controls. Generation remains gated.

## Verification

- Full offline Rust: 655 passed, 24 intentionally ignored/live tests excluded.
- Frontend build passed with the existing large-chunk warning.
- All 67 test scripts passed, including the new memory readiness browser test.
- Standard visual regression: 21/21 captures, 14 functional and 22 Organizer checks.
- Desktop/narrow Memory screenshots were inspected: clear pending/block reason,
  no new management controls or overflow. Shipped flagship composition was also
  captured and inspected. These are synthetic browser checks, not native acceptance.
- Guidance checks and git diff --check passed. No schema changes, installs,
  credentials, production operational DB writes, model calls, push or merge.

The automatic worker fixture archives four quiet synthetic chats while blocked,
then persists memory and summaries once a synthetic analyzer is eligible, with no
setting changes or duplicate inference. This proves worker/persistence behavior;
it does not prove real analyzer quality, assistant recall or changed briefs.
The acceptance gate regression was added at completion: removing the gate caused
its configured-local-model assertion to fail; restoring it passes the full suite.

## Independent review and one fix pass

A fresh reviewer found three Important issues; all were accepted and repaired:

1. An already-saved request could stay started when run preflight refused it.
   It now finishes as blocked with the exact waiting code. The regression failed
   on started, then passed on the persisted blocked result. Initially blocked
   structured jobs still create no request record.
2. Skipped email refreshes erased genuine failure history. Typed skipped/completed
   outcomes now preserve retries across pause, cooldown, sync and authentication
   waits and unchanged snapshots. Failure/wait/failure regression failed then passed.
3. Async outcomes used the account active at completion. Refresh now retains its
   starting identity, checks it before taking the inference snapshot, and ignores
   stale outcomes for another account. Cadence uses account-scoped delay. The
   synthetic switched-account recording regression failed then passed.

No Critical or deferred Minor findings. The final full native suite passed after
the fixes; no second reviewer was dispatched. Remaining checks are explicit below.

## Decisions and practical limits

- Used an ignored local progress ledger because cloud skill helper scripts were
  unavailable locally. Cost: less helper automation; test logs and decisions remain.
- Preserved historical exhausted retries: the latest error cannot establish that
  every prior failure was harmless. Cost: some old chats remain stopped until an
  evidenced repair is possible.
- Kept this checkpoint bounded to worker readiness/persistence. Cost: useful
  memory-informed briefs and conversational correction remain follow-on work.
- Kept live model quality, native runtime and account qualification unverified;
  there is no authorized live evidence. Cost: offline success does not establish
  useful live intelligence.
- Real-analyzer preservation of authored memory remains unverified. Prompt policy
  and compare-before-write safeguards are covered, but synthetic output cannot
  prove semantic compliance. Cost: incorrect memory edits remain a live acceptance risk.
- Retained ignored verification output because deleting it would invalidate the
  handoff evidence paths. Cost: disposable local disk usage. The worktree and
  branch remain local under the existing no-merge/no-push direction.

Evidence: output/analysis-readiness, output/memory-readiness and
output/visual-review/latest. The separate flagship ring-count assertion remains a
known baseline mismatch; it was not weakened or reported as passing.

## Already-requested follow-on

Extend automatic conversation/project/email scenarios through useful briefs,
connect natural corrections, then audit Obsidian capture, persistence, indexing,
retrieval, provenance, freshness, corrections, temporary exclusions and actual use
in both briefs and conversation. Kevin explicitly identified Obsidian as a major
source of improving memory. Current factual briefs do not consume its memory note.
Saving this milestone to Obsidian is not completion of that integration audit.
