# Skill runner

A skill is a contract: a goal, the tools it may use, a budget and a test of its
answer. The runner starts the selected engine in tool mode with Olympus's own
read-only tools ([OLYMPUS-TOOLS.md](OLYMPUS-TOOLS.md)), passes every step to the
activity stream ([AGENT-EVENTS.md](AGENT-EVENTS.md)), and accepts the answer
only if it passes the skill's test.

This is how workflows move off hand-built pipelines: the opening brief is the
first, as a trial that runs beside the existing brief and replaces nothing.

## Skills

Skills are compiled into `commands/skill_runner.rs`. Each publishes a
`SkillContract` (`commands/workflow.rs`) through `skill_catalog`; publishing a
contract grants no execution authority.

| Skill | Credited to | Tools | Budget | Accepted when |
| --- | --- | --- | --- | --- |
| `opening-brief` v1, "Opening brief (trial)" | `olympus` (Zeus) | `search_mail`, `read_mail_thread`, `recall_memory`, `list_projects`, `read_vault_note` | 16 turns, 5 minutes | The answer matches its schema, the brief is at most 140 words, and every item cites a tool this run actually called |
| `answer-from-sources` v1, "Answer from my sources" | `research` (Athena) | `recall_memory`, `search_vault`, `read_vault_note`, `list_projects`, `search_mail`, `read_mail_thread` | 22 turns, 5 minutes | The answer matches its schema, the run called at least one tool, and it cites only tools it called. Saying the sources do not answer the question is a valid result |

| `work-request` v1, "Ask Olympus" | `olympus` (Zeus) | `list_projects`, `recall_memory`, `search_vault`, `read_vault_note` | 12 turns per phase, plus up to two hand-offs | The final answer matches its schema and cites only tools called by this run or its hand-offs. See [OLYMPIANS.md](OLYMPIANS.md) |
| `research-assignment` v1 and `verification-assignment` v1 | Athena, Themis | Their profile's tools | 22 and 16 turns | Run only as a hand-off; not offered in the catalog |

A call to a name under Olympus's own server that the server does not offer (a
model sometimes invents a "submit" tool) does not stop the run: the server
refuses it, the model is told, and it can answer in text. Any tool outside
that server still stops the run. In an orchestrated run, Zeus's planning notes
and citations are passed to his final answer, so a failed hand-off does not
cost what he already read.

A chat message starting `/ask` (or `/zeus`) starts "Ask Olympus" on Claude Code
with the rest of the message as the request. The request is saved as the user's
turn, the Activity Deck shows the run, and the answer is appended and saved as
Olympus's reply with what stayed open, who it worked with and the sources. It
is explicit because a hand-off costs several engine runs. A Temporary chat
refuses it: a run records its request.

**Development inbox.** A debug build (`npm run tauri dev`) watches
`<app data>/dev-inbox`. A `.json` file there of the form
`{"skill": "work-request", "engine": "claude-code", "request": "..."}` starts
that run exactly as the interface would, with the same catalog, bounds and
account checks; the file is consumed and `<name>.result` holds `started <run id>`
or `refused <reason>`. It exists so a run can be started and its recorded result
read without someone at the window. Release builds do not contain it.
A file of the form `{"chat": "question"}` instead runs one conversation turn
through the same command the chat uses, with a one-message history; nothing is
saved to a chat, and `<name>.result` holds the model and the reply.

Every citation in an accepted answer carries `verified`: true when its
reference names a vault path or mail thread id the run asked a tool for or was
shown in a tool result, false otherwise. A search cited only by its query names
no file to check and is left unmarked. A false mark does not reject the
answer; the panel shows "(not confirmed against this run)" beside it. The
schema's length limits are abuse bounds, not style rules: a sound answer is
never rejected for being thorough.

Each skill runs under its Olympian's profile ([OLYMPIANS.md](OLYMPIANS.md)): the
profile's charter opens the system prompt, and the skill's tools and turns must
fit inside the profile's ceilings.

`answer-from-sources` takes a request: Kevin's question, at most 2,000
characters. It is passed to the model inside `<question>` tags as data, and the
skill's instructions say it is not an instruction to change anything. A skill
that takes no request ignores one.

This second skill is also the direct check on learned-memory recall: asked what
Olympus has learned, it can only answer by calling `recall_memory`, which
returns each record with its vault file path.

## A run

1. `start_skill_run(skillId, engine, request?)` records a row in `agent_runs`
   (migration 9) and returns it. One run per skill at a time. The engine is
   always named by the caller; nothing falls back to another.
2. A background worker launches the engine. Claude Code is the only engine
   wired: `claude_subscription::run_agent`.
3. Each stream frame is normalized into agent events and counted for the tools
   it calls.
4. `finish` applies the skill's schema and its own test. A rejected answer is
   not stored; the row records why. `agent-run-updated` is emitted.
5. A run still marked running at startup is closed as failed.

## Tool mode keeps every subscription check

`run_agent` uses the same hardened transport as subscription chat and jobs. A
tool run still requires the operator's account confirmation, a matching signed-in
account, no API key, the selected model, and Claude's own evidence that usage
credits are off. Tool mode changes only this:

- The MCP configuration names the Olympus tool server instead of none, and
  `--allowedTools` lists the skill's tools. Built-in tools stay off (`--tools ""`).
- `--safe-mode` is not passed. Safe mode disables every MCP server, including one
  named by `--mcp-config` (observed on Claude Code 2.1.322; the first real run on
  November 11 stopped for this reason). What it guarded is still enforced: no
  setting sources, an empty working folder, strict MCP configuration, no slash
  commands, and the checks below. One difference remains: a user-level
  `CLAUDE.md` may be read into a tool run's context.
- Before the prompt is sent, the Olympus server must be the only MCP server and
  must report `connected`. It starts as `pending`; the launch asks again every
  250 ms for up to about 20 seconds and stops if it never connects.
- The session must report only tools the skill allows, from that one connected
  server. Any other tool, server, plugin, helper agent or non-tool input stops
  the run.
- A run's answer is the text of its last message.

Text-only launches are unchanged and still refuse every tool signal.

## Not built yet

- **Codex and local models** as skill engines.
- **Cancelling** a run. It ends at its turn or time budget.
- **Using a result.** A completed trial brief is stored and shown for
  comparison; it is not spoken, not saved as the opening brief, and not learned
  from.

## Verification

`cargo test --lib skill_runner` and the tool-mode tests in
`claude_subscription` cover the contract, acceptance and rejection, run
bookkeeping, the launch arguments and the protocol with synthetic frames.

The pre-prompt handshake was exercised against Claude Code 2.1.322 on Linux with
no user message sent: with safe mode the server list is empty; without it the
Olympus server appears, moves from `pending` to `connected` within a few seconds,
and no commands are loaded.

No skill has completed a run against Claude Code. Still unproven: the session's
init frame in tool mode, a full turn with tool calls, the windowed Windows release
build serving tools over pipes (development builds have a console), and what a
real brief costs against the Claude headless credit. Each fails closed: a run
whose session does not match the expected shape stops before any answer is
accepted.
