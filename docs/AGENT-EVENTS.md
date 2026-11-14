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

Command's left column is the **Activity Deck** (`ActivityDeck`, model in
`src/services/activityDeck.ts`). It is built only from skill runs and this
feed:

- **Operation**: the newest run in progress, else the most recent finished one.
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
- **Idle agents**: everyone else, with the catalog's own readiness. A planned
  role says Planned.
- Mission steps recorded outside the skill runner (research, coding delegation)
  show their agent as Running, or Blocked while waiting on approval.

The mission brief in the console repeats the running operation as a short
checklist (`deckStages`). The step-by-step feed (`AgentActivityFeed`), the
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
