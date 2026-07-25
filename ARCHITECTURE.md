# Olympus — Architecture

## Stack

- **Frontend:** React + TypeScript, built with Vite
- **Desktop shell:** Tauri (Rust)
- **Persistence:** SQLite via Tauri commands; browser `localStorage` as a development fallback
- **Knowledge layer:** Obsidian vault at `Desktop/Projects/Obsidian vaults/Olympus Obsidian Vault`

Runtime: `react`, `react-dom`, `lucide-react`, `framer-motion`, `@tauri-apps/api`, `@fontsource/inter`, `@fontsource/jetbrains-mono`.
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

## Data flow

Dashboard panels compose from `src/App.tsx`. Live data sources:

- **Markets** — Finnhub for S&P 500, Nasdaq 100, Dow; FRED for treasuries (`DGS2`, `DGS10`, `DGS30`)
- **Weather** — Open-Meteo (no key required)
- **Pantheon** — reads the Obsidian vault's `00 - Dashboard/Olympus Research.base`
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
FINNHUB_API_KEY=
FRED_API_KEY=
```

`.env` is gitignored and loaded by `load_olympus_env()` in `src-tauri/src/lib.rs`, which resolves it relative to the Cargo manifest — so it belongs at the repo root, next to `package.json`. Open-Meteo requires no key.

---

For higher-level system framing, project context, and decision history, see the Obsidian vault — particularly `09 - System/System Architecture.md`, `09 - System/Dashboard Information Architecture.md`, and `04 - Decisions/Decision Log.md`. The original April 25, 2026 codebase discovery report is archived at `09 - System/2026-04-25 Olympus Architecture Discovery.md`.
