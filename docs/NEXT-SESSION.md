# Next session

## Olympus 0.56.0 - merged November 13, 2026, not yet installed

0.54.0, 0.55.0 and 0.56.0 (pull requests 38, 39, 40) are merged; none has been
installed. Install with `npm run update` from `Desktop/Projects/Olympus`; the
"Update Olympus" desktop shortcut needs recreating. Until then the installed 0.53
cannot open the database: the development build already moved it to schema 10. A
copy from before that is beside it, `olympus.sqlite.pre-v9-from-v7.bak`.

Testing without Kevin: while `npm run tauri dev` is running on his PC, a session
linked to it can pull into the checkout (the dev build rebuilds itself), drop a
skill or chat request into `<app data>/dev-inbox` and read the result from `olympus.sqlite`
(SKILL-RUNNER.md, "Development inbox"). Each run spends his Claude usage. Use it
instead of asking him to click.

## Direction

Set by Kevin on November 11: Olympus is an orchestrating harness over Codex,
Claude Code and local models, with all agent work visible. Briefing and
Gmail-analysis work is paused while the harness is built; the opening brief is
the first workflow to move onto it. He approved engines using Olympus's own
read-only tools, and retiring the paid API routes and the ChatGPT plan prototype.
He selects the engine himself; automatic, cost-aware routing comes later.

## What 0.54.0 to 0.56.0 contain

- One agent event stream ([AGENT-EVENTS.md](AGENT-EVENTS.md)), fed by Claude Code
  delegation, background jobs and skill runs. The Pantheon figures move on it.
- A read-only tool server inside the executable ([OLYMPUS-TOOLS.md](OLYMPUS-TOOLS.md)).
- A skill runner on the Claude Code subscription ([SKILL-RUNNER.md](SKILL-RUNNER.md)):
  opening brief (trial), "Answer from my sources", "Ask Olympus".
- Olympian profiles and hand-offs ([OLYMPIANS.md](OLYMPIANS.md)): Zeus plans, hands
  parts to Athena and Themis as linked runs, and answers from their reports.
- Citations marked verified only when the run asked for or was shown what they name.
- The Activity Deck: Command's left column, built from recorded runs. The Armory
  opens from its header; the step record is under Diagnostics; skills run from
  Deploy Agent.
- Observed usage per engine, from what each run reported.
- 0.55.0: `/ask` in the chat, `partly_holds`, long notes in parts, scoped planning,
  survival of an invented tool name, and the development inbox.
- 0.56.0: read-only tools in the Claude Code chat, answers cut to their bounds
  rather than rejected, tolerance of unoffered tool names, Themis reading the
  project list.

## Real runs, Kevin's PC, development build

- November 11: "Answer from my sources" completed (nine tool calls, about $0.06)
  and cited the learned record by path, closing the November 9 recall check for
  skills. The opening-brief trial completed (seven tool calls, about $0.10).
- November 12: "Ask Olympus" completed with Athena and Themis both reporting
  (25 tool calls, 66 seconds, about $0.29 over four engine runs). Kevin confirmed
  the Activity Deck showed the hand-offs and the stage count as they happened.
- November 13: `/ask` worked from the chat; an inbox-started run completed with
  Themis reading in parts and returning `partly_holds` (about $0.20, 47 seconds).
- November 13, through the inbox: chat turns with and without lookups, and an
  orchestrated request on a new question with all three Olympians completing
  (27 tool calls, 64 seconds, about $0.35).
- Failures met and fixed on the way: `--safe-mode` disabling the tool server, a
  usage-limit notice misread as a model change, schema length caps rejecting sound
  answers, and a model calling a nonexistent "submit" tool.

## Known issues

- The Claude Code chat has the read-only tools; the Codex chat does
  not, so it still cannot open notes. `/ask` remains the way to get a checked answer.
- Hand-offs run one after another, never in parallel. A run cannot be cancelled.
- The Usage dock reads "Telemetry not connected". Observed usage is not shown there.
- The learned record for the briefing preference has empty evidence text.
- Gmail's refresh grant was rejected on November 11 and needs reconnecting.
- The browser and visual suites hang on a mode switch in the cloud session, on
  0.53 as well. They have not been run on the PC for this release.
- 47 old branches remain on GitHub; a cloud session cannot delete them.

## Next steps

1. Install 0.56.0 and repeat one "Ask Olympus" run in the installed app.
2. Run the browser and visual suites on the PC.
3. Give the Codex chat the same tools through its app-server.
4. Decide whether `/ask` needs a button or an automatic choice.
5. Move the opening brief itself onto the skill runner, beside the old path first.
6. Retire the paid API routes. They are woven into the chat dispatch in
   `assistant.rs`; `voice.rs` separately uses an OpenAI key for realtime speech,
   which is not a reasoning route. This needs a session that can run the app.
7. Codex and local models as skill engines; usage telemetry in the dock.

## Open decisions

- Kevin has not yet reviewed the vision document; the vault's project notes still
  describe the earlier direction.
- Whether "Ask Olympus" should hand off less eagerly: Zeus read the same notes
  himself before handing them to Athena, so the request cost four runs.

## Standing boundaries

`Desktop/Projects/Olympus` is the only checkout; the former one is archived under
`Documents/New project`. No paid API fallback. Sources and recommendations never
grant authority. Olympus must be open and the PC awake for background work. Local
qwen3 extraction and investigation remain unqualified. No mailbox mutation, live
OAuth revoke, paid API call or private-vault push has occurred in this work.
Kevin wants concise conversational briefs: relevant changes, implications, whether
he needs to act; that copy refinement is still pending.
