# Olympus — Architecture

Current as of September 28, 2026: release 0.19.0 plus the 2026-09-28 review fixes
and the 2026-09-28 design-review implementation (see `docs/NEXT-SESSION.md` and
[the implementation checklist](docs/reviews/2026-09-28-design-usability/IMPLEMENTATION-CHECKLIST.md)).

## Knowledge workflows

The first fixed read-only graph is `knowledge-audit/v1`: parallel research,
prior-evidence health and delegation-review collection, a deterministic join,
fingerprint verification and closed attention routing. Generated findings carry
no memory, approval or execution authority. Two additive SQLite tables retain
audit runs and node events; source notes are never written by this graph.
See [Knowledge workflows](docs/KNOWLEDGE-WORKFLOWS.md) for implemented scope,
loop bounds, recovery, routing and the phased synthesis/interview/cadence plan.

## Stack

- **Frontend:** React + TypeScript, built with Vite
- **Desktop shell:** Tauri (Rust)
- **Persistence:** SQLite via Tauri commands; browser `localStorage` as a development fallback
- **Knowledge layer:** Obsidian vault at `Desktop/Projects/Obsidian vaults/Olympus Obsidian Vault`

Runtime: `react`, `react-dom`, `lucide-react`, `motion`, `three`, `react-markdown`, `remark-gfm`, `simple-icons`, `@tauri-apps/api`, `@fontsource/inter`, `@fontsource/jetbrains-mono`, `@fontsource/cinzel`.
Dev: `vite`, `@vitejs/plugin-react`, `typescript`, `esbuild`, `@tauri-apps/cli`, `@types/react`, `@types/react-dom`, `@types/three`.

Research notes render through `react-markdown` with `remark-gfm` and an Olympus remark plugin for wikilinks; there is no raw-HTML renderer and no JavaScript-evaluating frontmatter parser (`rehype-raw` and `gray-matter` were removed on 2026-09-28). Frontmatter is parsed in Rust.

## Project layout

```
src/             React frontend — App, components, hooks, services, data, utils, styles
src-tauri/       Rust desktop shell — Cargo.toml, tauri.conf.json (including the CSP), schema.sql;
                 src/main.rs only sets the Windows GUI subsystem for release builds and calls
                 src/lib.rs, which registers commands; src/commands/ holds about 30 modules
                 (gmail/ is a submodule tree)
scripts/         PowerShell scripts that scaffold and sync the Obsidian vault
OLYMPUS-MANUAL.md Canonical product vision, operating policy, and autonomy boundaries
AGENTS.md         Thin Codex/agent adapter to the canonical manual
CLAUDE.md         Claude-specific adapter plus technical constraints
index.html       Vite entry
vite.config.ts   Vite configuration
tsconfig.json    TypeScript configuration
package.json     Frontend dependencies and npm scripts
.env.example     Required environment variables (copy to .env)
```

Tauri commands exposed by the desktop shell — all 78 in the `invoke_handler` list in `src-tauri/src/lib.rs` (regenerated 2026-09-28; `gmail_cache_counts` is the only addition since 0.19.0):

| Area | Commands |
| --- | --- |
| Assistant and models | `send_assistant_message`, `model_routes`, `model_diagnostics`, `record_voice_request`, `create_voice_session` |
| Persistence | `load_persisted_state`, `begin_operator_session`, `save_settings`, `save_tool_states`, `append_conversation_messages`, `clear_conversation` |
| Vault | `write_memory_artifact`, `fetch_pantheon_entries`, `write_pantheon_entry`, `migrate_pantheon_schema`, `save_attachment_to_vault`, `append_profile_observation`, `promote_chat_memory`, `fetch_operator_profile`, `fetch_recent_vault_writes`, `fetch_vault_graph`, `open_vault_note` |
| Write gate | `resolve_vault_write` |
| Live data | `scan_tracked_projects`, `fetch_action_queue` |
| Delegation | `prepare_delegation_run`, `prepare_delegation_resume`, `cancel_delegation_proposal`, `start_delegation_run`, `resume_delegation_run`, `cancel_delegation_run`, `list_delegation_runs`, `fetch_delegation_diff` |
| Delegation review | `fetch_delegation_review`, `run_delegation_check`, `delegation_review_fingerprint`, `complete_delegation_review` |
| Knowledge audit | `start_knowledge_audit`, `list_knowledge_audits`, `inspect_knowledge_audit` |
| Research / Verification agents | `research_agent_catalog`, `start_research_verification`, `inspect_research_verification`, `list_research_verifications`, `cancel_research_verification` |
| Command catalog | `command_agent_catalog` |
| Gmail | `gmail_status`, `gmail_connect`, `gmail_cancel`, `gmail_disconnect`, `gmail_sync`, `gmail_set_horizon`, `gmail_search`, `gmail_thread`, `gmail_workspace`, `gmail_remove_cache`, `gmail_cache_counts` |
| Communication Intelligence | `analyze_communications`, `communication_runs`, `communication_run_events`, `communication_feedback`, `communication_skills`, `communication_workflow`, `inspect_communication_run` |
| Situations | `situation_snapshot`, `situation_refresh`, `situation_set_background`, `situation_update`, `situation_edit`, `situation_draft`, `situation_save_draft`, `situation_document_status`, `situation_document_open` |
| Shell / files | `launch_quick_app`, `restart_olympus`, `pick_attachment_file`, `extract_pdf_text`, `open_external_link` |

Read-only additions to existing command results (2026-09-28, design review): `load_persisted_state` returns each message's `at` (the row's `created_at` as ISO 8601 UTC; nothing new is written); `create_voice_session` names a plain provider error code such as `insufficient_quota`, never the response body; `fetch_pantheon_entries` carries each entry's body fingerprint (the value a reply's research snapshot stores), whole-file fingerprint (the value Research Verification binds) and frontmatter `source_url`; `prepare_delegation_run` and `prepare_delegation_resume` return display-only `permitted` and `baseBranch` beside the bound `subject`; `fetch_delegation_review` returns `reviewedAt`; `situation_snapshot` reports understanding freshness (last publish, last attempt, consecutive failures, the worker's real resume time during backoff) and a content revision, answering `{unchanged, revision}` when the caller already holds that revision. `gmail_cache_counts` counts what cache removal, or a narrower history range, would delete; it validates the range like `gmail_set_horizon` and deletes nothing.

`pick_attachment_file` keeps the chosen path in Rust and returns a one-use token; `extract_pdf_text` and `save_attachment_to_vault` accept only that token. `write_memory_artifact` takes an artifact kind (the research `.base` or the projects `.canvas`), and Rust chooses the path.

The SQLite connection is opened once during `setup()` and held in managed state, so the frontend can assume persistence is ready before it can invoke anything.

The webview renders untrusted text (research notes, email, repository output), so the production build sets a CSP in `tauri.conf.json`: scripts only from the bundle, no frames or objects, images and fonts local, and `connect-src` limited to Tauri IPC plus `https://api.openai.com` for the Realtime SDP exchange (WebRTC media is not governed by `connect-src`). `style-src` keeps `'unsafe-inline'` because React and `motion` set style attributes; `dangerousDisableAssetCspModification` stops Tauri adding a style nonce, which would silently disable it. A new remote endpoint in the webview needs a matching `connect-src` entry, checked in the desktop app, since `npm run tauri dev` serves Vite directly and applies no CSP. Links open through `open_external_link` (http and https only), and a navigation guard in `commands::external_link` refuses any top-level navigation off the app origin. The CSP and the guard were not changed by the design review; console chat links, which previously used `target="_blank"`, now go through the same opener (`src/services/externalLink.ts`), as research links already did.

## Vault writes

Olympus has written to the vault since April 2026. Six commands do it. All six resolve the vault root in Rust via `commands::get_vault_path()`; **no caller supplies a path** (this was unified in `62c957e` — `write_memory_artifact` previously took the root from the frontend).

| Command | Operation | Target | Declared intent | Asks first? |
| --- | --- | --- | --- | --- |
| `write_pantheon_entry` | create | `02 - Research/<date> <title>.md` | `CreateUnique` | No — `create_unique` (`pantheon.rs`) claims a free suffixed name with `create_new`, so nothing is destroyed |
| `save_attachment_to_vault` | create | `02 - Research/_attachments/<file>` | `CreateUnique` | No — `copy_to_unique` (`attachments.rs`) claims a free suffixed name with `create_new`; the source is a file the operator picked, named to the webview only by a one-use token |
| `write_memory_artifact` | **overwrite** | `00 - Dashboard/Olympus Research.base`, `Olympus Projects.canvas` | `RegenerateDerived` | Only when the file diverged from what Olympus last wrote, or was never fingerprinted |
| `promote_chat_memory` | **append** | `04 - Decisions/Decision Log.md` | `AppendAuthored` | **Always**, with the complete bounded addition |
| `append_profile_observation` | **append** | `09 - System/Profile Observations.md` | `AppendAuthored` | **Always** |
| `migrate_pantheon_schema` | **modify** | frontmatter of `02 - Research/*.md` entries | `ModifyAuthored` | **Always**, one confirmation per file with a diff summary |

No command deletes or renames a note the operator can see.

### The write gate

Every vault write goes through `commands::vault_write`, which does two separate things:

- **Containment.** `resolve_vault_path` proves the target lands inside the vault before anything touches disk — rejecting traversal, absolute and UNC paths, alternate data streams, Windows device names, names ending in a dot or space, `.git` and `.obsidian` in any case, and junctions or dangling links that redirect out of the vault. Out-of-vault writes are **rejected, never confirmed**: a confirm path would mean the mechanism exists and one misclick authorizes it.
- **Classification.** Each call site *declares* a `WriteIntent`; the gate never infers one from the filesystem operation. `CreateUnique` is safe only because both creating writers guarantee an unused path — that is a property of those call sites, not of creation.

When a write needs a human, `write_confirm::request_confirmation` emits `vault-write-pending` to the webview and blocks on the answer. Timeout (120s), a dropped channel, and an emit failure all **deny**. The operator's answer returns through `resolve_vault_write`. `WriteConfirmDialog.tsx` renders it; declining is the default on Escape, the backdrop, and the focused button, and the dialog's wording comes from the intent-derived `operation` field so an append is never described as an overwrite. Concurrent requests queue by ID rather than replacing each other on screen. `resolve_vault_write` returns whether the answer reached a live request, and the dialog reports an approval that arrived after the timeout as nothing written instead of as a write.

Fingerprints of app-authored files live in the SQLite `artifact_hashes` table, normalised for line endings and trailing whitespace before hashing — the vault syncs through OneDrive and is opened by Obsidian, and neither round-trip is a human edit. A file whose fingerprint still matches is regenerated silently; one that diverged, or was never recorded, prompts. **Absent must mean confirm** — treating a missing row as clean would make the check bypassable by deleting it.

After a successful approved write, `vault_git::commit_vault_file` commits only
that vault-relative path. It uses a temporary Git index seeded from `HEAD`,
proves the resulting commit tree contains exactly one changed path, atomically
advances the vault branch, then refreshes only that path in the operator's real
index. Unrelated staged and unstaged vault work is never adopted.

### The appender

`append_profile_observation` and `promote_chat_memory` append to existing notes and always ask. The observation-specific invariants below remain unchanged; the separate promotion path is documented in `docs/CURATED-MEMORY.md`. Two properties are load-bearing:

- **The write is atomic.** The whole file is composed in memory, written to a uniquely named dot-prefixed temp file claimed with `create_new` in the same directory, flushed with `sync_all`, and renamed over the target, with one writer at a time behind a mutex. A plain append interrupted mid-write leaves half an entry in a note the operator reads by hand.
- **The note is not read back.** `09 - System/Profile Observations.md` is deliberately absent from `vault_context::STABLE_NOTES`. Inferences that re-entered the assistant's context would arrive on the next turn indistinguishable from the operator's own stated preferences. `observations.rs` carries a test asserting the absence.

Because the gate can hold for up to two minutes, the appender re-resolves the path and compares the note's exact bytes after approval, and refuses to write if it changed while the dialog was open — otherwise a concurrent append or an edit in Obsidian would be silently dropped by the full-file replace. Only a missing file counts as absent; any other read error fails closed.

## Process spawns

Every `Command::new` and opener call in `src-tauri/src` outside tests is listed
here, audited on 2026-09-28. A spawn can do anything a shell can, which puts it in
the same blast radius as the vault writers above. Every console child goes
through `delegation::hide_console`, which sets `CREATE_NO_WINDOW` on Windows:
release builds use the GUI subsystem, so a console child would otherwise open a
window.

### `launch_quick_app` (`lib.rs`)

Runs `cmd /C start` — a real shell — on Windows only. The `app_id` argument
arrives from the webview but is matched against four string literals, each
producing a fixed argv; the `_` arm rejects everything else. **No
caller-supplied string ever reaches the command line**, and there is no path
argument, so it cannot address the vault.

This is the correct shape for invoking a shell from a command handler. The
obvious "improvement" — accepting a URL or target from the frontend and passing
it through — would turn it into a shell injection.

### Opener plugin (`tauri_plugin_opener`)

Four call sites hand a target to the operating system's handler. None starts a
shell, and none accepts a ready-made URL or path from the webview:

- `open_vault_note` (`lib.rs`) resolves the relative path through the vault
  containment guard and assembles an `obsidian://open` URI in Rust. It used
  `cmd /C start` until 2026-09-28, where the `&` in the URI was a command
  separator. Since the design review the library also calls it for embedded
  research attachments; the frontend offers Open only for files directly under
  `02 - Research/_attachments/` with an allowed extension, and the Rust
  containment guard still resolves the path.
- `open_external_link` (`commands/external_link.rs`) is called for research
  links, console chat links (since the design review) and a library entry's
  source link. It accepts http and https only; any other scheme is refused, because the opener would hand `file:` or a
  custom protocol to the shell. The same module's navigation guard refuses any
  top-level webview navigation off the app origin.
- Gmail OAuth (`gmail/auth.rs`) opens Google's consent URL, built in Rust, in
  the system browser.
- `situation_document_open` (`gmail/situations/documents.rs`) opens a local
  file whose path comes only from the current account's saved situation
  context, by source ID. Relative, remote and UNC paths are rejected, and only
  document and image extensions (`pdf`, `png`, `jpg`, `jpeg`, `webp`, `gif`,
  `txt`, `md`, `docx`, `xlsx`, `pptx`, `zip`) open.

### Project scan git — `git_command` (`projects.rs`)

Runs `git -C <path> <args>`. Every call site passes literal, read-only
subcommands: `rev-parse --is-inside-work-tree`, `rev-parse --abbrev-ref HEAD`,
`log --all -1`, `status --porcelain`, `log --all --since=…` for recent commits,
`worktree list --porcelain`, and per linked worktree `status --porcelain` and
`log -1`.

**The path is caller-supplied.** `ProjectsRequest.root_path` comes from the
webview (`services/liveData.ts`), sourced from `settings.projectsRootPath` in
SQLite. It is the one filesystem root still owned by the frontend — the vault
path was unified into Rust in `62c957e`, this one was not. It is read-only
today, so it is not a data-loss risk; it is an unresolved instance of the
pattern that unification removed.

Two things follow that "the subcommands are read-only" does not cover:

- No shell is involved and Rust escapes argv, so the path cannot inject a
  command. But `git` honours repository-local config, and keys such as
  `core.fsmonitor`, `core.pager`, and `diff.external` execute programs — the
  CVE-2022-24765 family. Pointing `-C` at a repository someone else controls can
  turn `git status` into code execution. Low risk while the root is locally
  configured and no UI edits it; it stops being low risk the moment either
  changes.
- The scan runs from effects in `hooks/useDashboardData.ts` (on mount and on a
  60-second interval), so it runs twice per mount under StrictMode in dev. Scans
  carry a request sequence, so a stale result cannot land last. **No gated write
  is effect-reachable** — Update Canvas, View Database, and Record (observation)
  are all button handlers — so the double-invoke does not produce duplicate
  confirmation dialogs.

### Vault git — `vault_git::git`

After an approved write, `commit_vault_file` runs git in the vault root with
`-c core.quotePath=false --literal-pathspecs` and a temporary index
(`GIT_INDEX_FILE`), as described under *The write gate*. Arguments are built in
Rust; the path is the vault-relative path the writer already proved contained.
The same repository-config caveat as the project scan applies, to the operator's
own vault.

### Claude Code delegation — `delegation.rs`

The webview supplies only a tracked project ID, run ID, and the exact committed
next action already read from the project note. Rust re-resolves the direct
project child from the configured projects root and rejects a task that no
longer matches the vault commitment, or a primary checkout with uncommitted work.

Processes started here:

- `git` in the project repository and the run worktree: `status`, `rev-parse`,
  `worktree add -b olympus/run-*`, `ls-files --others`, and `diff --no-ext-diff`
  for review.
- The Claude Code executable, resolved at one fixed location beneath `APPDATA`:
  once with `--version`, then once per stage. Every launch passes an exact
  `--tools` inventory, `--setting-sources ""`, `--strict-mcp-config` with an
  empty MCP config, `--max-budget-usd 5` (per launch), and `--` before the
  prompt; stdin is null. The environment is cleared to an allowlist that
  includes `ANTHROPIC_API_KEY` when set. Each launch has a 45-minute wall-clock
  limit.
- `taskkill /PID <pid> /T /F` on cancellation, only while the process's
  creation time still matches the one recorded with the PID.

Each Claude process is assigned to a Windows Job Object with kill-on-close, so
its descendants stop with it and with Olympus. Planning runs first with
read-only tools and always ends at a durable `waiting` checkpoint; only a second
operator action resumes the same session with the edit and check allowlist.
Push, merge, deploy, and worktree deletion are not implemented. See
`docs/AGENT-DELEGATION.md` for residual risk: the allowed checks execute code the
agent can edit, and there is no OS sandbox.

### Delegation review checks — `delegation_review.rs`

**Run check** starts one of three registered commands in the run worktree:
`npm run build`, `npm test` (through `cmd.exe /D /S /C npm` on Windows), or
`cargo test --lib --manifest-path <manifest>`. No shell text comes from the
webview; an unknown check ID is refused. The environment is cleared to an
allowlist without API keys, plus a per-project `CARGO_TARGET_DIR`; the process
joins a Job Object and is killed after ten minutes or on cancel. These commands run
agent-written code, and the buttons say so.

### Excluded, with reason

`restart_olympus` calls Tauri's `app.restart()`, which relaunches Olympus's own
executable with no caller input. `rfd` (native file picker) and `pdf-extract`
are in-process libraries. Test-only spawns (`mklink` in `vault_write.rs`,
`sleep`/`true` in `delegation.rs`, `git` fixtures in `projects.rs`) do not ship.

## Data flow

Dashboard panels compose from `src/App.tsx`. Live data sources:

- **Pantheon** — walks `02 - Research/` and parses each note's YAML frontmatter; entries require an `olympus/research` tag. It does not read `Olympus Research.base`, which is a generated output rather than an input
- **Projects / Git** — local repository inspection via Tauri commands. Project
  notes contribute operator-owned status, current vision, vision review date,
  and committed next action; Git contributes branch, commit, and working-tree
  facts. `src/services/projectBriefing.ts` reconciles those with attributed
  tasks into Project mode's grounded session paths. Command consumes the same
  sources for the deterministic project-window ring, linked-note constellation,
  day-arc commit ticks, and the hovered project's name and open-task count. The
  scan reads commits across all refs and lists linked worktrees, including their
  uncommitted file counts, so delegated progress is visible before it reaches
  the primary branch.

- **Session boundary** — `operator_sessions` records one idempotent row per
  desktop webview lifetime. Project mode's “since last session” list is queried
  from the previous recorded launch time; when none exists, the UI says it is
  falling back rather than pretending a time window.

- **Chat** — `send_assistant_message` resolves a backend-owned route (OpenAI Responses by default, explicit Anthropic comparison) from Rust, so the
  API key never reaches the webview. The request includes the stable System
  notes plus at most the newest 16,000 characters of `04 - Decisions/Decision
  Log.md`, in a separate section labelled as historical evidence rather than
  standing instruction. Current operator direction and current project vision
  explicitly outrank it. `09 - System/Profile Observations.md` remains excluded,
  and bounded Pantheon retrieval includes attributed source snapshots. Content
  another party could have written (project state, the command board, research
  excerpts, Gmail evidence) travels in one `<olympus_evidence>` user item before
  the latest turn, not in the system prompt. See `docs/MODEL-ROUTING.md` for
  request routing and diagnostics.

Seeded fallbacks live in `src/data/seed.ts`. Since 2026-09-28 the desktop starts from `desktopInitialState` — seed settings, tools and quick apps, but no projects and no conversation — and `useDashboardData()` reports a `projectScan` state (`loading`, `ready`, `stale`, `failed`) with the last success time, instead of showing example projects until the first scan. A failed first scan leaves the list empty; a later failure keeps the last genuine result as `stale`. Only the browser preview shows the seed projects and conversation, flagged `demoData` and labelled as examples. Desktop hydration drops only messages that exactly match the seed fixture. State is plain React (`useState` / `useEffect` / `useMemo`). `src/services/storage.ts` selects a persistence backend per runtime: SQLite in the desktop shell, `localStorage` in the browser dev server, with one source of truth each. State hydrates asynchronously after mount, and the save effect is gated on hydration so seed defaults cannot overwrite stored state on first render.

## Frontend structure (design review, 2026-09-28)

The design-review implementation added shared modules that surfaces build on
rather than duplicating:

| Module | Role |
| --- | --- |
| `src/state/viewState.ts` | Session view state, in memory only (never `localStorage`). Slices: `project` (open detail, board and detail scroll), `projectDrafts` (unsent run task and criteria per project), `reviewNotes` (per run), `research` (view, query, section, sort, open entry, scroll, Add Entry draft), `comms` (per account: situation, workstream, actor, tab, view, unsent reply drafts), `navigation` (pending cross-surface targets). Lost on app restart by design. Leaving Project mode keeps the open project only while `projectHasOpenWork()` is true. |
| `src/services/navigation.ts` | `openResearchEntry`, `openCommunicationsSituation`, `openProject`. App switches mode; the destination reads `useNavigationTarget()` and consumes the revision it handled. Also the refresh bus (`subscribeToRefresh`, `emitRefreshRequested`) that lets Communications join Ctrl+R. Navigation only; nothing here approves or writes. |
| `src/services/shortcuts.ts` | One registry (`SHORTCUTS`, `SHORTCUT_LIST`) that both the handlers and the dock's shortcut popover read: Ctrl/Cmd+K console, Ctrl/Cmd+\\ cycle mode, Ctrl/Cmd+Shift+M microphone, Ctrl/Cmd+R refresh, Esc, `/` library search. Handlers yield while any `aria-modal` dialog is open. Ctrl/Cmd+R always suppresses the webview reload, even while typing. |
| `src/components/Modal.tsx` | Dialog primitive: role and `aria-modal`, label, focus in, Tab trap, Escape for the topmost dialog only, focus restore, portal to `body`. z-index 8000, below the write gate (9000). `WriteConfirmDialog` was deliberately not moved onto it. |
| `src/components/ErrorBoundary.tsx` | Per-region boundary with a contained fallback, **Reload view** (remounts the region) and a Technical detail disclosure. |
| `src/components/panels/PreferencesDialog.tsx` | Preferences as a dialog: Replies & briefing, Voice (voice lab behind a disclosure), Gmail (polls every 2 s only while expanded), Model diagnostics, and Restart Olympus behind a confirmation that lists observed live work. Restart was removed from the Pantheon strip. |
| `src/services/time.ts` | `formatWhen` and `dayLabel`, the shared date formatter ("2 h ago · 09:55", "Yesterday 14:10", "in 5 min · 12:00"). |
| `src/components/panels/library/` | LibraryPanel split into `LibraryBrowser`, `EntryDetail`, `AddEntryDialog`, `entryMarkdown`, `excerptHighlight`, `StanceMark`, `InspectorParts` and the pure `libraryModel.ts` (tested by `scripts/test-library.mjs`). |
| `projects.css`, `command.css`, `communications.css`, `library/library.css`, `library/inspector.css` | Surface stylesheets split out of `styles.css`, which keeps the tokens (`--focus-ring`, `--text-micro` … `--text-2xl`, `--label` at #7f93ad) and the global `:focus-visible` ring. `scripts/test-css-tokens.mjs` fails on an undefined `var(--x)` without a fallback. |

Error-boundary layout in `App.tsx`: header, tool rail, agent catalog, Command
view, Communications view, Research view, Project view, Pantheon strip, command
console and status dock each have their own boundary. There is no root boundary
around App, and `WriteConfirmDialog` sits outside every boundary, so a view that
fails to render never unmounts the console or a pending write decision. (If the
gate did unmount, Rust would still deny the write on timeout.)

## Build and run

```bash
npm install
npm run dev          # Vite dev server (browser)
npm run tauri dev    # Tauri desktop shell (requires Rust toolchain — https://rustup.rs/)
npm run build        # Production build
npm run install:local # Build and update the stable Windows installation
```

The ordinary operator launch target is
`C:\Program Files\Project Olympus\project-olympus.exe`. Taskbar and Start-menu
shortcuts must point there, never at Cargo's replaceable `debug` output.
`scripts/install-olympus-local.ps1` only packages a clean checkout, requires a
version newer than the installed release unless explicitly forced, installs the
MSI with Windows elevation, and repairs the historical development pin.

## Environment variables

Copy `.env.example` to `.env` and fill in:

```
OPENAI_API_KEY=      # required: primary reasoning, voice, Communications, Research/Verification
ANTHROPIC_API_KEY=   # optional: explicit Claude comparison; passed to Claude Code delegation when set
```

Gmail needs no key in `.env`: its Desktop OAuth client file lives in the app data directory, and refresh tokens live in Windows Credential Manager (see `docs/GMAIL.md`). The `OLYMPUS_*_FIXTURE` and `OLYMPUS_TEST_PROJECTS_ROOT` variables are read only by tests and harnesses.

`.env` is gitignored and loaded by `load_olympus_env()` in `src-tauri/src/lib.rs`, which resolves it relative to the Cargo manifest — so it belongs at the repo root, next to `package.json`.

---

For higher-level system framing, project context, and decision history, see the Obsidian vault — particularly `09 - System/System Architecture.md`, `09 - System/Dashboard Information Architecture.md`, and `04 - Decisions/Decision Log.md`. The original April 25, 2026 codebase discovery report is archived at `09 - System/2026-04-25 Olympus Architecture Discovery.md`.

## Curated-memory implementation

See [CURATED-MEMORY.md](docs/CURATED-MEMORY.md) for bounded retrieval, persisted source snapshots, and reviewed chat promotion. These additions grant no delegation authority. [OPERATOR-APPROVAL-DESIGN.md](docs/OPERATOR-APPROVAL-DESIGN.md) is implemented (0.3.0); a live delegation run remains acceptance work.


## Voice adapter

Phase 1 voice reuses the common assistant turn handler and project command projection.
Rust mints short-lived Realtime credentials; browser WebRTC owns audio lifecycle.
The reasoning reply has validated spoken/visual channels; the audio adapter receives
only the concise spoken text. All action execution remains behind existing approval
commands. Additive conversation_voice metadata shares message IDs with the existing
conversation log. See VOICE.md for lifecycle, configuration and verification limits.


## Native Gmail source (added September 12, 2026; released from 0.16.0)

See [GMAIL.md](docs/GMAIL.md) for setup, ownership, bounds, privacy, verification and live acceptance. `commands/gmail/{auth,mime,sync,store}.rs` adds a native read-only external source: system-browser PKCE/loopback OAuth, Windows Credential Manager refresh tokens, deterministic bounded history sync, SQLite snapshots/FTS and separate generated candidates. `gmail_accounts`, `gmail_messages`, `gmail_search`, `gmail_sync_runs`, `gmail_candidates` and `conversation_mail` are additive. No generalized live-source primitive existed; vault research and curated memory remain unchanged.

The common assistant handler supplies backend-built, question-routed communication evidence to either reasoning provider. Exact excerpts are persisted with replies and labelled in chat. Gmail cannot override Git implementation facts, operator intent, decisions or execution approval. Current candidates appear in Gmail preferences; they never enter the task/approval tables. Native cadence only runs while the app is open and is separate from the specific knowledge-audit graph. The web preview cannot access native mail credentials.

OAuth is configured on the owner's machine and a first 206-message import succeeded on 2026-09-12. Still open: MIME review against real mail, incremental sync across a restart, a Gmail-grounded answer, and Disconnect/revoke (see the 2026-09-28 acceptance list in `docs/NEXT-SESSION.md`). The SQLite cache is unencrypted under the Windows user profile, and BitLocker state was not verified.

### Communication Intelligence

Explicit Analyze/Refresh runs the fixed `communication-intelligence/v4` graph (`gmail/intelligence_v3.rs`): the v3 assessment policy with corrected trace boundaries. Local narrowing selects threads first; the primary route then receives bounded excerpts through a strict structured-output contract and may expand within the same cached threads up to three times. Runs, node events and feedback persist in `communication_runs`, `communication_events` and `communication_evaluations`, and saved runs are inspectable read-only; see [WORKFLOW-INSPECTION.md](docs/WORKFLOW-INSPECTION.md) and [COMMUNICATION-INTELLIGENCE-V3.md](docs/COMMUNICATION-INTELLIGENCE-V3.md). Earlier v1/v2 descriptions, which made no model calls, are historical.


### Communications workspace

The fourth dashboard mode uses `gmail_workspace` for bounded local metadata aggregation (up to 2,000 eligible messages, 40 preview rows per page). Bodies load only through the existing thread command. Candidate joins require the current source fingerprint; source analytics, generated candidates and operator-confirmed state remain separate. Typed Communications questions can add seven-day cache aggregates; explicit thread markers resolve in native read-only retrieval and preserve excerpt provenance. No analytics job invokes a model. See `docs/COMMUNICATIONS.md`.


### Evolving Communications situations (added September 13, 2026)

See [COMMUNICATION-SITUATIONS.md](docs/COMMUNICATION-SITUATIONS.md). The operator-approved situation worker runs bounded changed-thread discovery and briefing synthesis against the native cache, explicit situation updates and matching Research. Six additive account-scoped `communication_situation*` tables retain document contexts, generated situations and sources, operator updates, background state and local drafts. A fixed versioned workflow validates evidence and rechecks context before atomic publication. It does not create tasks, change intent, send email or expand Gmail scope. The existing single-active-analysis constraint and model transport are reused; purpose-specific typed contracts do not add a general agent executor. The UI polls snapshots without model calls and preserves map/draft state. Background analysis runs while the app is open, can be paused, and is disclosed in Communications and Gmail preferences. Consecutive failures back off from five minutes to four hours; a new situation over the 24-situation limit is kept as a deferred observation rather than re-analysed each cycle.

## Situation-map executive priority projection
`src/services/situationPriority.ts` is a pure presentation/review policy over saved
SituationContext. Priority is separate from source status. Reasons, references,
policy version and recommended workstream ID are explicit. It does not infer
current deadlines, consume unlinked Gmail updates, mutate the document foundation,
or introduce persistence, telemetry or model calls. Ties and missing evidence do
not force a recommendation. See docs/EXECUTIVE-PRIORITIZATION.md.


### Operational dossier file boundary

The dossier is a UI projection of saved contextual references. Optional document origin/date and source-linked milestones do not add model input or extraction workflows. Native `situation_document_status` and `situation_document_open` resolve source IDs only from the current enabled account's saved situation context. Frontend paths are not accepted; remote/relative paths and executable/active-web extensions cannot be opened. Missing files have no Open action. Timeline states are retained, never inferred from source file dates. Browser fixture file clients have no native side effects.
