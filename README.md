# Project Olympus

Project Olympus is a local-first AI command station for projects, research, workflows, reusable skills, and Obsidian-backed memory.

The canonical product vision and operating policy live in
[`OLYMPUS-MANUAL.md`](OLYMPUS-MANUAL.md). `CLAUDE.md` and `AGENTS.md` adapt that
one manual for their respective agent environments.

The recoverable coding-agent boundary, and the launcher that implements it, are
described in [`docs/AGENT-DELEGATION.md`](docs/AGENT-DELEGATION.md).

Current state and next steps are in [`docs/NEXT-SESSION.md`](docs/NEXT-SESSION.md);
releases, newest first, with what each has not had accepted in the desktop app,
are in [`docs/RELEASES.md`](docs/RELEASES.md). The
July 27, 2026 audit ([`docs/archive/AUDIT-2026-07-27.md`](docs/archive/AUDIT-2026-07-27.md)) is a
dated baseline, not the current state.

## V1 Shape

- Desktop shell: Tauri + React + TypeScript + Vite
- Visual identity: futuristic AI lab with professional command-center density
- Core screen: Command's Pantheon, an Ω instrument with mission planets and skill, plugin, agent and Obsidian-memory constellations, beside the Armory panel
- Modes: Command (Pantheon, Armory and console), Project (project cards, ecosystem view, Organizer tasks, project linking and coding-agent delegation), Research (the Pantheon research library and inspection of saved verification runs), and Communications (read-only Gmail, situation maps and briefings); the same chat console and voice run across all four
- Memory surface: Obsidian-flavored Markdown notes in the vault, plus a derived, rebuildable search index outside it. The backend can regenerate a projects Canvas and a research Base in `00 - Dashboard`; no button in the app currently triggers either
- Safety model: reads run freely. Vault writes pass the write gate described in `ARCHITECTURE.md`: out-of-vault paths are rejected, new files at unused paths and regeneration of unedited app-authored files proceed, and appends to or rewrites of notes a person may have written ask first. Delegated coding runs need an operator approval for planning and another for implementation, and never push, merge or deploy. Gmail access is read-only

## Obsidian Skills Reference

Olympus V1 uses the ideas from `https://github.com/kepano/obsidian-skills` as implementation guidance and seed content:

- `obsidian-markdown`: frontmatter, wikilinks, callouts, tags, and Obsidian-safe note formatting
- `json-canvas`: valid `.canvas` node and edge export structure
- `obsidian-bases`: future `.base` views for projects, research, tasks, and skills
- `obsidian-cli`: optional live Obsidian integration path, not required for V1
- `defuddle`: future clean Markdown extraction from web pages

The repo is not used as runtime code. Its guidance is represented in Olympus recipes and export helpers.

## Starter Vault

The clean Olympus Obsidian vault target is:

```text
C:\Users\kevpe\OneDrive\Desktop\Projects\Obsidian vaults\Olympus Obsidian Vault
```

Use `scripts/create-olympus-vault.ps1` to seed or repair the starter structure without overwriting existing notes:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\create-olympus-vault.ps1 -VaultPath "C:\Users\kevpe\OneDrive\Desktop\Projects\Obsidian vaults\Olympus Obsidian Vault"
```

## Codex Layer Setup

Use `scripts/implement-codex-second-brain.ps1` to add the Codex-native two-layer structure to the vault:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\implement-codex-second-brain.ps1 -VaultPath "C:\Users\kevpe\OneDrive\Desktop\Projects\Obsidian vaults\Olympus Obsidian Vault"
```

Use `scripts/scaffold-olympus-codex-project.ps1` to create a dedicated Layer 2 project workspace from the Codex project template:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\scaffold-olympus-codex-project.ps1 -VaultPath "C:\Users\kevpe\OneDrive\Desktop\Projects\Obsidian vaults\Olympus Obsidian Vault" -ProjectName "My Project"
```

## Run Locally

```bash
npm install
npm run dev
```

`npm run dev` is a browser preview without Tauri data. Use `npm run tauri dev`
for the real desktop runtime.

## Install and launch on Windows

The everyday Olympus launcher is the installed application, not Cargo's
development executable:

```text
C:\Program Files\Project Olympus\project-olympus.exe
```

Launch it from the taskbar or **Start > Project Olympus**. A shortcut that
targets `dev-target\olympus\debug\project-olympus.exe` is a development pin and
will eventually break because Cargo replaces that file during rebuilds.

After a new release version is committed in a clean canonical checkout, update
the same Windows installation with:

```bash
npm run install:local
```

The command builds the MSI, asks Windows for installation approval, updates the
stable executable, and repairs an existing Olympus taskbar pin if it still
targets the development build. The pinned target does not change between
releases.

`npm run update` (`scripts/update-olympus.ps1`) is the everyday path: it brings
the local checkout to `origin/master` and, when master is newer than the installed
app, builds and installs it through the same script. It stops on a dirty or
diverged checkout. Running the script with `-CreateShortcut` puts an **Update
Olympus** icon on the desktop that runs it.

## Delegate a coding task

In desktop **Project** mode, a project with a local folder has
a **Coding runs** section in its detail, with **Prepare Claude run**. An Organizer
task's **Start work** (under **Tasks & planning**, see
[`docs/ORGANIZER.md`](docs/ORGANIZER.md)) prepares the same planning proposal. When Olympus would refuse
a run (no Git repository, uncommitted work in the primary checkout, a run
already open on the project), the button is disabled and the reason is stated.
Prepare opens a draft task and acceptance criteria; the task starts from the
recorded next step only for active projects. **Review planning scope** shows the
exact subject, the permitted actions in words and a countdown to the proposal's
expiry. **Approve planning** creates a dedicated branch and isolated worktree
and asks Claude Code for a read-only plan.

Claude stops at a visible decision checkpoint. **Read the plan** shows it
without starting an approval window; **Review approval scope** and then
**Approve implementation** is the separate permission to edit and run bounded
local checks. **Stop run…** asks first. Progress shows planning, editing,
testing, reviewing, waiting, completion, or failure. Cancellation and app
restarts preserve the worktree. Olympus returns changed files and a reviewable
diff; it does not push, merge, deploy, or delete the workspace. (Button labels
corrected 2026-09-28; the earlier "Start planning" and "Approve and implement"
wording did not match the app.)

## Assistant Setup

Text and voice reasoning use OpenAI Responses from Rust. Add `OPENAI_API_KEY` to the ignored project-root `.env`; optional `ANTHROPIC_API_KEY` enables explicit Claude comparison. Delegated Claude Code runs never receive either key; they use Claude Code's own subscription login. Keys never reach the webview. API usage is billed separately from chat subscriptions.

- Default: Sol (`gpt-6-sol`, medium). The console's model control offers Deep Analysis (`gpt-6-astra`, high) and Claude comparison, applied to the next answer (then back to Sol) or to this chat until changed.
- `src-tauri/src/commands/models.rs` owns model IDs and routes. There is no automatic provider fallback.
- OpenAI requests use `store: false`, local history (last 40 messages, at most 120,000 characters), and shared Olympus/vault/project instructions. OpenAI Realtime handles microphone transcription and, unless ElevenLabs is the selected speech provider ([ElevenLabs voice](docs/ELEVENLABS-VOICE.md)), spoken output; it does not replace the reasoning layer.
- Preferences → Model diagnostics shows backend request records and reported token usage; assistant messages retain model provenance across reloads. Client-reported audio/transcription records are explicitly distinguished from confirmed reasoning model metadata.
- See [model routing](docs/MODEL-ROUTING.md) for contracts and verification limits.

## Desktop Build

Tauri requires Rust and Cargo.

```bash
npm run tauri dev
```

Rust is not bundled with this repo. Install it from `https://rustup.rs/` before running the desktop shell.

## Current Persistence

Persistence has one source of truth per runtime:

- **Desktop (Tauri):** SQLite, at `olympus.sqlite` in the platform app data directory. The connection is opened once at startup and the schema in `src-tauri/schema.sql` is applied on every launch, so the frontend can assume storage is ready.
- **Browser (`npm run dev`):** `localStorage`, unchanged.

What is stored, by area (`src-tauri/schema.sql` declares every table and sets
`PRAGMA foreign_keys = ON`):

| Area | Tables | Write pattern |
| --- | --- | --- |
| Settings and tool flags | `settings`, `tool_states` | Upsert on change |
| Chat history | `conversation_messages`, with `conversation_research`, `conversation_mail`, `conversation_voice`, `conversation_model`, `conversation_turn_context` and `conversation_imports` keyed by message ID | Append at send time; a re-append cannot rewrite content or provenance |
| Desktop session boundaries | `operator_sessions` | One idempotent row per launch |
| Vault write fingerprints and log | `artifact_hashes`, `processing_logs` | Written by the write gate |
| Delegation and approval | `delegation_runs`, `delegation_events`, `delegation_contracts`, `delegation_checks`, `delegation_reviews`, `operator_approvals`, `approval_consumptions`, `approval_revocations` | Durable run state, append-only milestones, immutable approval records |
| Organizer | `organizer_tasks`, `organizer_sources`, `organizer_proposal_links`, `organizer_run_links`, `organizer_results`, `organizer_events`, plus a row in `projects` for each project that holds tasks | Revisioned tasks with linked runs, reviewable results and an event log (see `docs/ORGANIZER.md`) |
| Project membership | `project_members`, `project_links`, `project_membership_state`, `project_identity_conflicts`, `project_brief_writes` | Revisioned membership; removals kept as tombstones; briefs staged before the vault write (see `docs/PROJECT-LINKING.md`) |
| Memory receipts | `request_memory` | One evidence packet per backend model request, never rewritten |
| Model diagnostics | `model_requests` | Prompt-free request records, including ElevenLabs speech records; no retention policy |
| Fixed workflows | `knowledge_audit_runs`, `knowledge_audit_events`, `research_verification_runs`, `research_verification_checkpoints` | One run row plus events or checkpoints |
| Reusable skills | `resource_skills` | One row per saved skill |
| Gmail | `gmail_accounts`, `gmail_messages`, `gmail_search` (FTS), `gmail_sync_runs`, `gmail_candidates` | Cache and history cursor commit in one transaction |
| Communications | `communication_runs`, `communication_events`, `communication_evaluations`, and six `communication_situation*` tables | Account-scoped; Remove cache deletes them with the mailbox |
| Removed | `tasks`, `research_items`, `skill_recipes`, `dashboard_modules`, `operator_briefs` | No longer created (2026-10-12); existing databases keep them, empty, until a migration drops them (`docs/SCHEMA-MIGRATIONS.md`) |

The indexed memory search cache is a separate, derived `memory-index.sqlite` in the app-local data directory; it can be rebuilt from the vault (see `docs/MEMORY-RETRIEVAL.md`).

The project scan is refreshed live and deliberately not persisted. Since 2026-09-28 the desktop app starts with no example projects: until the first scan settles the board says "Scanning projects…", a failed scan shows nothing rather than example data, and a later failure keeps the last genuine result marked stale. Only the browser preview shows labelled example projects.

Conversation is appended when a message is sent rather than rewritten alongside other state, so a long history costs nothing on unrelated updates. The first desktop launch after an existing browser install imports any `localStorage` state into SQLite automatically.

## Command renderer

Since 2026-09-28 a flat layer draws immediately and stays if WebGL is unavailable or fails: in the shipped Pantheon view that is an Ω glyph plus the skill, plugin, agent and Obsidian-memory constellations and mission targets, which are HTML rather than 3D. (The earlier flat project ring and day arc are not drawn in the Pantheon layout, which the app always uses.) The 3D scene starts the first time Command is shown and replaces the flat glyph once it has painted. A graphics failure says "3D view unavailable · showing the flat instrument" and offers Retry 3D view. This supersedes the earlier statement that Command renders only the 3D instrument with no fallback. See [renderer lifecycle](docs/COMMAND-3D-LIFECYCLE.md) and the historical [0.10.0 prototype notes](docs/archive/COMMAND-3D-IMPLEMENTATION.md).

## Keyboard and preferences

The dock's **?** popover lists the shortcuts from the same registry the handlers use: Ctrl/Cmd+K focuses the console from any mode; Ctrl/Cmd+\ cycles Command, Project, Research and Communications (ignored while typing); Ctrl/Cmd+Shift+M starts or stops the microphone; Ctrl/Cmd+R refreshes projects, tasks, runs, library, vault and the mail view and never reloads the window; Esc closes a dialog or steps the console back; `/` focuses library search in Research. While a dialog is open, it owns the keyboard.

Preferences (the console's gear, or the dock's gear outside Command) is a dialog: Replies & briefing (Spoken replies: Text or Voice; Opening Briefing), Voice (speech provider, OpenAI or ElevenLabs voice, Voice Lab), Gmail, Model diagnostics, and **Restart Olympus**, which moved there from the Pantheon strip on 2026-09-28 and asks for confirmation, naming any reply, voice session or delegated run it would interrupt.

Unsent drafts, open entries, review notes and scroll positions survive mode switches and refreshes for the session. They are held in memory only and are lost when the app restarts.
