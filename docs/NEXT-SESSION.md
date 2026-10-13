# Next session

The current handoff. Rewrite it, don't append to it: at the end of a session
that changes state and at every release (see "Keeping guidance current" in
`AGENTS.md`). History is in `docs/RELEASES.md` and `docs/archive/`; the log this
file replaced is `docs/archive/NEXT-SESSION-through-2026-10-11.md`.

## State — 2026-10-13

- **Version 0.32.0** on `master`, released from `claude/modest-mayer-nvawru`
  through "Bring everything current". Kevin confirmed on 2026-10-12 that 0.30.0
  was installed and in daily use; whether 0.31.0 and 0.32.0 are installed is
  not yet confirmed.
- **0.31.0** (another session, `claude/bold-ptolemy-bwywj1`) recorded the
  Armory direction and built Phase 0b:
  - Codex and Claude Code are found and their sign-ins checked (`engines.rs`,
    Preferences > Subscription engines).
  - Delegated Claude Code refuses to start without a confirmed subscription and
    runs within turn limits instead of a dollar budget.
  - See `docs/ARMORY-PLAN.md`.
- **0.32.0** brings in:
  - the guidance cleanup and its drift check;
  - removal of the chat memory writers, the dashboard exports and proven dead
    weight (with a before/after style proof on 51 screens);
  - the project-brief vault commit;
  - a visual review of the shipped Command.
- **In flight, not released: conversations and memory**, on
  `claude/modest-mayer-nvawru`. Kevin approved it on 2026-10-13. See
  `docs/CONVERSATIONS-AND-MEMORY.md`.
  - Versioned schema migrations, with a backup before each upgrade
    (`docs/SCHEMA-MIGRATIONS.md`).
  - Separate, searchable chats, with New chat and Temporary chat.
  - Each chat saved to `10 - Conversations/`.
  - An automatic memory note, `09 - System/Olympus Memory.md`.
  - Recall of earlier chats.
  - Preferences > Memory.
- Every other remote branch ahead of `master` predates the 2026-09-07 history
  restart and shares no history with it; all are superseded.

## Last verification — 2026-10-13, Linux cloud container

The conversations-and-memory branch:
- `cargo test --lib`: 539 passed;
- `npm run build`;
- the guidance and acceptance-seed scripts;
- the full visual review (21 captures, 14 functional checks), including chats,
  chat search and Preferences > Memory;
- an independent code review, whose findings are fixed.

Not the desktop app, WebView2, Tauri IPC or real data.

## Next

1. **Release conversations and memory** when Kevin says "bring everything
   current". After installing, on the PC:
   - the first launch migrates his database and writes
     `olympus.sqlite.pre-v2-from-v1.bak` beside it;
   - old history appears as chats in the Chats list;
   - over the following minutes, chat notes appear in `10 - Conversations/`,
     each with its own vault commit;
   - a chat left quiet for ten minutes updates `09 - System/Olympus Memory.md`.
2. **Armory Phase 0 on the PC.** Open Preferences > Subscription engines. Both
   engines should be found and show a subscription. If either shows "Not
   confirmed", record the output of `claude auth status --json` or
   `codex login status`, so the parser can learn that shape.
3. **Armory Phase 1, the engine layer**, per `docs/ARMORY-PLAN.md`, after the
   engine spike runs on the PC. Monid belongs to Phase 3b; the spending policy is
   in `OLYMPUS-MANUAL.md`, and the earlier step-by-step plan is the first
   section of `docs/archive/NEXT-SESSION-through-2026-10-11.md`.
4. **Home semantic navigation.** Approved as an independent slice, not
   started. The only written design is the Semantic Zoom section and Phase 4 of
   `docs/archive/SKILLS-GRAPHS-INSPECTION-PLAN.md`.
5. **One paid Research run from the UI**, once API credit is available.

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
