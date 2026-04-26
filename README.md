# Project Olympus

Project Olympus is a local-first AI command station for projects, research, workflows, reusable skills, and Obsidian-backed memory.

## V1 Shape

- Desktop shell: Tauri + React + TypeScript + Vite
- Visual identity: futuristic AI lab with professional command-center density
- Core screen: living project constellation
- Modules: operator brief, active projects, research inbox, skills/scaffolds, personal profile, and next actions
- Memory surface: Obsidian-flavored Markdown artifacts, with JSON Canvas and Bases export previews
- Safety model: human-approved actions before writing memory artifacts or changing project state outside the app

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

Open the Vite URL shown in the terminal.

## Live Markets and Weather Setup

Olympus now expects two local environment variables for live market data in the Tauri desktop shell.

1. Copy `.env.example` to `.env`
2. Fill in:

```text
FINNHUB_API_KEY=
FRED_API_KEY=
```

Where to get them:
- Finnhub (free): `https://finnhub.io/register`
- FRED (free): `https://fred.stlouisfed.org/docs/api/api_key.html`

Notes:
- Markets use **Finnhub** for S&P 500, Nasdaq 100, and Dow quote data
- Treasury rates use **FRED** for `DGS2`, `DGS10`, and `DGS30`
- Weather uses **Open-Meteo** and does not require an API key
- `.env` is ignored by Git and should not be committed

## Desktop Build

Tauri requires Rust and Cargo.

```bash
npm run tauri dev
```

Rust is not bundled with this repo. Install it from `https://rustup.rs/` before running the desktop shell.

## Current Persistence

The frontend uses browser `localStorage` as a working V1 fallback. The Tauri shell includes a SQLite schema in `src-tauri/schema.sql` and commands for initializing the local database and writing approved Obsidian memory artifacts. Wiring the frontend to those commands is the next persistence step after the desktop runtime is available.
