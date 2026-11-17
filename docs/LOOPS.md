# Loops

Olympus's loops, each written down with its five parts, and a scorecard of how
each did. Step 1 and 2 of the loop engineering game plan (the "Olympus loop
engineering game plan" doc), added in 0.77.0. The vision review
(docs/VISION-REVIEW.md) is built on these.

## Contracts

`src-tauri/src/commands/loops.rs` (`CONTRACTS`) names, for every loop:
trigger, goal, verifier (and whether it is code, a model or real tests),
actions, memory, iteration cap, Kevin's gate, and the part it most lacks. A
test fails if any part is blank. Loops today:

| Loop | Verifier | Weakest part |
| --- | --- | --- |
| Ask Olympus (`work-request`) | Code (schema, citations) and Themis | The content check is a model, not a rule |
| Opening brief | Code (schema, length, citations); one rewrite when rejected | No check against Kevin's stated preferences |
| One Olympian from chat | Code | No independent check |
| Coding delegation | Real checks, run by Olympus when a chat-started run stops | One approved revision on a failed check (0.86.0); never run against a real project |
| Background jobs | Code (schema, provenance) | Outside-service failures are not retried |

A chat turn is not a loop and is not scored. The Activity Deck's operation card
names the loop an operation belongs to (`loopName` in `src/services/loops.ts`).

## Scorecard

`loop_scorecard(days = 7)` reads only recorded state:

- **Skill loops** (Ask Olympus, opening brief, one Olympian): one finished root
  run in `agent_runs` is one pass. A run is *right first time* when it
  completed without a revision round (a `Retry:` event). An Ask Olympus
  revision is *resolved* when the last verification after it refuted nothing;
  a brief's rewrite, when the brief then completed. *Out of
  steps* counts runs stopped for using every allowed turn. Time and reported
  cost include the run's hand-offs.
- **Background jobs**: one outcome event of a labelled job (`<label> on
  <model>`) that is not a skill run, a delegation or a chat turn.
- **Coding delegation**: `delegation_runs` by phase: awaiting review, failed,
  or completed.

Running runs are not scored. Cost is what Claude Code reports at API rates,
which is the closest reading of subscription use, not a bill.

Diagnostics shows the scorecard when it is opened: each loop's line, and its
contract on expanding. It is read once per opening, never polled.

## Scheduled loops (0.86.0)

Work Olympus does on a rhythm while it is open, without being asked
(`src-tauri/src/commands/schedules.rs`). A schedule is a fixed entry in
`SCHEDULES`; nothing a model, a note or an email says can add one. A ticker
checks six minutes after start and every quarter hour. Each schedule runs at
most once per period, can be switched off, and records each run in
`processing_logs` under `schedule.<id>` (kept 60 days). Diagnostics lists them
with when each last ran and what it found (`schedule_status`), and a Check now
button for the self-check (`run_self_check_now`).

| Schedule | Every | Costs | Off switch |
| --- | --- | --- | --- |
| Self-check | 6 hours | No engine usage | `schedule.self-check.enabled` |
| Weekly review | 7 days | One Claude run, under the review's own guards | `vision.review.enabled` |

**Self-check.** Rules over Olympus's own records, no model: the last brief
failed; three or more runs failed in a day; a brief rule broken twice or more
in a day; Gmail needs reconnecting; email analysis failed three times running;
review proposals a day old with no decision; no expectation approved; coding
work a day old awaiting review. Findings marked `needsKevin` are ones only he
can clear. The next brief receives them as `thisOlympus.selfCheck` in
`recent_activity` and says one that needs him in a sentence, with the words
that settle it. This is the "constantly" half of evaluating against the
vision; the weekly review is the "periodically" half.

**Weekly review.** The ticker now starts it when due, so an Olympus left open
for days still reviews its week. The once-a-session start after the brief
remains; the review's guards make a second start a refusal.

Not built: a schedule that acts (anything beyond reading and proposing), and
anything that runs while Olympus is closed.
