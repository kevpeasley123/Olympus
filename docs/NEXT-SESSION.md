# Next session

## Olympus 0.48.0

Repair branch `codex/installed-brief-startup`, based on master `44784ef`.
Olympus 0.47.0 was installed successfully on November 8 and its repair installer
also returned success. Installed acceptance exposed two remaining failures.
Version 0.48.0 fixes those failures; release checks passed. Merge, packaging and
installed acceptance are next.

## Changes

- Local Gmail observations bind to supplied thread IDs before evidence validation,
  rather than assuming the model preserves array order. Duplicate, missing and
  unknown sources still fail. Source order is restored before persistence.
- Local brief preparation shares the bounded startup sync wait with the factual
  route. Due sync retries and retained transient errors are included. Revoked
  consent does not wait. Conversation cancellation prevents ticket preparation.
- Multi-situation summaries also bind by situation ID before source validation.
- Mail selection ranks likely bills, requests and shipment/order changes ahead of
  routine newsletters, preserving newest thread/sender evidence before ranking.
  Sign-in codes are excluded. These retrieval hints never establish urgency.
- Local instructions consolidate project changes and omit routine housekeeping.
- Existing 0.47 Gmail transport retries, local Qwen3 analysis, source-bound local
  briefs, feedback receipts and local voice remain in place.

## Verification — November 8

- Regression tests first reproduced reordered valid observations being rejected;
  repaired contract tests passed, including cross-thread quote rejection.
- Startup wait tests cover due sync, active retry, transient errors, legacy auth
  recovery, bounded timeout, revoked consent and conversation cancellation.
- Final native suite: 765 passed, 30 ignored with two test threads. Restricted-shell
  integration checks failed on OS/network permissions; unrestricted checks passed.
  A concurrent overloaded run hit four subprocess/loopback timing failures; the
  complete bounded-parallelism rerun passed without disabling checks.
- Current private mail-cache copy analyzed successfully using Qwen3 8B locally.
- Final frontend build passed. All 85 script checks passed using the shared fixture
  server. Visual regression: 21 captures, 14 functional and 22 Organizer checks.
  Command conversation screenshot inspected; no layout changes introduced.
- Independent review found no remaining important issue after recency safeguards.
- Installed 0.47 Gmail refreshed its existing grant and retrieved new mail without
  reconnecting. Its initial brief raced startup sync; a fresh-cache restart
  generated a brief. This is not acceptance of the repaired 0.48 binary.

## Remaining work and limits

- Finish review and release checks, merge, build/install 0.48, then verify scheduled
  Gmail sync, Communications analysis, and the saved opening brief in the real app.
- Inspect brief interpretations, not only schema success. A prior generated brief
  overinterpreted a release commit and included a routine food-delivery update.
- Background work runs while Olympus is open. Multi-day, suspend and prolonged
  offline recovery remain unverified. Revoked Google consent needs owner sign-in.
- No paid inference, mailbox mutations or expanded Gmail scopes are authorized.
  Local Qwen3 8B/14B and Whisper/Kokoro setup is machine-local and gitignored.
- Preserve the registered desktop Olympus checkout's pre-existing uncommitted work.
  This isolated checkout is the implementation/release workspace.
- Obsidian memory audit, research ingestion and OAuth-binding prototype remain
  separate unfinished work; do not fold them into this release.
