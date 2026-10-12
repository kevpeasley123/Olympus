# Olympus

A local-first AI command station for projects, research, workflows, and Obsidian-backed memory. Tauri + React + TypeScript desktop app, Rust backend, SQLite persistence, Obsidian vault as the knowledge layer.

## Canonical product manual

Read `OLYMPUS-MANUAL.md` first. It is the shared product and operating manual
for Claude, Codex, and future agents. This file adds implementation and model
constraints; it does not redefine the product vision.

The goal is a JARVIS-style assistant: something you talk to that knows your projects and remembers what you decided. See `ARCHITECTURE.md` for the stack and layout.

## Running it

```bash
npm run tauri dev    # desktop shell — the real app (needs Rust: https://rustup.rs/)
npm run dev          # browser only — no API key, no SQLite, degraded chat
npm run build        # tsc + vite build
cd src-tauri && cargo test --lib
```

On startup the Rust side logs two lines worth checking when debugging:

```
[Olympus::Env] loaded .env from ...      # API keys found
[Olympus::Db] opened ...olympus.sqlite   # database ready
```

## Invariants

Break these and something breaks quietly rather than loudly.

**API keys stay in the Rust process.** `.env` is loaded by `load_olympus_env()` in `src-tauri/src/lib.rs` and read via `std::env::var`. Never move an API call to the frontend — the webview must never see a key.

**One source of truth per runtime.** Desktop persists to SQLite; the browser dev server persists to `localStorage`. `src/services/storage.ts` picks the backend via `isTauriRuntime()`. Don't try to sync them.

**Hydration is async and gated.** State starts at seed and hydrates from SQLite after mount. The save effect waits on `hydrated` — without that gate, seed defaults overwrite real stored state on first render.

**Conversation appends, preferences upsert.** Settings and tool flags are small and bounded, so they rewrite freely. Chat history is unbounded and appends at send time. Never fold conversation back into a whole-state save — it would rewrite the entire history every time the 60-second project scan ticks.

## Primary reasoning

The default route is OpenAI Responses (Sol, medium), with explicit one-request Astra Deep Analysis (high). Read `docs/MODEL-ROUTING.md`. Central IDs live in `commands/models.rs`. Preserve local history, `store: false`, structured voice output, and request provenance. Claude Code delegation remains a separate execution driver.

## Anthropic API constraints

The explicit Claude comparison route calls `claude-opus-5`, defined as `CLAUDE_MODEL` in `src-tauri/src/commands/models.rs`; `src-tauri/src/commands/assistant.rs` builds and sends the request. These are current and counterintuitive — **verify against the `claude-api` skill rather than writing from memory**, which is likely stale:

- `temperature`, `top_p`, `top_k`, and `budget_tokens` all return **400** on this model. Don't add them.
- `effort` goes inside `output_config`, not top-level.
- Thinking is **on by default**. `max_tokens` caps thinking *and* response text together.
- Thinking blocks come back with empty text. Extract by filtering for `type == "text"` — never take `content[0]`.
- A refusal is **HTTP 200** with empty content and `stop_reason: "refusal"`. Check `stop_reason` before reading content.
- The messages array must open on a `user` turn. Seeded system/assistant turns are dropped in `prepare_messages`.

`src-tauri/src/commands/assistant.rs` has unit tests pinning the request payload shape, since the live API can't be called from CI. If you change the request, update `request_payload_matches_the_model_contract`.

## Product decisions

Settled in conversation with the owner — treat as given unless he revisits them.

**Voice: dry and economical.** State what happened, offer the thing that wasn't asked for but is needed, stop. No "Great question", no exclamation marks, no enthusiasm it hasn't earned. This is encoded in the system prompt in `assistant.rs` and applies to the app's own copy too.

**It speaks first once, when it opens.** Decided 2026-09-28, following `OLYMPUS-MANUAL.md` Proactivity stage 1: a short project briefing composed deterministically from provable state (commits since the last launch, recorded checkpoints, the operator's own next step), spoken when Auto Speak is on, and switchable off with the Opening Briefing preference. See `src/services/openingBriefing.ts`. Otherwise it reacts to the operator's initiation. Scheduled rhythms (a morning brief, an end-of-day close-out) are wanted *later* — `08 - Daily Briefs` in the vault is their destination. Not now.

Background Communications situation analysis, approved by the operator and recorded in `OLYMPUS-MANUAL.md`, runs while the app is open and only updates the Communications view (it can be paused).

**It acts, with an approval gate, and advises when needed.** Reads run freely; writes surface a confirmation before touching disk or project state. This is already the README's stated safety model.

**It remembers, selectively.** Two tiers: SQLite holds the raw conversation log (complete, searchable, invisible); the vault holds promoted notes (curated, human-readable, permanent). Not every exchange earns a vault note — that would bury the vault in "what's the weather" within a month.

## Vault

Ten folders at `C:\Users\kevpe\OneDrive\Desktop\Projects\Obsidian vaults\Olympus Obsidian Vault`:

```
00 - Dashboard   05 - Skills
01 - Projects    06 - Agents
02 - Research    07 - Templates
03 - Tasks       08 - Daily Briefs
04 - Decisions   09 - System
```

`write_memory_artifact` (in `lib.rs`) regenerates the two derived dashboard artifacts, named by an enum so Rust chooses the path, through the write gate. PowerShell scripts in `scripts/` scaffold and repair the structure.

## Where state lives

This file holds no project state, on purpose: every copy of "what is done and
what is next" kept here went stale. Read these instead:

- `docs/NEXT-SESSION.md` — current version, what is in flight, open decisions,
  known issues and next steps. Rewritten, not appended, each session.
- `docs/RELEASES.md` — one line per release.
- `AGENTS.md`, "Keeping guidance current" — which document owns which kind of
  fact, and the rules that keep them true. They apply to Claude as well.

## "Bring everything current"

The owner's standing instruction, decided 2026-09-30. When he says it (or plainly means it), every step below is already approved; do not ask again. The goal: the next time he opens the desktop app, it runs everything that has been finished.

1. **Push this session's work.** Commit and push finished work on the session's branch. Half-done work stays on its branch and is named in the report.
2. **Find pending work.** Branches on `origin` that are ahead of `master` and whose last commit is newer than master's latest release commit. Older branches (the July 2026 experiments) are superseded: leave them and do not list them.
3. **Check each one.** Merge `master` into it and run `npm run build`, `cargo test --lib --manifest-path src-tauri/Cargo.toml`, every `scripts/test-*.mjs`, and `npm run visual:review`. If anything is red, fix it when it is plainly this branch's fault. Otherwise, stop for that branch and report it; never merge red.
4. **Release.** Bump the minor version in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` and `src-tauri/tauri.conf.json`. Add a line to `docs/RELEASES.md`: the version, what it includes, and what is not yet accepted in the desktop app. Rewrite `docs/NEXT-SESSION.md` for the new version, then run `node scripts/test-guidance-docs.mjs` again; it fails until both docs name the version.
5. **Merge.** Open a pull request into `master` with a merge commit, and merge it. Delete nothing.
6. **Install.** In a session on the owner's PC, run `npm run update` from the Olympus checkout (`scripts/update-olympus.ps1`). It fast-forwards to `origin/master`, closes the app, builds and installs the MSI, and relaunches. A cloud session cannot reach the PC: finish by telling him to double-click **Update Olympus** on his desktop.

It never authorizes force-pushes, history rewrites, skipped or disabled tests, touching `.env`, credentials, production data or the vault, or widening Gmail permissions. Desktop acceptance is not a gate; the release line records what has not been accepted. Report in three lines: what was released (version, branches), what was held back and why, and what he has to do (usually nothing, or the icon).

## Conventions

- Match the surrounding code's comment density and idiom. Comments explain constraints the code can't show, not what the next line does.
- Verify before claiming. `cargo test --lib` runs the portable suite; machine-bound real-vault checks are `#[ignore]` and run with `cargo test --lib -- --ignored` on the owner's machine. Say a check passes only when you have run it.
- A change that adds, removes or alters behaviour a document describes updates that document in the same commit. Removing a UI entry point counts.
- The desktop app can't be launched from a headless environment. Compilation and unit tests are not the same as the app working — say which one you actually did.

## Shared project memory
Follow the vault's `09 - System/Vault Maintenance Protocol.md` for meaningful milestones and handoffs. Local vault: `C:/Users/kevpe/OneDrive/Desktop/Projects/Obsidian vaults/Olympus Obsidian Vault`. Capture independent session records, reconcile current summaries from fresh evidence, and distinguish intent from runtime authority. The local `olympus-memory` skill provides a compare-and-write helper. Missing coverage and inaccessible vaults must be reported; do not claim all sessions have contributed.
