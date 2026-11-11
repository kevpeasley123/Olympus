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
| `runId` | The owning run's id in its own table (a delegation run today) |
| `engine` | `claude-code` today; `codex` and `ollama` when their adapters report |
| `agent` | The Armory role credited, for example `coding-delegate` (Hephaestus) |
| `kind` | `run_started`, `thinking`, `message`, `file_read`, `file_edit`, `search`, `command`, `subagent_started`, `tool_call`, `tool_failed`, `result`, `error` |
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
| Codex | Not wired. How much its stream reveals is untested. |
| Local models | Not wired. They have no agent loop yet. |
| Chat, briefs, memory and research jobs | Not wired. They are single text requests with tools off, so they have no steps to report. |

## Interface

`src/services/agentEvents.ts` holds a bounded feed (the newest 200 events),
groups it by run (runs in progress first), and derives which agents are working: a run is in progress
until it reports its own `result` or `error`; a helper's result does not end its
parent. `AgentActivityFeed` renders the feed inside Command's **Agent activity**
disclosure, above the source access history.

The Pantheon figures do not read this stream yet.

## Verification

`cargo test --lib agent_events` covers normalization, the two privacy rules
above, and storage order and paging. `scripts/test-agent-events.mjs` covers
merging, grouping and the working-agent rule. No delegated run has been
executed with this in place, so the feed has not been seen with live data.
