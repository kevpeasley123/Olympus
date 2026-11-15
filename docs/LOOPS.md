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
| Coding delegation | Real checks on request | A failed check is never retried; no memory of attempts |
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
