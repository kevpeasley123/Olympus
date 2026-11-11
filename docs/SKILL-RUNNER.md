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

## A run

1. `start_skill_run(skillId, engine)` records a row in `agent_runs`
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
- Before the prompt is sent, the Olympus server must be the only MCP server.
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

No skill has been run against Claude Code. Three things are therefore unproven:
whether `--safe-mode` and `--restricted` still load an MCP server named by
`--mcp-config`; what status the server reports before the prompt; and what a
real brief costs against the Claude headless credit. Each fails closed: a run
whose session does not match the expected shape stops before any answer is
accepted.
