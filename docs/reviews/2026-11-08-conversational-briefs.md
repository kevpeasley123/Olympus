# Conversational brief acceptance — November 8, 2026

Kevin rejected the 0.49 installed brief despite successful source binding: it
copied bill labels, spent attention on a routine sign-in and read a coverage
disclaimer aloud. Transport success and schema validity were insufficient.

## Correction

The 0.50 branch omits routine conditional sign-ins from local briefing selection,
keeps native coverage in bound metadata and an expandable disclosure, and asks
for natural spoken passages with practical meaning and source conditions intact.
Historical saved briefs are not rewritten. Coverage remains available to chat
history so subsequent reasoning does not mistake a partial review for full coverage.

## Local model comparison

On the same private real-mail snapshot, Qwen3 8B took about 109 seconds and still
produced stiff notices and an overconfident project statement. Qwen3 14B took
about 183 seconds and produced a more natural summary, correctly framed project
work as a code update, and preserved automatic payment. No private source text is
stored in this review. These observations support selecting 14B for briefs; they
do not establish general reasoning parity with a hosted model.

Additional synthetic checks used the production prompt and local 14B route:

| Case | Observed issue and final reviewed behavior |
| --- | --- |
| Settled receipt, no balance or obligation | Initially filled a slot with a no-action receipt. Explicit relevance guidance corrected this to an empty items array. |
| Changed appointment, delivery estimate, future autopay | Initially promoted an estimate into a promised delivery. Final output retained “estimated,” the revised appointment date/time, confirmation deadline, and no-separate-payment instruction. |
| Suspicious bank sign-in blocked | Preserved the blocked attempt, the reported absence of money movement, and the source's instruction to contact the bank using the card number. |

These are reviewed examples, not guarantees. Prompt instructions cannot replace
source validation or establish semantic correctness for arbitrary mail. Tests
must continue to distinguish exact source facts, estimates, and actual actions.

## Remaining boundaries

Installed 0.51 excluded the wrapped sign-in, but surfaced a vendor roundup as
personal workflow and summarized an older selected project fix. Kevin rejected
that relevance failure. Version 0.52 excludes clear bulk roundups (including
Gmail Updates), does not fill spare slots with newsletters, and emits selected
project evidence newest-first. Native tests preserve personal approval requests,
weekly work updates and project reports with incidental blog links. Review caught
and corrected an initially overbroad digest exclusion.

With the revised production prompt, local 14B returned no items for a vendor-only
announcement. Given that announcement plus a workspace suspension deadline, it
cited only the account request and preserved its action date. The earlier quiet,
appointment, estimated-delivery, autopay and blocked-sign-in cases also passed
manual output review. Real installed acceptance of 0.52 follows release.

Installed 0.50 acceptance found a further selection bug: a routine sign-in notice
wrapped "If this was you" across blank lines. The exact-match condition failed,
and the model repeated the notice despite the omission instruction. A sanitized
regression reproduced this; 0.51 normalizes body whitespace before both routine
classification and explicit-problem exceptions. This confirms why a private
snapshot and prompt-only examples cannot substitute for installed acceptance.

Local packets cover selected recent mail and project Git changes. They do not
establish comprehensive calendar, task, agent-run or cross-chat awareness. The
CPU route avoids the observed GPU contention but has noticeable latency. Opening
and background work require the app running and the PC awake. Multi-day OAuth
durability and the Google OAuth publishing mode remain unverified.
