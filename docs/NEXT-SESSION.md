# Next session

The current handoff. Rewrite it, don't append to it: at the end of a session
that changes state and at every release (see "Keeping guidance current" in
`AGENTS.md`). History is in `docs/RELEASES.md` and `docs/archive/`; the log this
file replaced is `docs/archive/NEXT-SESSION-through-2026-10-11.md`.

## State — 2026-10-12

- **Version 0.30.0** on `master` (`b288ddf`). Kevin confirmed on 2026-10-12
  that it is installed on his PC and in daily use.
- **In flight:** `claude/modest-mayer-nvawru`, not merged. It holds:
  - the guidance cleanup and its drift check;
  - removal of chat memory writers, dashboard exports and proven dead weight;
  - the project-brief vault commit;
  - visual review pointed at the shipped Command.
- Every remote branch that is ahead of `master` predates the 2026-09-07 history
  restart and shares no history with it; all are superseded.

## Last verification — 2026-10-12, Linux cloud container

Not the desktop app, WebView2, Tauri IPC or real data. Filled in from the
session's final run; see the branch's last commit message.

## Decisions waiting on Kevin

1. **Chat memory in Obsidian.** Kevin wants chats stored in the vault and
   remembered the way ChatGPT and Claude do. Today:
   - Chat is one continuous SQLite log on the PC.
   - The model sees only the last 40 messages, plus indexed recall over curated
     vault notes.
   - Chats are never written to the vault, and past chats are not searchable.

   This changes the settled "remembers, selectively" decision in `CLAUDE.md`,
   so the design needs his choices before building. It also needs the
   migration runner (item 2) for a conversation id.
2. **Schema migrations.** Designed in `docs/SCHEMA-MIGRATIONS.md`, deferred by
   Kevin until it can be done properly.
3. **Knowledge audit.** A fixed read-only check of research and evidence
   health. Its screen went in 0.30.0, and nothing can start it now. Kevin's
   view: it probably needs no screen. Retire it (code, three commands, two
   tables via a migration) or run it on a schedule later.
4. **Retired Command composition.** The Agent Catalog, the capability ring and
   the non-flagship paths in `CommandInstrument` are now reachable only from
   `command-agent-harness.html` without `?flagship`. Proposed: remove them and
   their CSS with the same before/after style proof used on 2026-10-12.
5. **Armory expansion and Monid**, requested 2026-10-07. Not started; no Monid
   code exists. The spending policy is in `OLYMPUS-MANUAL.md`. The earlier
   step-by-step plan is the first section of the archived log.
6. **Home semantic navigation.** Approved as an independent slice, not
   started. The only written design is the Semantic Zoom section and Phase 4 of
   `docs/archive/SKILLS-GRAPHS-INSPECTION-PLAN.md`.
7. **One paid Research run from the UI**, once API credit is available.

## Known issues

- **Tests only run on Kevin's machine.** 12 browser test scripts hard-code
  `channel:'msedge'`, and 11 of them expect a dev server already running on
  `127.0.0.1:31420` (one uses `31448`). There is no `npm test` and no CI.
- **One-off review scripts are stale.** `scripts/*-review.mjs` launch Edge only
  and nothing runs them; `mission-review.mjs` looks for "Obsidian
  constellation", now "Obsidian Memory constellation". `npm run visual:review`
  covers the shipped Command instead.
- **Stale fixture.** `src/services/capabilitiesFixture.json` predates
  `hephaestus-engineering` and lists 7 skills, so browser previews show one
  fewer than the desktop app.
- **No caller.** `clear_conversation`, `memory_status`, `memory_preview`,
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

- A Coding Delegate (Hephaestus) run that completes, and Organizer acceptance
  of its real result.
- A paid Research / Verification run from the UI.
- Live-provider skill guidance.
- A project brief saved since the 2026-10-12 vault-commit change.
- Process-crash timing, and running an older binary against a newer database.
