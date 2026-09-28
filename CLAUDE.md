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

## State of play

Done, in order (early items are historical; details in `docs/NEXT-SESSION.md` and the release notes):

1. **SQLite persistence** — first wired as `settings`, `tool_states` and `conversation_messages`, with automatic import of `localStorage` on first desktop launch. `src-tauri/schema.sql` now holds every table.
2. **A real model behind chat** — originally an Anthropic call replacing a keyword scorer. Since 0.9.0 the default is OpenAI Responses; Claude is the explicit comparison route (see Primary reasoning).
3. **The write gate** — every vault write declares a `WriteIntent`, is proven contained, and asks the operator before touching anything it did not author. See `ARCHITECTURE.md`.
4. **Observations** — `append_profile_observation` adds one dated line to `09 - System/Profile Observations.md`, atomically and always with confirmation. Written from the Chat panel; deliberately kept out of the assistant's own context.
5. **Decision history in assistant context** — at most the newest 16,000 characters of `04 - Decisions/Decision Log.md`, in a separate cached section labelled as historical evidence rather than standing instruction. Current direction outranks it, and Profile Observations remain excluded.
6. **Selective research and chat promotion** — bounded question-relevant excerpts with persisted provenance, and a reviewed chat-to-Decision-Log path. See `docs/CURATED-MEMORY.md`.
7. **Verified operator approval** (0.3.0) — delegation starts only from a backend approval record for the exact task and scope. See `docs/OPERATOR-APPROVAL-DESIGN.md`. The Coding Delegate is implemented and unproven: no completed run.
8. **Communications and 0.19.0** — the Communications mode arrived across 0.16.0–0.18.0 (native read-only Gmail, then situation maps and briefings). 0.19.0 (September 24, 2026) added GPT-6 Sol/Astra routing, saved workflow inspection, the Research @1 / Verification @1 agent pair, and Command's operational Agent Catalog. See `docs/RELEASE-0.19.0.md`.
9. **2026-09-28 review fixes** — most findings in `docs/reviews/2026-09-28-v0.19.0/` were fixed on this branch, some partially and one deferred: webview script and navigation hardening, vault writer and attachment hardening, delegation containment, Gmail sync degradation, and model stream handling. Status per finding is in `REMEDIATION.md` there. Compiled and unit-tested; not yet accepted in the desktop app.

Next (from `docs/NEXT-SESSION.md`):

- Desktop acceptance of the review fixes, using the checklist in `docs/NEXT-SESSION.md`.
- One scoped, explicit paid Research UI run once API credit is available. Not another agent role or a general framework.
- Home semantic navigation: approved as an independent slice, not started.

Do not turn the research library into standing prompt instructions. Do not treat the Coding pilot as a prerequisite; the operator removed it.

`docs/NEXT-SESSION.md` is the current session handoff and is more specific than this section. `docs/HANDOFF.md` is historical. (`OLYMPUS-BRIEF.md` and `STATE-REVIEW.md` were earlier state documents, deleted on 2026-07-31 — git history has them.)

## Conventions

- Match the surrounding code's comment density and idiom. Comments explain constraints the code can't show, not what the next line does.
- Verify before claiming. `cargo test --lib` runs the portable suite; machine-bound real-vault checks are `#[ignore]` and run with `cargo test --lib -- --ignored` on the owner's machine. `cargo test --lib` and `npm run build` both pass on this branch; say so only when you've run them.
- The desktop app can't be launched from a headless environment. Compilation and unit tests are not the same as the app working — say which one you actually did.
