# Olympus — State Review

_Date: 2026-05-17 · Branch: `master` @ `0af5228` (up to date with `origin/master`) · Working tree: clean_

## TL;DR

Olympus is in a stable, just-shipped state — last work landed the Pantheon write path with file attachments. The dashboard renders eight panels backed by a mix of live Tauri sources (markets, weather, projects, vault tasks, vault research) and seeded data (tools, quick apps, chat). Real gaps are minor: dead `NowPlayingPanel` file, stale `ARCHITECTURE.md`, hard-coded vault path in `commands/mod.rs`, no `CLAUDE.md` despite project conventions referencing one.

## Phase 1 — Repository state

- **`git status`**: clean working tree, branch `master` up to date with `origin/master`.
- **Recent commits (last 20)**: dominated by Pantheon work (top 3 = scanner → modal/wiring → vault write + attachments), Action Queue (commits 5–7), and an emblem/header polish run before that. No in-progress branches.
- **Uncommitted diff**: none.
- **Branches**: only `master` (tracking `origin/master`).
- **Build artifacts**: `node_modules/`, `src-tauri/target/`, `dist/` all present.
- **Config mtimes**: `package.json` 2026-04-27 23:54, `src-tauri/Cargo.toml` 2026-04-28 20:15, `tauri.conf.json` 2026-04-28 18:17. Configs are roughly two weeks old — match the period of recent Pantheon/attachment work.

## Phase 2 — Codebase inventory

**`src/components/panels/`** (11 files)
- `ActionQueuePanel.tsx` 6.2 KB
- `AmbientDock.tsx` 7.6 KB
- `ChatPanel.tsx` 1.7 KB
- `HeaderBar.tsx` 1.7 KB
- `LibraryPanel.tsx` 46.9 KB ← largest by far (Pantheon UI + modals)
- `MarketsPanel.tsx` 6.0 KB
- `NowPlayingPanel.tsx` 1.2 KB ← **orphaned, not imported anywhere App-side**
- `ProjectsPanel.tsx` 2.7 KB
- `QuickbarPanel.tsx` 2.0 KB
- `ToolBelt.tsx` 1.5 KB
- `WeatherPanel.tsx` 4.5 KB

**`src/hooks/`** (3 files)
- `useActionQueue.ts` 1.1 KB · `useDashboardData.ts` 10.5 KB · `usePantheon.ts` 1.2 KB

**`src/services/`** (7 files)
- `launcher.ts` 0.7 KB · `liveData.ts` 1.4 KB · `obsidian.ts` 5.3 KB · `pantheonAnalysis.ts` 8.3 KB · `pantheonChat.ts` 5.1 KB · `storage.ts` 3.1 KB · `tauri.ts` 0.6 KB

**`src-tauri/src/commands/`** (7 files)
- `attachments.rs` 7.8 KB · `markets.rs` 10.3 KB · `mod.rs` 0.3 KB · `pantheon.rs` 22.5 KB ← largest · `projects.rs` 5.9 KB · `tasks.rs` 7.9 KB · `weather.rs` 6.5 KB

**Root level**
- Markdown: `README.md` (3.7 KB), `ARCHITECTURE.md` (2.6 KB). **No `CLAUDE.md`.**
- JSON: `package.json` (1.0 KB), `package-lock.json` (128 KB), `tsconfig.json` (0.5 KB).
- Config: `vite.config.ts` (0.4 KB), `index.html` (0.3 KB).

## Phase 3 — Key file summaries

**`src/App.tsx`** — Renders `HeaderBar` plus a 3-column dashboard grid. Left rail: `ToolBelt` + `QuickbarPanel`. Center stack (top→bottom): `ActionQueuePanel`, `MarketsPanel`, `ProjectsPanel`, `LibraryPanel` (Pantheon). Right stack: `WeatherPanel`, `ChatPanel`. `AmbientDock` floats over everything. Focus mode is a top-level toggle persisted to `localStorage` under `olympus.focusMode`; `useDashboardData` supplies all panel state.

**`src-tauri/src/lib.rs`** — Registers 13 Tauri commands: `initialize_database`, `write_memory_artifact`, `launch_quick_app`, `restart_olympus`, `fetch_market_quotes`, `scan_tracked_projects`, `fetch_weather`, `fetch_action_queue`, `fetch_pantheon_entries`, `write_pantheon_entry`, `pick_attachment_file`, `extract_pdf_text`, `save_attachment_to_vault`. Embeds `schema.sql` for SQLite init, loads `.env` from a list of candidate paths on startup, opens Spotify/Discord/X/YouTube via Windows shell from `launch_quick_app`. Path safety: `safe_join` rejects `..` traversal before any `write_memory_artifact` call.

**`src-tauri/Cargo.toml`** — Tauri 2 with the opener plugin; serde + serde_json + serde_yaml for frontmatter; `rusqlite` (bundled SQLite); `reqwest` blocking + rustls for API calls; `chrono` for timestamps; `dotenvy` for env loading; `walkdir` for vault scanning; `pdf-extract` for attachment OCR-free text; `rfd` for native file picker; `once_cell` for the projects cache.

**`package.json`** — React 18.3 + TypeScript 6 + Vite 8; `motion` (Framer Motion successor) + `lucide-react` + `simple-icons` for the visual layer; `gray-matter` for frontmatter parsing in the Pantheon modal; `react-markdown` + `remark-gfm` + `rehype-raw` for rendering Pantheon entries; three Fontsource fonts (Cinzel, Inter, JetBrains Mono); `@tauri-apps/api` for invoke. Scripts: `dev`, `build`, `preview`, `tauri`. No test runner declared.

**`ARCHITECTURE.md`** — Stack overview (React/Tauri/SQLite/Obsidian). **Stale**: it lists only `initialize_database`, `write_memory_artifact`, `launch_quick_app` as Tauri commands (actual count is 13). Mentions `framer-motion` (replaced by `motion`). Data-flow section correctly describes Finnhub/FRED/Open-Meteo/Pantheon/Projects-Git sources. Notes that deeper system framing lives in vault System notes.

**`CLAUDE.md`** — **Does not exist.** No file in repo or anywhere under the working tree. The user prompt referenced it; either it was never created or it's only in user-level Claude config.

## Phase 4 — Vault state (read-only)

Vault root: `Desktop\Projects\Obsidian vaults\Olympus Obsidian Vault`.

**`00 - Dashboard/`** — `Olympus Home.md`, `Olympus Projects.canvas` (5.7 KB, last written 2026-04-28 — matches `syncProjectsCanvasToVault` output), `Olympus Research.base` (1.4 KB, last written 2026-04-28 21:38 — matches `syncResearchBaseToVault` output).

**`01 - Projects/Olympus/`** — single file: `Design Evolution.md` (26 KB, 2026-04-27).

**`02 - Research/`** — three Pantheon entries: `2026-04-26 Andrej Karpathy - How to use LLMs.md` (27 KB), `2026-04-28 Test entry.md` (219 B), `2026-04-28 Workflow for AI Coding.md` (91.5 KB). No `_attachments/` folder yet (would be created on first attachment save).

**`03 - Tasks/`** — single file: `Olympus Next Actions.md` (553 B). **6 open `- [ ]` checkboxes, 0 completed.** These are the starter onboarding tasks (review starter vault, open Map canvas, add real source, fill User Profile, define scaffold recipe, create first daily brief).

**`04 - Decisions/`** — single file: `Decision Log.md` (8.0 KB, 2026-04-27).

**`09 - System/`** — 8 files totaling ~21 KB: `Olympus Charter.md`, `Codex Layer Model.md`, `Dashboard Information Architecture.md`, `Pantheon Knowledge Model.md`, `System Architecture.md`, `User Profile.md`, `Vault Maintenance Protocol.md`, `2026-04-25 Olympus Architecture Discovery.md`.

## Phase 5 — Latest design state

1. **Panels & wiring.** All 10 panel components are imported and rendered from `App.tsx`. `NowPlayingPanel.tsx` exists on disk but is not imported (removed by commit `929435f` from the UI but file not deleted). `useDashboardData` still computes and returns `nowPlaying` and `types.ts`/`storage.ts`/`seed.ts` still reference it — orphan code path.
2. **Tauri commands & data flow.** 13 commands registered (see Phase 3). Live wiring:
   - Markets → `fetch_market_quotes` → `MarketsPanel` (60s poll)
   - Weather → `fetch_weather` → `WeatherPanel` (300s poll)
   - Projects → `scan_tracked_projects` with 60s server-side cache → `ProjectsPanel` (60s client poll)
   - Tasks → `fetch_action_queue` → `ActionQueuePanel` via `useActionQueue` (30s poll)
   - Pantheon read → `fetch_pantheon_entries` → `LibraryPanel` via `usePantheon` (60s poll)
   - Pantheon write → `write_pantheon_entry` (+ `pick_attachment_file`, `extract_pdf_text`, `save_attachment_to_vault`) → invoked from `LibraryPanel`'s Add Entry modal
   - Obsidian sync → `write_memory_artifact` → invoked by `ProjectsPanel` (Update Canvas) and `LibraryPanel` (View Database refreshes the `.base`)
3. **Pantheon.** Fully wired end-to-end. Read path: Rust walks `02 - Research/`, parses frontmatter (requires `olympus/research` tag), returns `PantheonEntry[]`. Modal: grouped/recent/all views with keyboard search (Cmd+K), category sidebar with scroll-spy, detail view with markdown + wikilink/callout preprocessing. Write path: form supports title/body/source type/url/date/tags + single attachment (PDF text auto-extracted via `pdf-extract`, can be appended to body). Files saved to `02 - Research/<sanitized title>.md`, attachments to `02 - Research/_attachments/`. Vault refresh triggered after save.
4. **Action Queue.** Working. Rust walks `03 - Tasks`, `08 - Daily Briefs`, `01 - Projects` for `- [ ] task` lines, sorts by folder priority then mtime then line number. UI shows top 3 with "Show all" portal overlay; Esc closes; compact mode flips on focus-mode and shows top task only. Currently fed only by `Olympus Next Actions.md` (no Daily Briefs folder exists in vault yet).
5. **Projects.** Real Git data via `scan_tracked_projects` (reads `rootPath` from settings, derives status/branch/last-commit/dirty/repoState from `git -C`). 60s in-process Rust cache plus 60s client poll. Seeded fallback retained in `seed.ts` for browser-only dev (no Tauri). `nextStep` is templated from `repoState`, not user-edited.
6. **Inconsistencies / incompleteness.**
   - `ARCHITECTURE.md` lists 3 of 13 commands (drifted ~10 commands behind reality).
   - Vault path is hard-coded in `src-tauri/src/commands/mod.rs` as `VAULT_PATH`, but the frontend also threads `settings.vaultPath` through `syncResearchBase` / `syncProjectsCanvas`. Two sources of truth that could diverge.
   - `NowPlayingPanel.tsx` and the `nowPlaying` field in state are dead but still allocated/persisted.
   - `framer-motion` mentioned in `ARCHITECTURE.md`; actual dep is `motion`.
   - No `CLAUDE.md` despite project conventions referencing one.

## Phase 6 — Open work

- **Uncommitted changes**: none.
- **TODO/FIXME/HACK/Stage 2/deferred markers**: none in `src/` or `src-tauri/src/` (grep clean).
- **`console.warn` calls** (4, all intentional — none read as in-progress reminders):
  - `useDashboardData.ts:205` — Markets fallback to seed data
  - `useDashboardData.ts:231` — Weather fallback to seed data
  - `QuickbarPanel.tsx:22` — Quick app launch unsupported outside Tauri
  - `storage.ts:27` — Legacy localStorage research entries detected during migration
- **Tests**: `src-tauri/src/commands/tasks.rs` has a `#[cfg(test)]` block with 8 unit tests for `parse_task_line` plus a `debug_parse_real_vault` integration test. No frontend test infra.
- **Vault checkboxes**: 6 open onboarding tasks remain in `Olympus Next Actions.md`. These are the V1 starter prompts, not implementation debt.

## Concerns

| # | Concern | Where |
|---|---------|-------|
| 1 | `ARCHITECTURE.md` lists 3 of 13 Tauri commands — readers (and you) will get a wrong picture | `ARCHITECTURE.md` line 26 |
| 2 | Hard-coded vault path conflicts with `settings.vaultPath` plumbed through the frontend | `src-tauri/src/commands/mod.rs:10` vs `src/services/obsidian.ts` |
| 3 | `NowPlayingPanel.tsx` + `nowPlaying` state are dead code (removed from UI but still in `seed.ts`, `types.ts`, `storage.ts`, `useDashboardData.ts`) | `src/components/panels/NowPlayingPanel.tsx`, and the 4 files referencing `nowPlaying` |
| 4 | No `CLAUDE.md` in repo — communication conventions the user referenced live elsewhere or were never written | repo root |
| 5 | Pantheon vault scan iterates `02 - Research/` recursively on every 60s poll; the 91 KB `Workflow for AI Coding.md` file gets re-read into memory each cycle. Fine now, will become noticeable as the library grows | `src-tauri/src/commands/pantheon.rs:97-237` |
| 6 | `framer-motion` cited in ARCHITECTURE; actual dep is `motion` | `ARCHITECTURE.md:10` |

Nothing here is blocking; items 1, 3, 4, 6 are documentation/cleanup; item 2 is a quiet correctness risk for anyone changing the vault path in settings; item 5 is a future perf note.
