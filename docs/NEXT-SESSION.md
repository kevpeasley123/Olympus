# Next session

The current handoff. Rewrite it, don't append to it: at the end of a session
that changes state and at every release (see "Keeping guidance current" in
`AGENTS.md`). History is in `docs/RELEASES.md` and `docs/archive/`; the log this
file replaced is `docs/archive/NEXT-SESSION-through-2026-10-11.md`.

## State — 2026-10-12

- **Version 0.30.0** on `master` (`b288ddf`). Kevin confirmed on 2026-10-12
  that it is installed on his PC and in daily use.
- **In flight:** `claude/modest-mayer-nvawru` — guidance-doc cleanup, the
  `scripts/test-guidance-docs.mjs` drift check, and removal of proven dead
  weight. Not merged.
- Every remote branch that is ahead of `master` predates the 2026-09-07 history
  restart and shares no history with it; all are superseded.

## Last verification — 2026-10-12, Linux cloud container

Not the desktop app, WebView2, Tauri IPC or real data.

- `npm run build` passes, with the existing warning that the main chunk exceeds
  500 kB.
- `cargo test --lib`: 521 passed, 18 ignored. On Linux this needs
  `libwebkit2gtk-4.1-dev` and `libgtk-3-dev`.
- All 44 `scripts/test-*.mjs` pass, but 12 of them only after a workaround (see
  Known issues).
- `npm run visual:review`: 21 of 21 captures pass the mechanical checks, but they
  show the old Command composition (see Known issues).

## Decisions waiting on Kevin

1. **Chat memory and dashboard exports.** These features have no button but
   still work in the backend:
   - "Save to memory" (append to `04 - Decisions/Decision Log.md`) and the
     Observation button were removed from chat on 2026-10-11 (`74fd5de`,
     `a155cd5`).
   - Update Canvas went in 0.29.0. View Database is unreachable, because
     `LibraryPanel` only shows it when it is not `resident`.

   Either bring them back or remove the code and its docs. Until Kevin decides,
   none of it is removed as dead weight.
2. **Release-line wording.** "Not accepted in the desktop app" confused Kevin,
   who runs every release. Proposed replacement: record when a version is
   installed, and list only the paths that have never run against real data.
3. **Schema migrations.** There is no schema version (see `ARCHITECTURE.md`,
   "Schema evolution"). Proposed fix:
   - Track a version with `PRAGMA user_version` and keep an ordered list of
     migrations, run in one transaction after backing up the database file.
   - Fold the existing `process_id` check into that list.
   - Add a test that migrates an old database and requires it to end up
     identical to a fresh one.
   - Dropping the unused tables would be the first migration.
4. **Project brief commit.** `confirm_project_brief` writes through the gate
   but makes no vault Git commit, unlike every other writer. Proposed: commit
   it like the others, and add a test.
5. **Armory expansion and Monid**, requested 2026-10-07. Not started; no Monid
   code exists. The spending policy is in `OLYMPUS-MANUAL.md`. The earlier
   step-by-step plan is the first section of the archived log.
6. **Home semantic navigation.** Approved as an independent slice, not
   started. The only written design is the Semantic Zoom section and Phase 4 of
   `docs/archive/SKILLS-GRAPHS-INSPECTION-PLAN.md`.
7. **One paid Research run from the UI**, once API credit is available.

## Known issues

- **Visual review covers the wrong screen.** `npm run visual:review` drives
  `command-agent-harness.html` without `?flagship`, so it captures the
  pre-October-7 Agent Catalog and orbital cards, not the shipped Command. The
  shipped composition is covered only by ad hoc scripts, which nothing runs
  automatically. Two of them fail at `b288ddf` on stale assertions:
  - `scripts/flagship-review.mjs` expects the two inner rings, which have been
    hidden since 0.25.0.
  - `scripts/mission-review.mjs` looks for "Obsidian constellation", which is
    now "Obsidian Memory constellation".
- **Stale fixture.** `src/services/capabilitiesFixture.json` predates
  `hephaestus-engineering` and lists 7 skills, so browser previews show one
  fewer than the desktop app.
- **Tests only run on Kevin's machine.** 12 browser test scripts hard-code
  `channel:'msedge'`, and 11 of them expect a dev server already running on
  `127.0.0.1:31420` (one uses `31448`). There is no `npm test` and no CI.
- **Unreachable views.**
  - The knowledge audit has no entry point: `KnowledgeAudit` is rendered only
    by its harness.
  - The voice conversation control was unmounted the day it was added and
    lives only in `src/voice-control-harness.tsx`.
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

- A Coding Delegate (Hephaestus) run that completes, and Organizer acceptance
  of its real result.
- A paid Research / Verification run from the UI.
- Live-provider skill guidance.
- Process-crash timing, and running an older binary against a newer database.
