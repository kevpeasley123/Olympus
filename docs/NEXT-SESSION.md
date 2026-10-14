# Next session

The current handoff. Rewrite it, don't append to it: at the end of a session
that changes state and at every release (see "Keeping guidance current" in
`AGENTS.md`). History is in `docs/RELEASES.md` and `docs/archive/`; the log this
file replaced is `docs/archive/NEXT-SESSION-through-2026-10-11.md`.

## State — 2026-10-14

- **Version 0.35.0** on `master`, from `claude/project-thread-lp4tw8`. Kevin
  confirmed 0.34.0 running on his PC on 2026-10-13 (screenshot); 0.35.0 was
  installed there by `npm run update` the same evening.
- **0.35.0** gives the Pantheon statues skins and depth
  ([PANTHEON-FIGURES.md](PANTHEON-FIGURES.md)): four material presets with a
  picker that ships until Kevin chooses one (then make it the default and set
  `COMPARING` to false in `src/services/pantheonSkins.ts`), baked occlusion,
  form shading, shadows, and a hover lift with a gold halo. The Agents
  constellation is gone.
- **Earlier releases.** 0.34.0 brought the Living Pantheon; 0.33.0
  conversations and memory (`docs/CONVERSATIONS-AND-MEMORY.md`) and the voice
  signal; 0.31.0 Armory Phase 0b (`docs/ARMORY-PLAN.md`).
- Every other remote branch ahead of `master` is older than the 0.34.0 release
  or predates the 2026-09-07 history restart; all are superseded.

## Last verification — 2026-10-14, Linux cloud container

The 0.35.0 branch, with `master` already merged in:
- `cargo test --lib`: 539 passed, 18 ignored;
- `npm run build`;
- all 48 `scripts/test-*.mjs`, the browser ones on headless Chromium
  through a shim that drops `channel:'msedge'` (`test-eleven-browser` given
  the dev server URL);
- `npm run visual:review`: 21/21 captures, 14 functional checks and 22
  Organizer checks.

Not the desktop app, WebView2, Tauri IPC or real data. The statues and skins
have been seen only in Chromium with software WebGL.

## In flight

- **Skin choice.** Kevin is comparing the four skins in the installed app.
- **Pantheon tidy-up, unreleased**, on `claude/project-thread-q68cad`, asked
  for by Kevin from a 0.35.0 screenshot: the hover card and the three-verb line
  under each god are removed, the skin picker is a dim mark in the scene's
  bottom left that opens on a click, and Zeus's bolt is a flat zigzag blade
  without prongs. Blender is not on the PC, so `zeus.glb` was edited directly
  (Limits in PANTHEON-FIGURES.md). Seen in Chromium through the dev server
  only. Release it with "bring everything current".
- **A live view on Kevin's PC.** A Remote Control session running
  `npm run tauri dev` from the branch was offered on 2026-10-14 so he can
  watch visual edits without installing; not yet approved.

## Next

1. **Look at the Pantheon on the PC** after Update Olympus. Switch skins under
   the Omega, hover each god and its Armory row, and note how long the statues
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
