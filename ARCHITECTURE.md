# Olympus — Architecture

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
| Persistence | `load_persisted_state`, `save_settings`, `save_tool_states`, `append_conversation_messages`, `clear_conversation` |
| Vault | `write_memory_artifact`, `fetch_pantheon_entries`, `write_pantheon_entry`, `save_attachment_to_vault`, `append_profile_observation` |
| Write gate | `resolve_vault_write` |
| Live data | `fetch_market_quotes`, `fetch_weather`, `scan_tracked_projects`, `fetch_action_queue` |
| Shell | `launch_quick_app`, `restart_olympus`, `pick_attachment_file`, `extract_pdf_text` |

The SQLite connection is opened once during `setup()` and held in managed state, so the frontend can assume persistence is ready before it can invoke anything.

## Vault writes

Olympus has written to the vault since April 2026. Four commands do it. All four resolve the vault root in Rust via `commands::get_vault_path()`; **no caller supplies a path** (this was unified in `62c957e` — `write_memory_artifact` previously took the root from the frontend).

| Command | Operation | Target | Declared intent | Asks first? |
| --- | --- | --- | --- | --- |
| `write_pantheon_entry` | create | `02 - Research/<date> <title>.md` | `CreateUnique` | No — `ensure_unique_path` (`pantheon.rs`) suffixes on collision, so nothing is destroyed |
| `save_attachment_to_vault` | create | `02 - Research/_attachments/<file>` | `CreateUnique` | No — `ensure_unique_attachment_path` (`attachments.rs:55`) suffixes |
| `write_memory_artifact` | **overwrite** | `00 - Dashboard/Olympus Research.base`, `Olympus Projects.canvas` | `RegenerateDerived` | Only when the file diverged from what Olympus last wrote, or was never fingerprinted |
| `append_profile_observation` | **append** | `09 - System/Profile Observations.md` | `AppendAuthored` | **Always** |

No command deletes or renames a note the operator can see.

### The write gate

Every vault write goes through `commands::vault_write`, which does two separate things:

- **Containment.** `resolve_vault_path` proves the target lands inside the vault before anything touches disk — rejecting traversal, absolute and UNC paths, alternate data streams, Windows device names, and junctions that redirect out of the vault. Out-of-vault writes are **rejected, never confirmed**: a confirm path would mean the mechanism exists and one misclick authorizes it.
- **Classification.** Each call site *declares* a `WriteIntent`; the gate never infers one from the filesystem operation. `CreateUnique` is safe only because both creating writers guarantee an unused path — that is a property of those call sites, not of creation.

When a write needs a human, `write_confirm::request_confirmation` emits `vault-write-pending` to the webview and blocks on the answer. Timeout (120s), a dropped channel, and an emit failure all **deny**. The operator's answer returns through `resolve_vault_write`. `WriteConfirmDialog.tsx` renders it; declining is the default on Escape, the backdrop, and the focused button, and the dialog's wording comes from the intent-derived `operation` field so an append is never described as an overwrite.

Fingerprints of app-authored files live in the SQLite `artifact_hashes` table, normalised for line endings and trailing whitespace before hashing — the vault syncs through OneDrive and is opened by Obsidian, and neither round-trip is a human edit. A file whose fingerprint still matches is regenerated silently; one that diverged, or was never recorded, prompts. **Absent must mean confirm** — treating a missing row as clean would make the check bypassable by deleting it.

### The appender

`append_profile_observation` is the only writer that adds to an existing note, and the only one that always asks. Two properties are load-bearing:

- **The write is atomic.** The whole file is composed in memory, written to a dot-prefixed temp file in the same directory, flushed with `sync_all`, and renamed over the target. A plain append interrupted mid-write leaves half an entry in a note the operator reads by hand.
- **The note is not read back.** `09 - System/Profile Observations.md` is deliberately absent from `vault_context::STABLE_NOTES`. Inferences that re-entered the assistant's context would arrive on the next turn indistinguishable from the operator's own stated preferences. `observations.rs` carries a test asserting the absence.

Because the gate can hold for up to two minutes, the appender re-fingerprints the note after approval and refuses to write if it changed while the dialog was open — otherwise a concurrent append or an edit in Obsidian would be silently dropped by the full-file replace.

## Process spawns

Two places in `src-tauri/src` start a process. Both are recorded here because a
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

### Excluded, with reason

`assistant.rs:314` is `response.status()` on a `reqwest::Response`, not a
process. `tauri_plugin_opener` is registered at `lib.rs` but never called —
grep for `opener::` returns only the plugin init. `rfd` (native file picker) and
`pdf-extract` are in-process libraries.

## Data flow

Dashboard panels compose from `src/App.tsx`. Live data sources:

- **Markets** — Yahoo Finance chart API for S&P 500, Nasdaq 100, Dow (no key required); FRED for rates (`DGS2`, `DGS10`, `DGS30`, `MORTGAGE30US`)
- **Weather** — Open-Meteo (no key required)
- **Pantheon** — walks `02 - Research/` and parses each note's YAML frontmatter; entries require an `olympus/research` tag. It does not read `Olympus Research.base`, which is a generated output rather than an input
- **Projects / Git** — local repository inspection via Tauri commands

- **Chat** — `send_assistant_message` calls the Anthropic API from Rust, so the API key never reaches the webview

Seeded fallbacks live in `src/data/seed.ts`. State is plain React (`useState` / `useEffect` / `useMemo`). `src/services/storage.ts` selects a persistence backend per runtime: SQLite in the desktop shell, `localStorage` in the browser dev server, with one source of truth each. State hydrates asynchronously after mount, and the save effect is gated on hydration so seed defaults cannot overwrite stored state on first render.

## Build and run

```bash
npm install
npm run dev          # Vite dev server (browser)
npm run tauri dev    # Tauri desktop shell (requires Rust toolchain — https://rustup.rs/)
npm run build        # Production build
```

## Environment variables

Copy `.env.example` to `.env` and fill in:

```
ANTHROPIC_API_KEY=
FRED_API_KEY=
```

`.env` is gitignored and loaded by `load_olympus_env()` in `src-tauri/src/lib.rs`, which resolves it relative to the Cargo manifest — so it belongs at the repo root, next to `package.json`. Open-Meteo requires no key.

---

For higher-level system framing, project context, and decision history, see the Obsidian vault — particularly `09 - System/System Architecture.md`, `09 - System/Dashboard Information Architecture.md`, and `04 - Decisions/Decision Log.md`. The original April 25, 2026 codebase discovery report is archived at `09 - System/2026-04-25 Olympus Architecture Discovery.md`.
