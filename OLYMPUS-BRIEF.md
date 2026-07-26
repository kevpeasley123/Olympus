# Project Olympus — Context Brief

_Prepared 2026-07-25 for planning in a fresh conversation. Branch `claude/olympus-project-overview-b949xw`._

> **Partially superseded — read `ARCHITECTURE.md` first.** This was written
> before the write-gate work landed. Two things in it are now wrong or stale:
>
> 1. It implies the Daily Brief would be Olympus's first vault write. **It would
>    not.** Three writers have shipped since April 2026 — see the "Vault writes"
>    section of `ARCHITECTURE.md`. This document seeded that error into a
>    planning session; it is corrected here rather than deleted so the mistake
>    stays visible.
> 2. The "Chosen direction" section below lists work that has since been built:
>    the operator profile schema, path containment, and the write gate itself.
>    See the git log from `abce522` onward.
>
> Everything else — the charter, architecture, data sources, and the strategic
> gap between vault and app — still holds.

## What it is

A local-first AI command station — a desktop dashboard for projects, research, workflows, and memory. Not a chat app with a sidebar; the dashboard is the primary surface and the AI is one panel in it.

- **Shell:** Tauri 2 (Rust) + React 18 + TypeScript + Vite
- **Persistence:** SQLite via Tauri commands (`localStorage` fallback in browser dev)
- **Memory layer:** an Obsidian vault at `Desktop/Projects/Obsidian vaults/Olympus Obsidian Vault`
- **Model:** `claude-opus-5`, `effort: medium`, called from Rust so the API key never reaches the webview
- **Platform:** Windows 11

## North star (from the vault Charter)

> Olympus should feel like an extension of the operator: aware of active projects, durable research, preferences, workflows, and **the next useful move**.

Core principles, verbatim from the Charter:

- Obsidian is the durable memory layer.
- The Olympus dashboard is the command interface.
- Research should become reusable memory, not disposable chat context.
- Skills and agents should be explicit, reviewable, and reusable.
- AI-generated actions should ask before risky writes or external effects.

There is also a **two-layer Codex model**: Layer 1 is strategy and lives in the main vault ("the general"); Layer 2 is per-project workspaces with their own AGENTS.md and local skills ("the soldier").

## Current architecture

**Panels** (`src/components/panels/`): HeaderBar, ToolBelt, QuickbarPanel, ActionQueuePanel, MarketsPanel, ProjectsPanel, LibraryPanel (Pantheon), WeatherPanel, ChatPanel, AmbientDock. Three-column grid with a persisted focus mode.

**~18 Tauri commands**, grouped as assistant / persistence / vault / live-data / shell.

**Live data sources:**

| Surface | Source | Cadence |
|---|---|---|
| Markets | Yahoo Finance chart API (indices, no key) + FRED (`DGS2`, `DGS10`, `DGS30`, `MORTGAGE30US`) | 60s |
| Weather | Open-Meteo (no key) | 300s |
| Projects | local `git -C` scan of a projects root | 60s |
| Action Queue | vault scan for `- [ ]` checkboxes | 30s |
| Pantheon | vault scan of `02 - Research/` frontmatter | 60s |
| Chat | Anthropic API from Rust | on send |

Tools, quick apps, and some chrome are still seeded rather than live.

**Vault structure:** `00 - Dashboard`, `01 - Projects`, `02 - Research`, `03 - Tasks`, `04 - Decisions`, `05 - Skills`, `06 - Agents`, `07 - Templates`, `08 - Daily Briefs`, `09 - System`, plus a `Projects Workspace` for Layer 2.

## Where it stands

The app **runs and renders correctly**. That is newer than it sounds: until today every change had been verified only by compilation and unit tests from a headless container, and the first real launch happened this session. Markets, weather, Git project scanning, the vault task scan, the Pantheon scan, SQLite, and the chat panel are all now confirmed working against real services and real files.

Work completed today:

1. **Threading fix** — six data commands were synchronous `#[tauri::command]` functions running blocking I/O on the event loop, the worst being seven sequential HTTP requests with no timeout on a 60s poll. Each is now a thin async wrapper dispatching to `spawn_blocking`; the markets HTTP client got a 10s timeout.
2. **Docs correction** — README and ARCHITECTURE claimed Finnhub for market data; the code has always used Yahoo Finance and never referenced `FINNHUB_API_KEY`.
3. **Bundle icon config** — `bundle.icon` was an empty array.
4. **Assistant vault context (uncommitted)** — see below.

## The strategic gap

**The vault is substantially ahead of the app.** `05 - Skills` holds three written skills, `06 - Agents` holds two agent definitions, `07 - Templates` holds five templates, `08 - Daily Briefs` holds two briefs that stopped in April, and there is a Layer 2 project workspace. **None of this has any surface in the dashboard.** The app reads exactly three things from the vault: research entries, checkbox tasks, and (as of today) the System notes.

**Nothing in Olympus produces "the next useful move."** Every panel is a viewer. The Projects panel's `nextStep` is a template string derived from Git repo state, not a judgment. Olympus can say a repo is dirty; it cannot say what to do about it.

## Chosen direction

Close the gap by **giving the assistant the vault**, then building on top of that.

**Step 1 — done, uncommitted.** The assistant's system prompt now carries durable memory: full text of `User Profile`, `Olympus Charter`, `Skill Index`, and `Agent Index`, plus a metadata-only index of the research library (title, source type, date, word count, path, tags — no bodies). Sent as two system blocks with a prompt-cache breakpoint between them: the stable block (~1,200 tokens, clears Opus 5's 512-token cache minimum) is cached; volatile Git state and the research index sit after the breakpoint so a new commit can't invalidate the cached prefix. Because the index lists titles without bodies, the prompt explicitly instructs the model to name an entry it would need rather than invent its contents.

**Step 2 — planned, not built.** A tool-use loop with `read_vault_note(path)` and `search_vault(query)` so the assistant can pull full text on demand. This requires restructuring the request: message `content` from `String` to a content-block array, plus the `while stop_reason == "tool_use"` loop.

**Then, in rough priority order:**

- **Daily Brief engine** — `08 - Daily Briefs` has two hand-written notes and stopped. Every input already exists (Git state, task queue, Pantheon additions, markets, weather). This would be the first time Olympus *writes* operational intelligence instead of displaying it.
- **Executable skills and agents** — make `05 - Skills` / `06 - Agents` runnable from the dashboard with vault context, honoring the ask-before-writes principle.
- **Projects panel intelligence** — combine Git truth with Obsidian intent so `nextStep` becomes a reasoned recommendation rather than a template.

## Open questions worth planning

Three come from the vault's own `User Profile` and remain unanswered:

- What sources should feed the daily operator brief?
- Which project stacks should become reusable scaffold recipes?
- What agents should exist first?

Plus, from the current state of the build:

- How should skills execute from the dashboard while preserving "ask before risky writes"?
- How much vault access should the assistant have? Today it sees System notes in full and research entries as metadata only — no bodies, no Decision Log.
- What is the right surface for the Codex two-layer model in a dashboard that currently has no concept of it?

## Constraints and conventions

- **Anthropic API contract (Opus 5):** `temperature`, `top_p`, `top_k`, and `budget_tokens` are rejected with a 400; `effort` nests inside `output_config`; thinking is on by default and counts against `max_tokens`. A unit test pins these out of the payload.
- **Prompt caching is a prefix match** — anything that changes invalidates every byte after it. Hence the stable/volatile system split.
- **Two sources of truth for the vault path**: a hard-coded `VAULT_PATH` in `commands/mod.rs` and `settings.vaultPath` threaded through the frontend. They can diverge.
- **Testing:** 49 Rust unit tests; no frontend test infrastructure.
- **Never release-built.** `tauri build` has not been run; only `tauri dev`.
- React `StrictMode` double-invokes effects in dev, so every poll fires twice — visible as duplicate fetches and a doubled vault scan.

## Known debt

- `ARCHITECTURE.md` still cites `framer-motion`; the actual dependency is `motion`.
- `NowPlayingPanel.tsx` is dead code, but `nowPlaying` still lives in `types.ts`, `seed.ts`, `storage.ts`, and `useDashboardData.ts`.
- The Pantheon scan re-reads every research file (including a 17,000-word note) every 60 seconds, twice over in dev.
- Prompt-cache effectiveness is unobservable — the response parser doesn't surface `usage.cache_read_input_tokens`.
- `MAX_TOKENS` is 8,000; tool loops in step 2 will likely need more headroom.
- `load_persisted_state` reads the entire conversation table at startup with no pagination.
