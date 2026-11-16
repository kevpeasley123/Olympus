# Next session

## Olympus 0.84.0 - merged November 15, 2026

Kevin installed 0.82.0 on November 15: the brief passed all eight checks and
the first weekly review ran, proposing three brief instructions and two build
tasks, built in 0.83.0. Kevin set Email analysis on November 15 after
finding it under Subscription engines. Unconfirmed against real data:
- 0.84.0: the Email analysis choice moved into the Gmail connection panel.
- 0.83.0: usage-limit notice; every skill rewrites a rejected answer once.
- 0.82.0: email analysis route in Preferences. Email analysis has waited for
  a local model since November 10; Kevin picks a route to restart it.
- 0.81.0: proposals Kevin accepts become standing guidance or coding work;
  one retry per run for outside failures. Migration 12. VISION-REVIEW.md.
- 0.80.0: the weekly vision review (VISION-REVIEW.md). First run is due four
  minutes after Olympus next opens.
- 0.79.0: expectations, brief checks and the vision score; migration 11.
- 0.78.0: brief citation repair and one rewrite (BRIEFING-SYNTHESIS.md).
- 0.77.0: loop contracts and the weekly loop scorecard (docs/LOOPS.md). Next in
  the loop plan: the vision review loop (expectations from Kevin's words).
- 0.76.0: one-round verify-and-revise loop in Ask Olympus (SKILL-RUNNER.md).
- 0.75.0: chat checkpoint repair after Kevin hit
  `working_checkpoint_requires_operator_evidence` (CONVERSATIONS-AND-MEMORY.md).
- 0.74.0: operation timeline, hand-offs, next step and failure kinds in the
  Activity Deck (AGENT-EVENTS.md). Verify with one real /ask that hands off.
- 0.66.0 to 0.73.0: usage tiles, spoken brief, greeting, settled matters,
  voice lead-in, two visual passes, Import from X (proven: an article came in
  classified with 8 images) and the Armory tab. See RELEASES.md.
- 0.65.0: console cleanup and a self-reading Usage dock (ENGINE-STATUS-USAGE.md).

0.54.0 to 0.84.0 (pull requests 38 to 72) are merged. Kevin installed 0.58.0 on
November 13 and it opened almost unstyled: a brace lost from `activityDeck.css`
in 0.57.0 broke the joined production stylesheet. 0.59.0 fixes it and must be
installed with `npm run update` from `Desktop/Projects/Olympus`. The installed
build did open the schema-10 database.

The opening brief now runs on the Olympians workflow (0.60.0,
BRIEFING-SYNTHESIS.md). The Codex briefing path refuses with a purchased-credits
notice on Kevin's account and has produced no brief since November 13. Kevin
reconnected Gmail on November 14; mail is current again.

Local speech (Whisper and Kokoro) runs from `%APPDATA%\com.projectolympus.commandstation\local-voice` and
spoke again on November 14 (0.63.0 plus a runtime repair, SKILL-BACKBONE.md); it had
been silent since the November 10 checkout move. Installing needs Kevin to approve
the Windows administrator prompt; remote control cannot.

Before any release that touches CSS, render the production bundle
(`npm run build`, `npx vite preview`), not only the development harness: the
harness loads each stylesheet alone and hides this class of fault.

Testing without Kevin: while `npm run tauri dev` is running on his PC, a session
linked to it can pull into the checkout (the dev build rebuilds itself), drop a
skill or chat request into `<app data>/dev-inbox` and read the result from `olympus.sqlite`
(SKILL-RUNNER.md, "Development inbox"). Each run spends his Claude usage. Use it
instead of asking him to click. When Kevin tests, he does it by typing in the
chat window; never ask him to use another control.

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
  opening brief, "Answer from my sources", "Ask Olympus".
- Olympian profiles and hand-offs ([OLYMPIANS.md](OLYMPIANS.md)): Zeus plans, hands
  parts to Athena and Themis as linked runs, and answers from their reports.
- Citations marked verified only when the run asked for or was shown what they name.
- The Activity Deck: Command's left column, built from recorded runs. The Armory
  opens from its header; the step record is under Diagnostics. There is no
  Deploy Agent button (removed November 13 at Kevin's instruction): work starts
  from the chat.
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

- Asking for Athena or Themis in the chat routes by fixed phrases
  (`matchChatHandoff`), not by the model's judgment; a phrasing it does not know
  stays ordinary chat. Never driven from the interface.
- The Claude Code chat has the read-only tools; the Codex chat does
  not, so it still cannot open notes. `/ask` remains the way to get a checked answer.
- Hand-offs run one after another, never in parallel. A run cannot be cancelled.
- The Claude usage reading from Olympus's runs needs a Claude Code CLI that reports
  `unifiedWindows` utilization; an older CLI only records a window once it is spent.
  The Codex reader has not been seen succeeding on Kevin's account.
- The learned record for the briefing preference has empty evidence text.
- The browser and visual suites hang on a mode switch in the cloud session, on
  0.53 as well. They have not been run on the PC for this release.
- 47 old branches remain on GitHub; a cloud session cannot delete them.

## Next steps

1. Keep refining the brief against real ones: read each new brief in
   `agent_runs` and compare it with Kevin's mail and notes.
2. One chat hand-off in the installed app.
3. Run the browser and visual suites on the PC.
4. Give the Codex chat the same tools through its app-server.
5. Decide whether `/ask` needs a button or an automatic choice.
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
