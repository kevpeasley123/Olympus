# Vision review

Kevin's goal for Olympus, in his words: "I generally don't want to have to
babysit an idea if I feel like i've communicated the vision to olympus. I want
it to be able to improve itself over time because it knows my workflows and
preferences." This document describes how Olympus measures itself against that
vision. It builds on the loop contracts and scorecard (docs/LOOPS.md). Added in
0.79.0; the weekly review run is not built yet.

## Expectations

`src-tauri/src/commands/expectations.rs`, tables `expectations` and
`expectation_checks` (migration 11).

- Each expectation is a statement addressed to Kevin, his own words quoted
  (`kevin_said`), when (`said_on`: the day, or only the month when the day is
  not on record) and where he said it, and the code checks that test it.
- `SEEDS` are proposals drawn from what he has asked for so far: a spoken
  brief, the greeting, settled matters staying out, a brief whenever Olympus
  opens, capped retries, stopping for writes, no babysitting, fixing without
  back-and-forth testing, chat or voice only. Seeding adds missing ones as
  `proposed` and never changes one that exists, so his decision stands.
- Kevin approves a proposal, marks it "Not mine" (retired), retires an approved
  one, or restores a retired one, in Diagnostics > Your expectations. That is
  the only write, and it is his.
- Only approved expectations count towards the score.

## Checks

Rules with no opinion, run on every opening brief (`check_brief`,
`check_greeting`), on the spoken text without the greeting where it matters:

| Check | Fails on |
| --- | --- |
| `brief.spoken-length` | more than 110 words |
| `brief.no-written-dates` | a month followed by a number, or 11/18 and 2026-11-18 forms |
| `brief.no-version-numbers` | three-part numbers such as 0.65.0 |
| `brief.no-labels` | a colon (not in a clock time), a semicolon or parentheses |
| `brief.no-source-narration` | "Gmail is connected", "since your last brief" and the like |
| `brief.no-exclamation` | an exclamation mark |
| `brief.settled-stays-out` | at least 60% of a settled matter's distinctive words (two or more) |
| `brief.greeting` | no greeting at the start |

Two checks are read from what runs did: `brief.delivered` (completed versus
failed briefs) and `loops.capped` (root runs with at most one `Retry:`).

A brief that breaks any rule is written again once, given the broken rules,
unless the run already spent its one rewrite on a rejection; the brief that
stands is the one recorded. Results are stored per run; a rewrite replaces the
earlier result.

## Score

The vision score is passed over total, for approved expectations' checks, over
the last seven days. There is none until something approved has been checked.
Expectations without checks show "Judged at the weekly review".

## Next: the weekly review

Planned, not built: one capped run a week that reads the week's checks, loop
scores, failures and Kevin's corrections in chat, reports which expectations
held and which slipped, and proposes changes (instructions, settings, new
checks, new expectations from his words, tasks for a coding session). Proposals
wait for Kevin. It will run within a weekly budget he sets, skip a week when
Claude usage is low, and have one switch to pause it.
