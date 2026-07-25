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

## Assistant Setup

The chat panel is backed by the Anthropic API. Add your key to `.env` in the repo root:

```text
ANTHROPIC_API_KEY=
```

Get one at `https://console.anthropic.com/settings/keys`. API usage is billed separately from any Claude subscription, so the account also needs credit.

How it works:

- The request is made from the Rust side (`src-tauri/src/commands/assistant.rs`), so the key never reaches the webview.
- Model is `claude-opus-5` at `medium` effort. Thinking is on by default on this model; `max_tokens` covers thinking and response together.
- History is capped at the last 40 turns per request to bound cost. The vault, not the message log, is the long-term memory.
- Seeded system and assistant turns are dropped before sending, since the API requires the conversation to open on a user turn.
- Without a key, the desktop app reports the missing key in the chat panel; the browser dev server falls back to the local keyword search over Pantheon entries.

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

Persistence has one source of truth per runtime:

- **Desktop (Tauri):** SQLite, at `olympus.sqlite` in the platform app data directory. The connection is opened once at startup and the schema in `src-tauri/schema.sql` is applied on every launch, so the frontend can assume storage is ready.
- **Browser (`npm run dev`):** `localStorage`, unchanged.

What is stored, and how:

| State | Storage | Write pattern |
| --- | --- | --- |
| Settings (vault path, projects root) | `settings` | Upsert on change |
| Tool enabled flags | `tool_states` | Upsert on change |
| Chat history | `conversation_messages` | Append-only, at send time |

Market data, weather, and the project scan are refreshed live and deliberately not persisted.

Conversation is appended when a message is sent rather than rewritten alongside other state, so a long history costs nothing on unrelated updates. The first desktop launch after an existing browser install imports any `localStorage` state into SQLite automatically.
