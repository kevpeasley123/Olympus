# Next session

Current handoff; prior verification is in `archive/NEXT-SESSION-through-0.40.0.md`.

## State - 2026-10-18 (America/Phoenix)

- **Version 0.41.0 prepared; 0.40.0 installed** on `codex/engine-status-usage`, based
  on master `218e6e09a19614b379e3456f63953c3d1c2be7fd`. Kevin authorized merging
  the full delivery branch to master and installing on October 18.
- Codex transport root cause: desktop servers use private stdio; the expected
  shared daemon socket is absent. The fix uses a bounded private-stdio account
  reader with verified disabled integrations and no daemon or config changes.
  See `ENGINE-STATUS-USAGE.md`. Seven focused tests and independent review passed.
- Real Olympus Rust read at 2026-10-17 21:56:03 Phoenix: 70.0% weekly used,
  30.0% remaining, 62.6701 credits; reset October 24 17:04:59 Phoenix.
  Absolute token allowance unknown. Returned lifetime activity is separate.
- Release checks: production MSI built; 561 Rust tests passed (20 ignored);
  all 61 scripts passed, including the Organizer startup-timeout retry with
  unchanged assertions (10 contract and 22 browser checks). Full visual review
  passed 21/21 captures, 14 functional and 22 Organizer checks. Browser
  screenshots preserve the existing design; native acceptance remains separate.
  Installed version remains 0.40.0 pending merge and installation verification.
- Claude passive collector remains enabled with original statusline preserved.
  Reversible backups are in `%USERPROFILE%/.claude/olympus-quota`. First real
  Claude sample awaits ordinary authorized activity; app loads it on Refresh.
- ElevenLabs reader preserved. Last verified quota GET at 20:36:23 Phoenix:
  975 used, 22,761 remaining characters; reset November 6 11:09:07 Phoenix.
- No paid generation, reset, purchase, new credentials, existing-process restart,
  security/network setting change or production app launch was performed.
- Native WebView2 Refresh remains unverified. Existing background analysis,
  speech and memory settings remain unchanged. Subscription generation/delegation
  still fail closed on billing/tool isolation; this fix grants no inference access.

## In flight
- **Development branch delivery (October 17, Phoenix):** engine discovery, separate always-visible Command usage panel, subscription/API management reusing Preferences and Armory, and offline-tested Codex conversation adapter; see `ENGINE-STATUS-USAGE.md` and `SUBSCRIPTION-CONVERSATION.md`. Subscription generation remains blocked on billing and tool isolation; Codex telemetry now has a real backend reading. Installed without launch.
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
