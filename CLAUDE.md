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

## Anthropic API constraints

The chat panel calls `claude-opus-5` from `src-tauri/src/commands/assistant.rs`. These are current and counterintuitive — **verify against the `claude-api` skill rather than writing from memory**, which is likely stale:

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

**It does not speak first.** Reacts to the operator's initiation only. Scheduled rhythms (a morning brief, an end-of-day close-out) are wanted *later*, once the project is in a good state — `08 - Daily Briefs` in the vault is their destination. Not now.

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

`write_memory_artifact` (in `lib.rs`) writes approved artifacts into it, with path-traversal guarding. PowerShell scripts in `scripts/` scaffold and repair the structure.

## State of play

Done:

1. **Frontend wired to SQLite** — connection opened once at startup and held in managed state; `settings`, `tool_states`, and `conversation_messages` tables; automatic import of existing `localStorage` data on first desktop launch.
2. **Real model behind the chat panel** — replaced a keyword scorer and hardcoded reply templates with an actual Anthropic call, with pending and error states in the UI.
3. **The write gate** — every vault write declares a `WriteIntent`, is proven contained, and asks the operator before touching anything it did not author. See `ARCHITECTURE.md`.
4. **Observations** — `append_profile_observation` adds one dated line to `09 - System/Profile Observations.md`, atomically and always with confirmation. Written from the Chat panel; deliberately kept out of the assistant's own context.
5. **Decision history in assistant context** — the in-app assistant receives at
   most the newest 16,000 characters of `04 - Decisions/Decision Log.md`, in a
   separate cached section labelled as historical evidence rather than standing
   instruction. Current direction outranks it, and Profile Observations remain
   excluded.

Next up:

6. **Complete the curated-memory loop** — selective Pantheon body retrieval and
   deliberate chat promotion remain separate work. Do not turn the entire
   research library into standing prompt context.

`docs/HANDOFF.md` is the current session handoff and is more specific than this
section. (`OLYMPUS-BRIEF.md` and `STATE-REVIEW.md` were earlier state documents,
both superseded by it and deleted on 2026-07-31 — git history has them.)

## Conventions

- Match the surrounding code's comment density and idiom. Comments explain constraints the code can't show, not what the next line does.
- Verify before claiming. `cargo test --lib` and `npm run build` both pass on this branch; say so only when you've run them.
- The desktop app can't be launched from a headless environment. Compilation and unit tests are not the same as the app working — say which one you actually did.
