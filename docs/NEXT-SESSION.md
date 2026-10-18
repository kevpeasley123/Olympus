# Next session

Current handoff; rewrite at milestones per `AGENTS.md`. History: `docs/RELEASES.md` and `docs/archive/`.

## State - 2026-10-17 (America/Phoenix)

- **Version 0.39.0 installed** on `codex/engine-status-usage`, based on master
  `218e6e09a19614b379e3456f63953c3d1c2be7fd`. No master merge authorized.
- Build commit `b29f15c8c48139868d4ae5c5cb3f946b436a8e18` pushed and remote-verified.
  Includes engine discovery, Usage, subscription/API management, the offline-tested
  Codex conversation adapter, and explicit read-only account Refresh. See
  `ENGINE-STATUS-USAGE.md` and `SUBSCRIPTION-CONVERSATION.md`.
- Installed through the supported local MSI installer without launch. Windows
  registry/executable version and exact extracted MSI payload match. Production
  SQLite hash unchanged; 0.38.0 executable/MSI and integrity-checked database
  rollback copies retained in the delivery checkout's ignored output directory.
- Subscription generation/delegation remain blocked by billing and tool isolation;
  Claude conversation is unfinished. No extra credits/refill authorized.

## Verification - 2026-10-17, Windows

- Production/MSI build, TypeScript and guidance checks passed. Rust: 556 passed,
  20 ignored; final telemetry tests: 4 passed, 2 ignored.
- All 58 release test scripts passed after targeted reruns for engine navigation
  (isolated dependency cache) and Organizer initial load (90 seconds); assertions unchanged.
  Organizer's 10 contract and 22 browser workflow checks passed on that rerun.
- Visual regression: 21/21 captures, 14 functional and 22 Organizer checks.
  Refresh, retained readings, management round trips, responsive layout and
  keyboard behavior verified with synthetic browser fixtures. Independent review
  findings fixed and re-reviewed.
- Installed executable SHA-256:
  `5c8505cad16de6a632462fa230d5f7b6034e641124971eb339a73997dbf0b941`.
  Matches extracted MSI payload; no Olympus process after installation.
- Native WebView2 Refresh, successful live quota and provider generation remain
  unverified. No production launch: existing background analysis, opening speech
  and memory-learning settings remain unchanged.
## Percentage formatting delivered
- One decimal in compact labels, expanded rings and window details; raw values
  unchanged. Fractional/0/100/unknown and 360px layout checks pass. Installed
  without launch; native WebView2 rendering remains unverified here.
## Live telemetry blockers
- ElevenLabs quota GET succeeded after Kevin confirmed User access enabled.
  Observed 2026-10-17 20:36:23 Phoenix: 975 used, 22,761 remaining characters;
  reset November 6 11:09:07 Phoenix. Backend verified, installed UI not exercised here.
- Codex expected control socket absent; app-server lacks `--ignore-user-config`.
  No fresh server, restart or generation. Claude uses an honest account link.
  Details in `ENGINE-STATUS-USAGE.md`.

## In flight
- **Development branch delivery (October 17, Phoenix):** engine discovery, separate always-visible Command usage panel, subscription/API management reusing Preferences and Armory, and offline-tested Codex conversation adapter; see `ENGINE-STATUS-USAGE.md` and `SUBSCRIPTION-CONVERSATION.md`. Subscription generation remains blocked on billing and tool isolation; telemetry is not connected. Installed without launch.
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
- **Leftovers.**
  - `gmail_workspace` still returns `signals`, which the UI no longer renders.
  - A quota test message in `gmail/auth.rs` still says ten minutes; the budget
    is 30.

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
