Current development: [Communication Intelligence v3](docs/COMMUNICATION-INTELLIGENCE-V3.md) supersedes the v2-only/no-model description below. The native manual workflow uses bounded structured primary-model assessment with conditional cached-thread expansion; source ownership and execution boundaries remain unchanged.

See the adopted [v2 architecture critique](docs/COMMUNICATION-ARCHITECTURE-CRITIQUE.md) for the current skill boundaries and workflow.

## Communication Intelligence (September 12, 2026)

See [Communication Intelligence](docs/COMMUNICATION-INTELLIGENCE.md). Communications now leads with a manual, local evidence-backed brief. Two active typed skills use shared GraphNode / SkillContract definitions. The v2 graph has five nodes; project relevance uses a bounded deterministic matcher, not a discovery loop. Analytics remains collapsed. No model calls, Gmail writes, project changes or memory promotion are added. Earlier implementation entries below are historical.

# Olympus — Architecture

## Knowledge workflow development

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

Runtime: `react`, `react-dom`, `lucide-react`, `motion`, `@tauri-apps/api`, `@fontsource/inter`, `@fontsource/jetbrains-mono`.
Dev: `vite`, `@vitejs/plugin-react`, `typescript`, `@tauri-apps/cli`.

## Project layout

```
src/             React frontend — App, components, hooks, services, data, utils, styles
src-tauri/       Rust desktop shell — Cargo.toml, tauri.conf.json, schema.sql, src/main.rs
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

Tauri commands exposed by the desktop shell:

| Area | Commands |
| --- | --- |
| Assistant | `send_assistant_message` |
| Persistence | `load_persisted_state`, `begin_operator_session`, `save_settings`, `save_tool_states`, `append_conversation_messages`, `clear_conversation` |
| Vault | `write_memory_artifact`, `fetch_pantheon_entries`, `write_pantheon_entry`, `migrate_pantheon_schema`, `save_attachment_to_vault`, `append_profile_observation`, `promote_chat_memory`, `fetch_operator_profile`, `fetch_recent_vault_writes`, `fetch_vault_graph`, `open_vault_note` |
| Write gate | `resolve_vault_write` |
| Live data | `scan_tracked_projects`, `fetch_action_queue` |
| Delegation | `start_delegation_run`, `resume_delegation_run`, `cancel_delegation_run`, `list_delegation_runs`, `fetch_delegation_diff` |
| Shell / files | `launch_quick_app`, `restart_olympus`, `pick_attachment_file`, `extract_pdf_text` |

The SQLite connection is opened once during `setup()` and held in managed state, so the frontend can assume persistence is ready before it can invoke anything.

## Vault writes

Olympus has written to the vault since April 2026. Five commands do it. All five resolve the vault root in Rust via `commands::get_vault_path()`; **no caller supplies a path** (this was unified in `62c957e` — `write_memory_artifact` previously took the root from the frontend).

| Command | Operation | Target | Declared intent | Asks first? |
| --- | --- | --- | --- | --- |
| `write_pantheon_entry` | create | `02 - Research/<date> <title>.md` | `CreateUnique` | No — `ensure_unique_path` (`pantheon.rs`) suffixes on collision, so nothing is destroyed |
| `save_attachment_to_vault` | create | `02 - Research/_attachments/<file>` | `CreateUnique` | No — `ensure_unique_attachment_path` (`attachments.rs:55`) suffixes |
| `write_memory_artifact` | **overwrite** | `00 - Dashboard/Olympus Research.base`, `Olympus Projects.canvas` | `RegenerateDerived` | Only when the file diverged from what Olympus last wrote, or was never fingerprinted |
| `promote_chat_memory` | **append** | `04 - Decisions/Decision Log.md` | `AppendAuthored` | **Always**, with the complete bounded addition |
| `append_profile_observation` | **append** | `09 - System/Profile Observations.md` | `AppendAuthored` | **Always** |

No command deletes or renames a note the operator can see.

### The write gate

Every vault write goes through `commands::vault_write`, which does two separate things:

- **Containment.** `resolve_vault_path` proves the target lands inside the vault before anything touches disk — rejecting traversal, absolute and UNC paths, alternate data streams, Windows device names, and junctions that redirect out of the vault. Out-of-vault writes are **rejected, never confirmed**: a confirm path would mean the mechanism exists and one misclick authorizes it.
- **Classification.** Each call site *declares* a `WriteIntent`; the gate never infers one from the filesystem operation. `CreateUnique` is safe only because both creating writers guarantee an unused path — that is a property of those call sites, not of creation.

When a write needs a human, `write_confirm::request_confirmation` emits `vault-write-pending` to the webview and blocks on the answer. Timeout (120s), a dropped channel, and an emit failure all **deny**. The operator's answer returns through `resolve_vault_write`. `WriteConfirmDialog.tsx` renders it; declining is the default on Escape, the backdrop, and the focused button, and the dialog's wording comes from the intent-derived `operation` field so an append is never described as an overwrite.

Fingerprints of app-authored files live in the SQLite `artifact_hashes` table, normalised for line endings and trailing whitespace before hashing — the vault syncs through OneDrive and is opened by Obsidian, and neither round-trip is a human edit. A file whose fingerprint still matches is regenerated silently; one that diverged, or was never recorded, prompts. **Absent must mean confirm** — treating a missing row as clean would make the check bypassable by deleting it.

After a successful approved write, `vault_git::commit_vault_file` commits only
that vault-relative path. It uses a temporary Git index seeded from `HEAD`,
proves the resulting commit tree contains exactly one changed path, atomically
advances the vault branch, then refreshes only that path in the operator's real
index. Unrelated staged and unstaged vault work is never adopted.

### The appender

`append_profile_observation` and `promote_chat_memory` append to existing notes and always ask. The observation-specific invariants below remain unchanged; the separate promotion path is documented in `docs/CURATED-MEMORY.md`. Two properties are load-bearing:

- **The write is atomic.** The whole file is composed in memory, written to a dot-prefixed temp file in the same directory, flushed with `sync_all`, and renamed over the target. A plain append interrupted mid-write leaves half an entry in a note the operator reads by hand.
- **The note is not read back.** `09 - System/Profile Observations.md` is deliberately absent from `vault_context::STABLE_NOTES`. Inferences that re-entered the assistant's context would arrive on the next turn indistinguishable from the operator's own stated preferences. `observations.rs` carries a test asserting the absence.

Because the gate can hold for up to two minutes, the appender re-fingerprints the note after approval and refuses to write if it changed while the dialog was open — otherwise a concurrent append or an edit in Obsidian would be silently dropped by the full-file replace.

## Process spawns

Three areas in `src-tauri/src` start a process. All are recorded here because a
spawn can write anything a shell can, which puts them in the same blast radius
as the vault writers above.

### `launch_quick_app` — `lib.rs:171-206`

Runs `cmd /C start` — a real shell. The `app_id` argument arrives from the
webview but is matched against four string literals, each producing a fixed
argv; the `_` arm rejects everything else. **No caller-supplied string ever
reaches the command line**, and there is no path argument, so it cannot address
the vault.

This is the correct shape for invoking a shell from a command handler. The
obvious "improvement" — accepting a URL or target from the frontend and passing
it through — would turn it into a shell injection.

### `git_command` — `projects.rs:162-167`

Runs `git -C <path> <args>`. All four call sites pass literal, read-only
subcommands: `rev-parse --is-inside-work-tree` (`:99`), `rev-parse --abbrev-ref
HEAD` (`:118`), `log -1` (`:119`), `status --porcelain` (`:121`).

**The path is caller-supplied.** `ProjectsRequest.root_path` (`projects.rs:16`)
comes from the webview via `liveData.ts:37`, sourced from
`settings.projectsRootPath` in SQLite. It is the one filesystem root still owned
by the frontend — the vault path was unified into Rust in `62c957e`, this one
was not. It is read-only today, so it is not a data-loss risk; it is an
unresolved instance of the pattern that unification removed.

Two things follow that "the subcommands are read-only" does not cover:

- No shell is involved and Rust escapes argv, so the path cannot inject a
  command. But `git` honours repository-local config, and keys such as
  `core.fsmonitor`, `core.pager`, and `diff.external` execute programs — the
  CVE-2022-24765 family. Pointing `-C` at a repository someone else controls can
  turn `git status` into code execution. Low risk while the root is locally
  configured and no UI edits it; it stops being low risk the moment either
  changes.
- The scan is reachable from a React effect (`useDashboardData.ts:279` on mount,
  `:288` on a 60s interval), so it runs twice per mount under StrictMode in dev.
  **No gated write is effect-reachable** — Update Canvas, View Database, and
  Record (observation) are all button handlers — so the double-invoke does not
  currently produce duplicate confirmation dialogs.

### Claude Code delegation — `delegation.rs`

The webview supplies only a tracked project ID, run ID, and the exact committed
next action already read from the project note. Rust re-resolves the direct
project child from the configured projects root and rejects a task that no
longer matches the vault commitment.

The adapter resolves one fixed Claude Code executable beneath the operator's
`APPDATA`, verifies its version, creates an `olympus/run-*` branch and worktree
beneath the Olympus app-data directory, and builds every process argument in
Rust. Planning runs first with read-only tools and always ends at a durable
`waiting` checkpoint. Only a second operator action resumes the same Claude
session with a bounded edit/test allowlist. Cancellation kills the child but
preserves the branch and worktree. The process ID is durable; on Windows,
cancellation terminates the full process tree, and restart recovery distinguishes
a detached live process from an ended one. Push, merge, deploy, and worktree
deletion are not implemented by the pilot.

### Excluded, with reason

`assistant.rs:314` is `response.status()` on a `reqwest::Response`, not a
process. `tauri_plugin_opener` is registered at `lib.rs` but never called —
grep for `opener::` returns only the plugin init. `rfd` (native file picker) and
`pdf-extract` are in-process libraries.

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
  and bounded Pantheon retrieval includes attributed source snapshots. See
  `docs/MODEL-ROUTING.md` for request routing and diagnostics.

Seeded fallbacks live in `src/data/seed.ts`. State is plain React (`useState` / `useEffect` / `useMemo`). `src/services/storage.ts` selects a persistence backend per runtime: SQLite in the desktop shell, `localStorage` in the browser dev server, with one source of truth each. State hydrates asynchronously after mount, and the save effect is gated on hydration so seed defaults cannot overwrite stored state on first render.

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
ANTHROPIC_API_KEY=
```

`.env` is gitignored and loaded by `load_olympus_env()` in `src-tauri/src/lib.rs`, which resolves it relative to the Cargo manifest — so it belongs at the repo root, next to `package.json`.

---

For higher-level system framing, project context, and decision history, see the Obsidian vault — particularly `09 - System/System Architecture.md`, `09 - System/Dashboard Information Architecture.md`, and `04 - Decisions/Decision Log.md`. The original April 25, 2026 codebase discovery report is archived at `09 - System/2026-04-25 Olympus Architecture Discovery.md`.

## Curated-memory implementation

See [CURATED-MEMORY.md](docs/CURATED-MEMORY.md) for bounded retrieval, persisted source snapshots, and reviewed chat promotion. These additions grant no delegation authority. [OPERATOR-APPROVAL-DESIGN.md](docs/OPERATOR-APPROVAL-DESIGN.md) is proposed, not implemented.


## Voice adapter

Phase 1 voice reuses the common assistant turn handler and project command projection.
Rust mints short-lived Realtime credentials; browser WebRTC owns audio lifecycle.
The reasoning reply has validated spoken/visual channels; the audio adapter receives
only the concise spoken text. All action execution remains behind existing approval
commands. Additive conversation_voice metadata shares message IDs with the existing
conversation log. See VOICE.md for lifecycle, configuration and verification limits.


## Native Gmail source (development, September 12, 2026)

See [GMAIL.md](docs/GMAIL.md) for setup, ownership, bounds, privacy, verification and live acceptance. `commands/gmail/{auth,mime,sync,store}.rs` adds a native read-only external source: system-browser PKCE/loopback OAuth, Windows Credential Manager refresh tokens, deterministic bounded history sync, SQLite snapshots/FTS and separate generated candidates. `gmail_accounts`, `gmail_messages`, `gmail_search`, `gmail_sync_runs`, `gmail_candidates` and `conversation_mail` are additive. No generalized live-source primitive existed; vault research and curated memory remain unchanged.

The common assistant handler supplies backend-built, question-routed communication evidence to either reasoning provider. Exact excerpts are persisted with replies and labelled in chat. Gmail cannot override Git implementation facts, operator intent, decisions or execution approval. Current candidates appear in Preferences and Project briefing; they never enter the task/approval tables. Native cadence only runs while the app is open and is separate from the specific knowledge-audit graph. The web preview cannot access native mail credentials. Real OAuth and installed-app acceptance remain pending local Google configuration; this pass has not been installed.


### Communications workspace

The fourth dashboard mode uses `gmail_workspace` for bounded local metadata aggregation (up to 2,000 eligible messages, 40 preview rows per page). Bodies load only through the existing thread command. Candidate joins require the current source fingerprint; source analytics, generated candidates and operator-confirmed state remain separate. Typed Communications questions can add seven-day cache aggregates; explicit thread markers resolve in native read-only retrieval and preserve excerpt provenance. No analytics job invokes a model. See `docs/COMMUNICATIONS.md`.


### Evolving Communications situations (development, September 13, 2026)

See [COMMUNICATION-SITUATIONS.md](docs/COMMUNICATION-SITUATIONS.md). The operator-approved situation worker runs bounded changed-thread discovery and briefing synthesis against the native cache, explicit situation updates and matching Research. Five additive account-scoped tables retain generated situations/sources, updates, background state and local drafts. A fixed versioned workflow validates evidence and rechecks context before atomic publication. It does not create tasks, change intent, send email or expand Gmail scope. The existing single-active-analysis constraint and model transport are reused; purpose-specific typed contracts do not add a general agent executor. The UI polls snapshots without model calls and preserves map/draft state. Background analysis can be paused and is disclosed in Communications and Gmail preferences. Installed 0.17.0 remains unchanged until a later release request.

## Situation-map executive priority projection
`src/services/situationPriority.ts` is a pure presentation/review policy over saved
SituationContext. Priority is separate from source status. Reasons, references,
policy version and recommended workstream ID are explicit. It does not infer
current deadlines, consume unlinked Gmail updates, mutate the document foundation,
or introduce persistence, telemetry or model calls. Ties and missing evidence do
not force a recommendation. See docs/EXECUTIVE-PRIORITIZATION.md.


### Operational dossier file boundary

The dossier is a UI projection of saved contextual references. Optional document origin/date and source-linked milestones do not add model input or extraction workflows. Native `situation_document_status` and `situation_document_open` resolve source IDs only from the current enabled account's saved situation context. Frontend paths are not accepted; remote/relative paths and executable/active-web extensions cannot be opened. Missing files have no Open action. Timeline states are retained, never inferred from source file dates. Browser fixture file clients have no native side effects.
