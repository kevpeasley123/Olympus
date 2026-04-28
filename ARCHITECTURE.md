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

Tauri commands exposed by the desktop shell: `initialize_database`, `write_memory_artifact`, `launch_quick_app`.

## Data flow

Dashboard panels compose from `src/App.tsx`. Live data sources:

- **Markets** — Finnhub for S&P 500, Nasdaq 100, Dow; FRED for treasuries (`DGS2`, `DGS10`, `DGS30`)
- **Weather** — Open-Meteo (no key required)
- **Pantheon** — reads the Obsidian vault's `00 - Dashboard/Olympus Research.base`
- **Projects / Git** — local repository inspection via Tauri commands

Seeded fallbacks live in `src/data/seed.ts`. State is plain React (`useState` / `useEffect` / `useMemo`); persistence in development uses `localStorage` via `src/services/storage.ts`. Desktop-mode persistence and OS-level operations go through the Tauri commands listed above.

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
FINNHUB_API_KEY=
FRED_API_KEY=
```

`.env` is gitignored. Open-Meteo requires no key.

---

For higher-level system framing, project context, and decision history, see the Obsidian vault — particularly `09 - System/System Architecture.md`, `09 - System/Dashboard Information Architecture.md`, and `04 - Decisions/Decision Log.md`. The original April 25, 2026 codebase discovery report is archived at `09 - System/2026-04-25 Olympus Architecture Discovery.md`.
