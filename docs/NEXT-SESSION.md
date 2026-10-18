# Next session

Current handoff; prior verification is in `archive/NEXT-SESSION-through-0.39.0.md`.

## State - 2026-10-17 (America/Phoenix)

- **Version 0.40.0 installed without launch** on `codex/engine-status-usage`, based
  on master `218e6e09a19614b379e3456f63953c3d1c2be7fd`. No master merge authorized.
- Passive Claude quota collector enabled after fresh settings/script comparisons.
  Original statusline and unrelated settings preserved; reversible backups in
  `%USERPROFILE%/.claude/olympus-quota`. See `ENGINE-STATUS-USAGE.md`.
- First real sample awaits ordinary authorized Claude Code activity. No test
  generation requested. Olympus Refresh reads the local file; missing/expired
  windows remain unknown and unchanged observations do not freshen the meter.
- Production/MSI build and TypeScript passed. Host Rust: 558 passed, 20 ignored.
  Sandbox failures resolved with the ordinary authorized host rerun.
- All 61 script checks passed after the targeted Organizer initial-load rerun
  (90-second wait, identical assertions). Visual regression: 21 captures passed
  after a fresh-browser Armory rerun resolved a resource-buffer error; full-run
  functional checks: 14 passed, Organizer: 22 passed. Collector/installer and
  mounted expiry fixtures pass. Independent final review found no blockers.
- Build commit `469aaf24b6aceccf25cd27ec5715279c7880eea5` pushed and remote-verified.
  Windows registry/executable version and exact MSI payload verified at 21:40 Phoenix.
  Installed executable SHA-256:
  `f066edda07f5504936a6787e0b059592da08c67e85fa2ea1c515da4e3160f9b0`.
  Production SQLite hash unchanged; no Olympus process running. 0.39.0 executable/
  MSI and integrity-checked SQLite rollback copies retained in ignored output.
- Subscription generation/delegation remain blocked by billing and tool isolation;
  Claude conversation is unfinished. No extra credits/refill authorized.

## Telemetry and acceptance limits

- ElevenLabs secure quota GET succeeded at 2026-10-17 20:36:23 Phoenix:
  975 used, 22,761 remaining characters; reset November 6 11:09:07 Phoenix.
  Reader preserved; no repeated provider probe for this release.
- Codex existing-daemon proxy exited 1 before a response: expected socket absent,
  Windows error 10050. Account access in Codex itself does not prove this connection.
  No restart, fresh daemon, security change or generation attempted.
- Percentages display one decimal, with raw precision retained. Absolute Claude
  token allowance remains unknown; browser observations are not seeded as telemetry.
- First real Claude capture, native WebView2 rendering/Refresh and generation remain
  unverified. Existing background analysis, speech and memory settings are unchanged.

## In flight
- **Development branch delivery (October 17, Phoenix):** engine discovery, separate always-visible Command usage panel, subscription/API management reusing Preferences and Armory, and offline-tested Codex conversation adapter; see `ENGINE-STATUS-USAGE.md` and `SUBSCRIPTION-CONVERSATION.md`. Subscription generation remains blocked on billing and tool isolation; Codex telemetry remains blocked. Installed without launch.
- **Skin choice.** Kevin is comparing the four skins in the installed app.
- **A live view on Kevin's PC.** Remote Control works on his PC (first used
  2026-10-14 to install 0.35.0). A session running `npm run tauri dev` from
  the branch would let him watch visual edits without installing.

## Next

1. **Look at the Pantheon on the PC** after Update Olympus. Switch skins from
   the dot in the scene's bottom-left corner, hover each god and its Armory row, and note how long the statues
   take to appear in WebView2 and whether a pedestal stays empty (a model that
   fails to load logs a warning). Start a delegated run to see Hephaestus work.
2. **Check 0.33.0 on the PC**, if not done.
   - The first launch migrates the database and writes
     `olympus.sqlite.pre-v2-from-v1.bak` beside it.
   - Old history appears in the Chats list. Over the next minutes, chat notes
     appear in `10 - Conversations/`, each with its own vault commit.
   - A chat left quiet for ten minutes updates `09 - System/Olympus Memory.md`.
   - Listen to a spoken reply and use the microphone. The waveform should
     follow the voice and settle in pauses, and the Omega should brighten
     slightly. If the bars keep their small ambient rhythm while audio plays,
     the analysis found no source; note which provider was speaking.
3. **Armory Phase 0 on the PC.** Open Preferences > Subscription engines. Both
   engines should be found and show a subscription. If either shows "Not
   confirmed", record the output of `claude auth status --json` or
   `codex login status`, so the parser can learn that shape.
4. **Armory Phase 1, the engine layer**, per `docs/ARMORY-PLAN.md`, after the
   engine spike runs on the PC. Monid belongs to Phase 3b; the spending policy is
   in `OLYMPUS-MANUAL.md`, and the earlier step-by-step plan is the first
   section of `docs/archive/NEXT-SESSION-through-2026-10-11.md`.
5. **Home semantic navigation.** Approved as an independent slice, not
   started. The only written design is the Semantic Zoom section and Phase 4 of
   `docs/archive/SKILLS-GRAPHS-INSPECTION-PLAN.md`.
6. **One paid Research run from the UI**, once API credit is available.

## Decisions waiting on Kevin

1. **Knowledge audit.** A fixed read-only check of research and evidence
   health. Its screen went in 0.30.0, and nothing can start it now. Kevin's
   view: it probably needs no screen. Retire it (code, three commands, two
   tables via a migration) or run it on a schedule later.
2. **Retired Command composition.** The Agent Catalog, the capability ring and
   the non-flagship paths in `CommandInstrument` are now reachable only from
   `command-agent-harness.html` without `?flagship`. Proposed: remove them and
   their CSS with the same before/after style proof used on 2026-10-12.

## Known issues

- **No reasoning on Kevin's PC.** On 2026-10-14 Sol showed "Unavailable": the
  desktop `.env` has no `OPENAI_API_KEY`, so typed and spoken replies fail and
  ElevenLabs reads the error. He is weighing API credits against Armory
  Phase 1 (subscription engines) and asked to hold Phase 1 for now.
- **Browser tests assume Kevin's machine.** 16 test scripts hard-code
  `channel:'msedge'`, and most expect a dev server already running on
  `127.0.0.1:31420` (one uses `31448`). A cloud session runs them on Chromium
  only through a preload shim. There is no `npm test` and no CI.
- **One-off review scripts are stale.** `scripts/*-review.mjs` launch Edge only
  and nothing runs them; `mission-review.mjs` looks for "Obsidian
  constellation", now "Obsidian Memory constellation". `npm run visual:review`
  covers the shipped Command instead.
- **Stale fixture.** `src/services/capabilitiesFixture.json` predates
  `hephaestus-engineering` and lists 7 skills, so browser previews show one
  fewer than the desktop app.
- **No caller.** `memory_status`, `memory_preview`,
  `memory_rebuild`, `list_organizer_tasks` and `communication_skills` are
  registered but nothing in the app calls them.
- **Project identity is split.** `organizer_tasks.project_id` references the
  legacy `projects` table, while linked projects live in `project_members`.
- **Unverified at ≥1500×800.** Situation maps size their inspector from the
  console column. Since the console became a dock this may collapse; it has not
  been rendered to check.
- **Wrong disclosure with the local model.** Situation-map "Understanding
  settings" says OpenAI analyzes the mail even when
  `OLYMPUS_EMAIL_ANALYSIS_PROVIDER=ollama` is set.
- **Monid text without Monid.** `SkillCollection.tsx` copy mentions Monid
  approvals, but no Monid integration exists.

## Never exercised against real data

These are recorded in the release lines and still open. Kevin's daily use
covers the screens he uses; these paths each need a deliberate trigger.

- The Living Pantheon and its skins, halo and hover in WebView2, and any god
  driven by a real mission step.
- A Coding Delegate (Hephaestus) run that completes under the turn limit, and
  Organizer acceptance of its real result.
- The engine sign-in checks against Kevin's real Codex and Claude Code installs.
- The voice signal against real ElevenLabs replies, realtime voice and the
  microphone in WebView2. The harness uses synthetic audio only.
- A paid Research / Verification run from the UI.
- Live-provider skill guidance.
- A project brief saved since the 2026-10-12 vault-commit change.
- Process-crash timing.
- Migration 2 on Kevin's real database, its backup, and the refusal when an
  older binary meets the migrated database.
- A paid memory pass, a chat note and memory note written to the real vault with
  their commits, and learning from earlier chats.
