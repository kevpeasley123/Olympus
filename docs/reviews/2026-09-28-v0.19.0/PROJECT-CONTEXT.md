# Project context — Olympus as the code stands at 0.19.0

This document describes commit `e4669c9`. It is based on source first and documents second. Where the two disagree, see DOCUMENTATION-DRIFT.md.

## Repository state

| Ref | Commit | Version | Notes |
| --- | --- | --- | --- |
| `origin/agent/curated-memory` | `e4669c9` (2026-09-24) | 0.19.0 | Newest implementation; 11 commits ahead of master |
| `origin/master` | `8731ef7` | 0.11.1 | The 0.12–0.19 releases exist only on the branch |
| `origin/codex/vision-foundation` | `2be5532` | 0.1.0 | Historical foundation |
| `origin/agent/decision-log-context` | `c7ed98a` | 0.2.1 | Historical |
| `origin/agent/briefing-delegation-foundation` | `b5993a4` | 0.2.0 | Historical |

The version is consistent across `package.json:3`, `src-tauri/Cargo.toml:3` and `src-tauri/tauri.conf.json:4`. The docs say installation of 0.19.0 is recorded only in an external receipt (`output/olympus-0.19.0-install`), which this review could not see.

## Stack

- **Frontend:** React 18, TypeScript 6 (strict), and Vite 8 (rolldown). three.js is lazy-loaded for the Command instrument. The main chunk is 1,248 kB; the `hybridScene` chunk is 681 kB.
- **Backend:** Tauri 2 and Rust 2021, with these main dependencies:
  - `rusqlite` (bundled)
  - `reqwest` with rustls
  - `keyring` (Windows native)
  - `html2text`, `pdf-extract`, `rfd`
- **Capabilities:** `core:default` and `opener:default` only. There is no fs or shell plugin. **CSP is `null`.**
- **Persistence:** SQLite, with 43 tables:
  - 41 are in `schema.sql`, applied at startup (`lib.rs:38,83`).
  - 2 are created lazily in `research_verification.rs:137`.
  - 6 declared tables are unused.
- **Knowledge:** the Obsidian vault, with ten folders. Writes go through the `WriteIntent` gate, and vault git commits are made per file.

## Surfaces

Modes are defined in `useDashboardMode.ts:9-18`. Preferences is a modal.

- **Command:**
  - A 3D-only omega instrument with a project ring and note constellation. The SVG fallback has been removed.
  - A console with Dormant, Engaged and Transcript states.
  - A read-only Agent Catalog on the left.
- **Project:**
  - The Project Command Board.
  - Claude Code delegation through `DelegationPanel`, which ProjectsPanel embeds. It uses backend-issued approvals and a completion review.
- **Research (Pantheon):**
  - A curated library with bounded retrieval into chat.
  - The Knowledge Audit graph.
  - The Research @1 / Verification @1 agent pair.
- **Communications:**
  - Read-only Gmail: OAuth with PKCE, a SQLite cache and full-text search.
  - Communication Intelligence (graph `communication-intelligence/v4`).
  - Situations, relationship maps and dossiers, local documents, and local reply drafts.
  - Background situation analysis every 5 minutes while the app is open.
- **Memory:**
  - Promotion from chat to the Decision Log, and Profile Observations.
  - Both go through the write gate.
  - The newest 16 kB of the Decision Log goes into context, labelled historical.
- **Voice:**
  - OpenAI Realtime over WebRTC, using an ephemeral client secret.
  - Typed or spoken replies.
  - Structured voice output that can emit only allowlisted navigation actions.

## Models

Defined in `src-tauri/src/commands/models.rs`.

| Constant | ID | Use |
| --- | --- | --- |
| `PRIMARY_MODEL` | `gpt-6-sol` | Default chat (OpenAI Responses, medium effort, `store:false`) |
| `DEEP_MODEL` | `gpt-6-astra` | Explicit one-request Deep Analysis (high effort) |
| `CLAUDE_MODEL` | `claude-opus-5` | Explicit Claude comparison route |
| `REALTIME_MODEL` | `gpt-realtime-2.1` | Voice |
| `TRANSCRIPTION_MODEL` | `gpt-4o-mini-transcribe` | Transcription |
| `CODING_MODEL` | `sonnet` | Claude Code delegation |

Environment:
- `OPENAI_API_KEY` is required for the primary route.
- `ANTHROPIC_API_KEY` is optional; it is used for the Claude route and the delegation child.

## IPC surface

`lib.rs:341-397` registers 76 commands.

| Group | Commands |
| --- | --- |
| Situations | 9 |
| Communication Intelligence | 7 |
| Gmail | 10 |
| Assistant | 1 |
| Knowledge audit | 3 |
| Research/Verification | 5 |
| Agent catalog | 1 |
| Models | 3 |
| Voice | 1 |
| Persistence | 6 |
| Vault | 11 |
| Write gate | 1 |
| Live data | 2 |
| Shell/files | 4 |
| Delegation | 8 |
| Delegation review | 4 |

Any script in the webview can call all of them (see FINDINGS S-2).

## Process launches

- `git`, from project scans (read-only) and vault commits
- `claude`, for delegation
- `npm` and `cargo`, for delegation checks
- `tasklist` and `taskkill`
- `cmd /C start`, for `open_vault_note`
- the opener plugin, for the Gmail OAuth browser and local situation documents

## Agents

Defined in `command_agents.rs:45-59`.

- **Olympus Core:** the orchestrator, listed separately.
- **Research @1 and Verification @1:**
  - Read-only, with no tools. They make structured-output calls on `PRIMARY_MODEL`.
  - They run in a fixed graph with one bounded clarification.
  - Status is AVAILABLE or UNAVAILABLE depending on configuration.
- **Coding Delegate:** legacy status, with no completed run on record. It would still read UNPROVEN after a completed run because of FINDINGS M-9.

## Direction, as the newest documents record it

- The operator removed the Coding-pilot prerequisite. The next evidence wanted is a scoped, paid Research UI run once API credit is restored.
- Home semantic navigation is approved as the next independent slice and has not started (`docs/NEXT-SESSION.md:41-44,63-64`).
- Paid model acceptance for GPT-6 is unproven; earlier attempts hit `credit_balance_exhausted`.
- Installed desktop acceptance for delegation, memory promotion, Gmail beyond the initial import, and voice acoustics is outstanding by the docs' own account.
