# Agent events

Every agent run reports its work through one normalized event stream. The
activity feed reads it today; the Pantheon figures and usage telemetry are meant
to read the same stream, so what the dashboard shows is what an agent did.

This is step 2 of the harness plan agreed on November 11, 2026: one event shape
first, fed from the run path that already exists, with no change to how any run
behaves.

## What an event is

`src-tauri/src/commands/agent_events.rs` reduces an engine's own output to:

| Field | Meaning |
| --- | --- |
| `runId` | The owning run's id in its own table: a delegation run, a skill run, or a model request |
| `engine` | `claude-code`, `codex` or `ollama` |
| `agent` | The Armory role credited, for example `coding-delegate` (Hephaestus) |
| `kind` | `run_started`, `thinking`, `message`, `file_read`, `file_edit`, `search`, `command`, `subagent_started`, `tool_call`, `tool_failed`, `result`, `error`, `plan` |
| `summary` | One short line, at most 160 characters |
| `detail` | Optional longer text, at most 2,000 characters: a thought, a message, a full command, or a result's measurements |
| `tool`, `path` | The tool used, and the file for a read or edit |
| `subagent` | True when a helper agent started by the run did the step |

Events are stored in the `agent_events` table (migration 8) and emitted to the
webview as `agent-event`. The `agent_events` command returns the most recent
events, oldest first, optionally for one run or after a known id.

## What is deliberately not recorded

- **Tool results.** A result can hold file or mail text. Only a failure is
  recorded, as `tool_failed`, with no content.
- **A run's final answer.** A `result` event carries measurements (turns,
  duration, token usage, cost when the engine reports one). The answer stays
  with the run that owns it.

Thoughts, messages and commands are stored as bounded excerpts in the local
database. Nothing here leaves the machine.

## Sources

| Source | State |
| --- | --- |
| Claude Code delegation (`delegation.rs`) | Wired: every stream line is normalized by `normalize_claude_line` before the existing phase tracking runs. Phase tracking is unchanged. |
| Skill runs (`skill_runner.rs`) | Wired: every frame of a tool run, plus a start note and any refusal by Olympus's own checks. See [SKILL-RUNNER.md](SKILL-RUNNER.md). |
| Background jobs on Codex, Claude Code and local models | Wired at the shared entry points (`subscription_jobs::run_on`, `execution::structured`): a job is one request with no tools, so it reports a start and an outcome (finished, stopped, blocked) with model, duration and reported usage. Briefing, memory, mail analysis and research jobs all pass through here. |
| Codex's own step stream | Not wired. How much it reveals is untested. |
| Interactive chat turns | Not wired. |

## Observed usage

`agent_usage(days)` totals run outcomes per engine over the last `days` (7 by
default): runs, failures, seconds, tokens where the engine reported them, and
`reportedCostUsd`, the cost at API rates that Claude Code itself reports for a
run. That last figure is the closest reading Olympus has of Claude headless
credit spent.

It counts only what passed through this stream, so it is a floor and not the
account's own meter. It does not replace the Usage dock's account readings, and
no interface shows it yet.

## Interface

`src/services/agentEvents.ts` holds a bounded feed (the newest 200 events),
groups it by run (runs in progress first), and derives which agents are working: a run is in progress
until it reports its own `result` or `error`; a helper's result does not end its
parent.

Since 0.72.0 Command's left column has two tabs, **Activity** and **Armory**.
The Armory tab lists agents, plugins and skills with their state and holds
"Add resources & skills"; each row, and its corner button, opens the full
Armory dialog at that item. The Activity tab is the **Activity Deck** (`ActivityDeck`, model in
`src/services/activityDeck.ts`). It is built only from skill runs and this
feed:

- **Delegations**: one line under the heading, "No active delegations" or
  "N active delegations", counting the live agent cards (including mission
  steps recorded outside the skill runner).
- **Operation**: the newest run in progress, else the most recent finished one.
  Its state is a chip on the label row (Running, Completed with a green check,
  Failed in red); a finished card's line is dropped when it only repeats it.
  Progress is shown only as counted stages of an accepted plan (the plan, each
  hand-off, the answer); a run with no such stages shows an unmeasured sweep and
  no number.
- **Agent cards**: the lead is Running, or Coordinating while a hand-off is out;
  a specialist is Running, then Completed or Failed; one planned but not started
  is Queued. The `plan` event an orchestrated run records (its `detail` is a
  JSON list of `{agent, name, task}`) is what makes Queued and the stage count
  knowable. Each card's line is its latest recorded step, reworded by
  `describeStep`; an unknown step keeps the backend's summary. A card expands to
  its assignment, last five steps and report or failure.
- **Idle agents**: everyone else, with the catalog's own readiness (Idle,
  Unverified, Planned). Since 0.71.0 the row shows the agent's current state,
  not the outcome of its last run: that outcome is on the operation card and in
  the row's expanded detail.
- Mission steps recorded outside the skill runner (research, coding delegation)
  show their agent as Running, or Blocked while waiting on approval.

### Operation detail (0.74.0)

All of this is derived in `activityDeck.ts` from the same skill runs and events;
nothing new is recorded and nothing is estimated.

- **Lead and time.** The card names the accountable Olympian (the root run's
  agent) and the elapsed time from the run's recorded start (ticking in its own
  component), or its duration once finished.
- **Next.** Only from the accepted plan and the runs' states: "Awaiting
  Athena's research & analysis" while a hand-off runs, "Themis takes the next
  hand-off" when the plan names one not yet started, "Zeus writes the final
  answer" once every hand-off has settled. Before a plan, and after the end,
  there is none.
- **Quiet.** A running operation whose latest event (its own or a hand-off's)
  is more than three minutes old says "No activity recorded since …". It is
  not called stalled or failed; restart recovery already closes runs that a
  restart interrupted.
- **Failure kind.** A stopped operation's recorded reason is read as *Needs
  you* (sign-in, authorization, approval, usage limit), *Outside service*
  (timeout, unreachable, rate limit) or *Olympus issue* (anything else)
  (`classifyFailure`). Only *Needs you* reaches the Overview, for 30 minutes.
- **Timeline** (`operationTimeline`), under the card: the recorded start, the
  plan, each hand-off (`subagent_started`: Zeus → Athena, with the task), each
  specialist's steps, each return ("Athena reported back": Athena → Zeus,
  results returned) or failed hand-off, and the end. The run record closes it
  when no event did. Identical consecutive steps collapse; a specialist's own
  "Took a hand-off" start is not repeated. Three entries show by default.
- **Stage.** A fresh hand-off or return (under 15 seconds old) lights the
  receiving Olympian for 1.6 seconds through the existing agent highlight; old
  history never replays as motion.

Genuine hand-offs exist only in Ask Olympus (`work-request`): Zeus plans, hands
to Athena and Themis as child skill runs, and writes the answer. Other work
(briefs, single-agent skills, background jobs, coding delegation) shows as one
Olympian's operation with its steps.

The mission brief in the console repeats the running operation as a short
checklist (`deckStages`) and its next step. The step-by-step feed (`AgentActivityFeed`), the
source access history and the asset inspector are in the **Diagnostics** dialog,
opened from the deck. The deck starts nothing itself: work is asked for in the
chat (or by voice), and `/ask` hands a request to Zeus.

The Pantheon figures read the same feed. `activityMissions` presents each observed
run as a single-step mission naming its agent, which the existing figure state
machine already understands: a figure is assigned when its agent's run appears,
works while it is in progress, and marks completion when the run reports a result.
Zeus coordinates while any run is live. Observed runs move the figures only; they
do not join the orbiting missions.

There are no run buttons. Kevin removed Deploy Agent on 2026-11-13: he talks to
Olympus only through the chat and the microphone. The opening-brief trial and
"Answer from my sources" remain in the catalog and can be started only through
the development inbox.

## Verification

`cargo test --lib agent_events` covers normalization, the two privacy rules
above, and storage order and paging. `scripts/test-agent-events.mjs` covers the deck model (planning, hand-off, queue, failure, concurrent runs, no invented progress) and
merging, grouping, the working-agent rule, the figure transitions against the real state machine, and skill run bookkeeping. No delegated run has been
executed with this in place, so the feed has not been seen with live data.
