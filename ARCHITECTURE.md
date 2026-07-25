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
| Vault | `write_memory_artifact`, `fetch_pantheon_entries`, `write_pantheon_entry`, `save_attachment_to_vault` |
| Live data | `fetch_market_quotes`, `fetch_weather`, `scan_tracked_projects`, `fetch_action_queue` |
| Shell | `launch_quick_app`, `restart_olympus`, `pick_attachment_file`, `extract_pdf_text` |

The SQLite connection is opened once during `setup()` and held in managed state, so the frontend can assume persistence is ready before it can invoke anything.

## Vault writes

Olympus has written to the vault since April 2026. Three commands do it. All three resolve the vault root in Rust via `commands::get_vault_path()`; **no caller supplies a path** (this was unified in `62c957e` — `write_memory_artifact` previously took the root from the frontend).

| Command | Operation | Target | Overwrites? |
| --- | --- | --- | --- |
| `write_pantheon_entry` | create | `02 - Research/<date> <title>.md` | No — `ensure_unique_path` (`pantheon.rs:275`) suffixes on collision |
| `save_attachment_to_vault` | create | `02 - Research/_attachments/<file>` | No — `ensure_unique_attachment_path` (`attachments.rs:55`) suffixes |
| `write_memory_artifact` | **overwrite** | `00 - Dashboard/Olympus Research.base`, `Olympus Projects.canvas` | **Yes** — unconditional `fs::write` (`lib.rs:97`) |

No command appends, deletes, or renames.

`write_memory_artifact` replaces its target wholesale on every call and is reached by **Update Canvas** (Projects panel) and **View Database** (Library panel). Hand edits to those two files — rearranging canvas nodes in Obsidian, for instance — are lost on the next click, with no warning and no undo inside the app.

**There is no approval or confirmation step on any vault write today.** `safe_join` (`lib.rs:42`) rejects `..` traversal on the `write_memory_artifact` path only; it is a containment check, not an approval gate.

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
