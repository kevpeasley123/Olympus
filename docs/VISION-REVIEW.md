# Vision review

Kevin's goal for Olympus, in his words: "I generally don't want to have to
babysit an idea if I feel like i've communicated the vision to olympus. I want
it to be able to improve itself over time because it knows my workflows and
preferences." This document describes how Olympus measures itself against that
vision. It builds on the loop contracts and scorecard (docs/LOOPS.md).
Expectations and checks were added in 0.79.0, the weekly review in 0.80.0.

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

## The weekly review (0.80.0)

The `vision-review` skill (Zeus, read-only tools, 10 turns).

- **Given, as data:** the expectations that are not retired with their week of
  checks, the loop scorecard, the week's failed runs, and Kevin's own messages
  in saved chats over the week (`kevin_said`, 5000 characters at most).
- **Answers:** a short summary; which expectations held and which slipped,
  each with specific evidence; up to six proposals, each an `instruction`,
  `setting`, `check` or `build` change tied to an expectation; and new
  expectations Kevin asked for this week.
- **Grounding in code** (`ground_review`): a judgment of an unknown expectation
  is dropped, a proposal for one is re-tied to `new`, and a new expectation
  survives only if its quote appears in Kevin's messages (whitespace, case and
  curly quotes aside). Survivors become `proposed` expectations
  (`expectations::propose`, one per quote).
- **Nothing changes by itself.** Proposals are shown in Diagnostics for Kevin;
  acting on them is his decision, or work for a coding session.

**When it runs** (`start_due_vision_review`, called once a session four
minutes after Olympus opens): only if Kevin has not switched it off
(`vision.review.enabled`), no review completed or is running in the last seven
days, none was attempted in the last day, and no Claude window has less than a
fifth left. So it costs at most one capped run a week, plus one attempt a day
after a failure. Diagnostics > Your expectations has its On/Off switch, Run
now, and the latest review: summary, slipped, held and proposed improvements.

## Proposals and standing guidance (0.81.0)

Each review's proposals are stored in `vision_proposals` (migration 12), with a
`skill` each names (or `none`). In Diagnostics Kevin accepts or dismisses each.

- An accepted **instruction** for a skill is in effect at once: every run of
  that skill is given it, word for word, as "Kevin's standing guidance"
  (`standing_guidance`, twelve at most, oldest first), below its own
  instructions. Removing it takes it out. This is how Olympus changes its own
  behaviour without new code, by Kevin's decision.
- Accepted **build**, **check** and **setting** proposals are listed "For the
  next coding session". A coding session on Kevin's PC reads them with
  `SELECT id, kind, skill, title, detail FROM vision_proposals WHERE status = 'accepted' AND NOT (kind = 'instruction' AND skill <> 'none')`
  on `olympus.sqlite`, builds what it takes on, and Kevin marks each done.

## Retries, all told

A run retries once at most, whatever the cause: an outside-service failure
(timeout, unreachable, overloaded; never a limit or sign-in) after a 20-second
pause (`is_transient`), a rejected answer (any skill, since 0.83.0: told the
exact reason, the offered tools and the schema), or for the brief a broken
expectation. `loops.capped` checks the cap held.

The first review (November 15) proposed two build tasks Kevin accepted; both
shipped in 0.83.0: a run stopped by Claude's usage limit now says when the
window resets (`limit_notice`), and the brief speaks that notice instead of
failing silently; every skill checks its answer and rewrites it once.

## Deciding by chat or voice (0.85.0)

Kevin talks to Olympus only through the chat window or the microphone, so the
decisions live there too. A short message that names the thing and the verb is
carried out without an engine run (`src/services/chatDecisions.ts`):

- "accept the proposals" / "dismiss the proposals" / "what are the proposals"
- "approve the expectations" / "what are the expectations"

Only what is still `proposed` is touched, and the reply says exactly what
changed. A question, a negation, or a message over twelve words goes to the
model as conversation; the system prompt tells it to point Kevin at these
phrases and that it cannot decide for him. The Diagnostics buttons still work.

A build proposal a release has since delivered is marked `done` when proposals
are read (`BUILT` in `expectations.rs`), so finished work never waits on Kevin.
