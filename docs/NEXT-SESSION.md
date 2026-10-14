# Next session

The current handoff. Rewrite it, don't append to it: at the end of a session
that changes state and at every release (see "Keeping guidance current" in
`AGENTS.md`). History is in `docs/RELEASES.md` and `docs/archive/`; the log this
file replaced is `docs/archive/NEXT-SESSION-through-2026-10-11.md`.

## State — 2026-10-13

- **Version 0.34.0** on `master`, released through "Bring everything current"
  from `claude/project-thread-lp4tw8`. Kevin confirmed on 2026-10-12 that
  0.30.0 was installed and in daily use; whether 0.31.0 to 0.34.0 are
  installed is not yet confirmed.
- **0.34.0** brings in the **Living Pantheon**
  ([PANTHEON-FIGURES.md](PANTHEON-FIGURES.md)): the five agents stand around
  the Omega in Command as small marble and gold statues (Zeus above it, Athena
  and Hephaestus upper left and right, Dionysus and Themis lower left and
  right).
  - The statues are built in Blender by `scripts/pantheon/build_figures.py`
    and skinned in the app to one shared skeleton, so one set of clips and an
    independent idle behaviour drive all five.
  - Each god works, waits, completes or slumps only from recorded mission
    steps; Zeus sends a pulse when a step is assigned and receives one when it
    completes. Clicking a god opens its Armory loadout.
  - The Agents constellation moved below the Omega, right of Obsidian Memory.
- **Earlier releases.**
  - 0.33.0 brought conversations and memory
    (`docs/CONVERSATIONS-AND-MEMORY.md`) and the voice signal beneath the
    Omega.
  - 0.31.0 recorded the Armory direction and built Phase 0b (engine sign-in
    checks, turn limits for delegated Claude Code; `docs/ARMORY-PLAN.md`).
  - 0.32.0 was the guidance cleanup and the removal of proven dead weight.
- Every other remote branch ahead of `master` predates the 2026-09-07 history
  restart and shares no history with it; all are superseded.

## Last verification — 2026-10-13, Linux cloud container

The 0.34.0 merge:
- `cargo test --lib`: 539 passed, 18 ignored;
- `npm run build`;
- all 48 `scripts/test-*.mjs`, the browser ones on headless Chromium
  through a shim that drops `channel:'msedge'`;
- `npm run visual:review`: 21/21 captures, 14 functional checks and 22
  Organizer checks.

Not the desktop app, WebView2, Tauri IPC or real data. The statues have been
seen only in Chromium with software WebGL.

## In flight

- **Pantheon skins** on `claude/project-thread-lp4tw8`, not released: four
  material presets for the gods (Aged Bronze default with crisp white
  garments; Obsidian Gold; Mythic Color; Celestial starfield), baked occlusion
  and form shading, back and contact shadows, a stronger hover synced with the Armory
  with a gold halo behind the hovered god, and the Agents constellation removed. Waiting on Kevin's choice of
  skin; the comparison picker ships until he picks (`COMPARING`). See
  [PANTHEON-FIGURES.md](PANTHEON-FIGURES.md).

## Next

1. **Look at the Living Pantheon on the PC** after Update Olympus. All five
   gods should stand on their pedestals and idle out of step with each other.
   Under software WebGL the statues took 20 to 30 seconds to appear; note how
   long they take in WebView2 and whether a pedestal stays empty (a model that
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

- The Living Pantheon in WebView2, and any god driven by a real mission step.
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
