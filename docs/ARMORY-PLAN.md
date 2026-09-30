# Olympus Armory — implementation plan

Drafted 2026-09-29 against release 0.20.0 (`c432f48`). Status: **proposed, awaiting Kevin's approval.** Nothing here is built.

## 1. The vision, in one paragraph

Olympus becomes an armed command station. It runs on Kevin's subscriptions instead of paid API calls: Claude Code first, Codex second. It carries an **armory** of tools (Gmail, the vault, projects, research, and later apps and the computer) and a library of **skills**. Olympus Core turns a request into a plan, and Kevin approves the plan once. Olympus then coordinates a **swarm** of worker agents to carry it out, and shows the work happening live. Results come back in clean, purpose-built views, not as walls of chat text. The first showcase is *"Pull all emails from Natalie and organize them from most recent."* A later one is designing something together, iteratively.

## 2. Decisions this plan rests on

Kevin decided these on 2026-09-29:

| Decision | Choice |
| --- | --- |
| Main engine | **Claude Code (subscription) first, Codex (subscription) second** |
| When a subscription limit is reached | **Pause and say so.** Never fall back to paid API calls on its own. |
| Autonomy | **Approve the plan once.** Reads run freely. A multi-agent or write-capable task shows a plan (agents, tools, effects, limits) that Kevin approves once. Sending, deleting, purchases and anything irreversible always ask again. |
| First showcase | **The Gmail task, with the live swarm view** |

This plan also revises earlier guidance. Once Kevin approves it, it is recorded in `OLYMPUS-MANUAL.md` and `CLAUDE.md`:

- "Not another agent role or a general framework" (`CLAUDE.md`, "Next") is withdrawn. It was scope discipline for the Research/Verification slice, not product direction.
- "Rust assembles context; the model calls no tools" becomes: **the model calls Olympus's tools, and Olympus executes them.** Every tool still runs inside the Rust backend, behind the existing gates.
- Primary reasoning moves from OpenAI API (Sol) to **Claude Code on the subscription**. The API routes remain as explicit choices. Realtime voice stays on the API until local voice lands (Phase 9).
- Product priorities are re-ranked (section 13).

Everything else in the manual stands. That includes the write gate, two-tier memory, dry voice, truthful surfaces, Gmail being read-only until Phase 7, and "one instrument, readable across the room" for Command.

## 3. What already exists (0.20.0)

The plan builds on these; it does not replace them.

| Existing piece | Where | Reused for |
| --- | --- | --- |
| Claude Code launcher with Job Object, PID identity, a 45-minute limit, stream-json parsing and cancellation | `delegation.rs` `spawn_claude`, `claude_command`, `supervise`, `inspect_stream_line` | The engine layer's process management |
| Approval records: a whole-subject equality check, consumed once, immutable tables, a 600 s expiry, and a countdown UI | `approvals.rs`, `operator_approvals`, `DelegationPanel.tsx` | Plan approval |
| Write gate: `WriteIntent` → tier → confirm dialog, FIFO queue, 120 s deny-by-default | `vault_write.rs`, `write_confirm.rs`, `WriteConfirmDialog.tsx` | Every vault-writing tool |
| Skill contracts: `SkillContract` (id, version, schemas, allowed capabilities, prohibited effects, loop budget) and `GraphNode` | `workflow.rs`, `communication_skills.rs`, `research_agents.rs` | The skill format and worker definitions |
| Run/event persistence (`*_runs` + `*_events`/checkpoints) and `model_requests` receipts | `schema.sql` | The task and tool-call journal |
| Workflow inspector: an SVG DAG, node inspector, timeline and receipts | `WorkflowInspection.tsx`, `workflowInspection.ts` | The live swarm graph |
| Instrument event bus (`vault-write`, `poll`, `response-start` …) and an unused `execution` prop on `CommandInstrument` | `instrumentEvents.ts`, `CommandInstrument.tsx` | Armory animation in Command |
| Agent Catalog (Olympus Core as orchestrator, plus roles) | `command_agents.rs`, `CommandAgentCatalog.tsx` | The armory inventory |
| Local Gmail cache: FTS5, snapshots, and a date-ordered workspace | `gmail/store.rs`, `gmail/communications.rs` | Gmail tools |
| Acceptance profile and synthetic fixtures | `acceptance.rs`, `scripts/acceptance/*` | Deterministic testing of every new surface |

**Gaps this plan must close:**
- Chat has no tool calling (`responses.rs` test asserts no `tools`) and no cancellation.
- There is no engine abstraction: the only switch is the string `route.provider`.
- There is no cross-run budget ledger.
- Only delegation pushes live events; everything else polls.
- The Natalie query cannot be answered today. `gmail_search` ANDs every word of the question, ranks by relevance, and caps at 2 threads. Sender and date filters don't exist as a query.

**Two defects found while planning. Both are fixed in Phase 0, because they would break the subscription goal:**
1. **Delegation bills the API.** `allowed_environment` deliberately passes `ANTHROPIC_API_KEY` to Claude Code (`delegation.rs:539`), and Claude Code uses an API key ahead of a subscription login. Every delegated run is therefore API-billed. It also passes `--max-budget-usd 5`, which assumes API billing.
2. **Claude Code is found at one hard-coded path:** `%APPDATA%\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe` (`delegation.rs:217`). The native installer Kevin used puts it elsewhere, so delegation would currently fail to find it.

## 4. Architecture

```
            Kevin (console · voice · Operations view)
                          │  request
                          ▼
   ┌──────────────── Olympus Core (Rust) ─────────────────┐
   │  Router ── decides: answer | single agent | swarm    │
   │  Planner ─ plan (agents, skills, tools, limits)      │
   │  Approval ─ plan approved once (approvals.rs)        │
   │  Scheduler ─ spawns workers, concurrency cap, cancel │
   │  Journal ── tasks, agents, tool calls, events        │
   │  Armory ─── tool registry + skill registry           │
   │  MCP host ─ loopback server exposing the armory      │
   └───────┬──────────────────┬──────────────────┬───────┘
           │ engine process   │ engine process   │ …
           ▼                  ▼                  ▼
     Claude Code -p     Claude Code -p      Codex exec
     (subscription)     (subscription)      (subscription)
           │  tool calls over MCP (scoped token)
           ▼
     Armory tools run IN Olympus: Gmail cache, vault (via
     write gate), projects, research, delegation, apps …
```

Six principles:

1. **Engines think; Olympus acts.** Engine processes get **no built-in tools** in chat or worker mode: no Bash, Read, Write or web. Their only tools are Olympus's, served over MCP. Every action therefore passes through Olympus's own gates, journal and acceptance-profile refusals. Coding delegation is the exception: it keeps its sandboxed built-in tools inside a worktree, as today.
2. **Scoped tokens, not trust.** Each worker gets its own MCP bearer token, encoding exactly the tools and effect tiers in its approved plan. A worker cannot call a tool its plan didn't grant, even if the engine is misconfigured or tricked by an email.
3. **Every pixel is a real event.** The swarm view draws only what the journal records. There are no staged animations, following the design review's "nothing fictional on desktop" principle.
4. **Subscription only, by construction.** Engine children are launched with `env_clear` and an allowlist that never includes `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` or `OPENAI_API_KEY`, plus `--setting-sources ""` so no `apiKeyHelper` loads. A startup self-check reports which login each engine will use.
5. **Olympus owns history.** SQLite remains the source of truth for conversations. Engine session files are a cache that may be discarded.
6. **Deterministic tests.** A `ReplayEngine` plays back recorded engine streams, so everything except live model quality is testable without spending subscription limits.

## 5. Phases

Sizes are relative (S ≈ a focused session, M ≈ a few sessions, L ≈ a week of sessions). Each phase ends releasable. Each phase lists its **exit test**, which is what must be true before moving on.

### Phase 0 — Groundwork and engine spike (S–M)

**0a. Record the direction.** Update `OLYMPUS-MANUAL.md` (purpose, the autonomy table's "plan approval" row, the new priorities) and `CLAUDE.md` ("Primary reasoning", "Next"). Add this plan to `docs/`.

**0b. Fix the two delegation defects.**
- Remove `ANTHROPIC_API_KEY` from `allowed_environment` and add the auth self-check.
- Replace `--max-budget-usd` with turn and time limits. Keep a note that API billing is no longer expected.
- Discover `claude.exe` from a configured path, then `PATH` (`where claude`), then the known install locations (native installer, npm global), and report which was found.
- Update the tests that pin the flags (`launches_pin_tools_settings_and_mcp_and_end_options_before_the_prompt`).

**0c. Engine spike on Windows.** This must run in a local session on Kevin's PC, logged into his subscription. It records real behaviour into `docs/ENGINE-SPIKE.md` and saves stream fixtures for the ReplayEngine:
- `claude -p --output-format stream-json --verbose --include-partial-messages`: the event shapes, token deltas, and the `result` event (usage, session id).
- A tiny stub MCP server via `--mcp-config` + `--strict-mcp-config` + `--allowedTools mcp__olympus__*` + `--permission-mode dontAsk`. Confirm built-ins can be fully disabled (`--tools ""` or equivalent) and that unlisted tools are denied.
- `--resume` continuity and time to first token, cold and warm.
- Structured output: can the voice JSON contract be produced reliably (prompt + validation + one repair)?
- **What a usage-limit hit looks like.** The documentation is silent; capture the real event or text so the "pause and say so" behaviour can detect it.
- Where Claude Code writes session transcripts, and whether that can be disabled or redirected to Olympus's app-data directory.
- The same exercise for `codex exec --json`, including its MCP configuration (per-run config file or `-c` override) and its ChatGPT sign-in.
- `--agents` / subagent visibility (`--forward-subagent-text`, `parent_tool_use_id`), recorded for comparison with the Olympus-owned scheduler.

**Exit test:** the spike report answers every item above with captured evidence. Any "impossible" result feeds back into this plan before Phase 1. That is the only way the spike creates a check-in.

### Phase 1 — Engine layer: chat on the subscription (M)

- **`Engine` trait** (Rust): `start(turn) -> stream of EngineEvent {Started, Delta, ToolCall, ToolResult, Notice, Usage, Finished, Failed(kind)}` plus `cancel()`. Implementations:
  - `ClaudeCodeEngine`, using the Phase 0 findings;
  - `ApiEngine`, which wraps today's `responses::complete` and `send_anthropic_message` unchanged;
  - `ReplayEngine` for tests.

  `CodexEngine` follows in Phase 6.
- **Routing:** `models.rs` gains an engine dimension, `Engine::{ClaudeSubscription, CodexSubscription, OpenAiApi, AnthropicApi}`. The default route becomes Claude subscription. Sol, Astra and the Claude API remain selectable routes, labelled as paid.
- **Chat path:** `send_assistant_message` dispatches through the trait. The same system blocks and `<olympus_evidence>` build apply, passed via `--append-system-prompt` plus the turn input. History comes from SQLite each turn, and `--resume` is used only as an optimisation.
- **Chat cancellation (new):** a Stop control in the console, which kills the engine child through the Job Object.
- **Voice:** voice turns use the same engine and must satisfy the `VoiceAnswer` contract (validate, one repair attempt, otherwise the existing `invalid_voice_contract` error). Realtime speech output stays on the API until Phase 9, and Preferences says so plainly.
- **Limit handling:** the `subscription_limit` failure kind pauses the turn with a console notice ("Claude subscription limit reached. Resumes when it resets, or switch engine."). It never retries on the API.
- **Engine status** in Preferences: installed, version, login type (subscription or API key detected and refused), last limit event.
- **Acceptance profile:** engine launches are refused, as providers are today. Acceptance runs use the `ReplayEngine` with recorded fixtures, so the synthetic pass can exercise the whole UI for free.
- **Tests:** replay-driven stream tests; env-allowlist tests asserting no key ever reaches a child; `request_payload_matches_the_model_contract` kept for the API engines; a new engine-contract test.

**Exit test:** with `.env` keys removed, Kevin can hold a normal typed conversation in the installed app, and it shows "Claude · subscription". Model receipts record the engine. A forced limit, via a replay fixture, shows the pause notice.

### Phase 2 — The armory: tools and the first single-agent task (M–L)

- **Tool registry.** `ToolDefinition {id, version, family, title, description, input_schema, output_schema, effect, visual}`:
  - `id` looks like `gmail.messages_by_sender`.
  - `effect` is one of `read | local_write | external_read | external_write | execute | irreversible`.
  - `visual` is the icon, family colour and glyph for the armory view.
  - The registry is compiled Rust, like `SkillContract`.
- **The effect decides the gate:**

  | Effect | Gate |
  | --- | --- |
  | `read` | runs freely |
  | `local_write` | the vault write gate, or plan approval for non-vault local state |
  | `external_read` (e.g. Gmail sync) | allowed within an approved plan |
  | `external_write`, `irreversible` | always a per-action confirmation, even inside an approved plan |
  | `execute` | only through delegation's sandbox |
- **MCP host:** an in-process server bound to `127.0.0.1` on a random port, with a per-launch secret and per-worker scoped tokens. Every call is validated against the schema, checked against the token's grant, executed in Rust and journaled.
- **Journal:** new additive tables `tool_calls(id, task_id, agent_id, tool_id, tool_version, input_json, output_summary, effect, status, started_at, finished_at, approval_id, error)`. A global Tauri event `olympus-activity` streams them live.
- **First tools, all read-only:**
  - `gmail.find_people(name)`: distinct senders and recipients matching a name, with message counts and last-seen dates.
  - `gmail.messages_by_sender(addresses, since?, until?, limit, order)`: date-ordered, `available=1 AND in_scope=1`.
  - `gmail.search(query, filters)`: the existing FTS, plus column filters (sender, subject) and date ordering.
  - `gmail.thread(id)`, and `gmail.coverage()` (horizon, cap, what's synced).
  - `vault.search`, `vault.read_note` (contained paths only).
  - `projects.list`, `projects.status(id)`.
  - `research.search`.

  An additive sender column and index on `gmail_messages` keeps sender queries fast.
- **Result artifacts:** `task_artifacts(id, task_id, kind, payload_json)` with typed renderers. The first kind is `mail-list`: grouped, date-ordered rows reusing the Communications row styling, a coverage line, and a click-through to the thread. The console renders an artifact card with **Open**. This is the "clean interface" rather than raw text.
- **Prompt changes:** remove "You cannot read arbitrary files or run commands". Describe the armory and the effect rules instead. Mail content stays marked as untrusted evidence.

**Exit test:** in the installed app, "Pull all emails from Natalie and organize them from most recent" produces a correct, date-ordered `mail-list` from the local cache in a single agent turn. It states coverage (for example "Inbox and Sent, last 90 days"), and every tool call appears in the journal. If "Natalie" matches several people, Olympus asks which one.

### Phase 3 — Orchestrator, plan approval and the Operations view (L)

- **Router:** answer directly, use a single agent (Phase 2), or run a swarm. It picks the smallest shape that fits, and says which shape and why.
- **Planner:** one engine call returns a structured plan. The plan contains:
  - `goal`;
  - `agents[]`, each with a role, skill, engine, granted tools and dependencies;
  - `limits` (max concurrent workers, default 3; max turns per worker; wall-clock cap, default 20 min);
  - `effects_summary`;
  - `expected_artifacts`.

  The plan is validated (acyclic, tools exist, grants ⊆ what the skill allows).
- **Plan approval:** a `TaskSubject` (the request, plan hash, grants, limits, engine) goes through the existing `approvals.rs` machinery: whole-subject equality, consumed once, a 600 s expiry and immutable records. The plan card lists agents, tools with effect badges, limits and a countdown, with **Approve**, **Edit request** and **Cancel**.
  - Plans that are read-only and single-agent skip approval ("reads run freely").
  - Any `external_write` or `irreversible` step still confirms per action at run time.
- **Scheduler:** spawns workers as engine processes, each with its own scoped MCP token and `--append-system-prompt` from its skill. It respects dependencies and the concurrency cap. It supports cancelling a task or a single worker, and a wall-clock timeout. A subscription limit pauses the whole task, keeps what has completed, and lets it resume later.
- **Synthesis:** a final Core step merges worker outputs into the planned artifacts, with provenance: which worker and which tool calls produced each part.
- **Tables:** `tasks`, `task_agents`, `task_events` (additive), linked to `tool_calls` and `model_requests`.
- **Operations view (a new, fifth mode):** Command's centre is protected by "one instrument", so the lean-in work surface needs its own mode. It has three parts:
  1. a task list (running, paused, done);
  2. the **live swarm graph**, built from `WorkflowInspection`'s DAG and driven by `olympus-activity` events instead of manual refresh;
  3. the results area, with artifact renderers.

  It follows existing patterns: error boundary, view-state slice, shortcut registry and harness.

**Exit test:** the Natalie request, phrased to need it (for example *"…and group them by thread, flag anything awaiting my reply"*), runs as a real swarm:
1. a people-resolver worker;
2. per-address collectors in parallel;
3. an organizer worker;
4. synthesis.

Kevin approves one plan card, watches the graph fill in live, gets a grouped `mail-list` artifact, and can open every tool call behind it.

### Phase 4 — The show: armory and swarm in the instrument (M)

- **Command instrument:** the armory becomes part of the instrument, not a panel. Tool families (Mail, Vault, Projects, Research, later Apps, System, Design) sit as fixed stations on an outer band around the project ring. Skills are small marks at their stations.
- **During a task:** Olympus Core (the Ω) emits a spark per worker. Workers travel to the stations of the tools they call, and edges pulse on each real tool call. Completion settles back into the core. The motion is driven by `olympus-activity` through the existing `instrumentEvents` bus and the unused `execution` prop.
- **Constraints kept:**
  - readable across the room;
  - no cards in the centre;
  - the 2D SVG fallback draws the same stations and events;
  - reduced motion replaces travel with state changes;
  - the scene pauses when Command is hidden;
  - no new visual element without a journal event behind it.
- **Armory inspector:** the left Agent Catalog panel grows an **Armory** tab, listing tools grouped by family with their effect tier, recent calls and the skills that use them. Selecting a station on the instrument selects it there.
- **Gate B (visual review) — one of the planned check-ins.** The manual requires Kevin's decision on visual-language changes. Before the art is finalized, a harness page and screenshots of the armory band, the swarm motion and the Operations graph are presented for one yes / change-this decision.

**Exit test:** on Kevin's GPU, a swarm task visibly plays out on the instrument, frame for frame, from real events. The 2D fallback shows the same thing statically. Gate B is approved.

### Phase 5 — Skills (M)

- **Format:** a skill is a Markdown file with frontmatter in the vault (`05 - Skills/Olympus/<id>.md`). The frontmatter holds `id`, `version`, `title`, `purpose`, `allowed_tools`, `max_effect`, `inputs` and `outputs` (schemas), `limits` and `examples`; the body holds the instructions. It compiles into the existing `SkillContract`. Built-in compiled skills (communication, research, verification) remain.
- **Trust rule:** an edited or new skill file is **inactive until Kevin approves it** in the Armory tab. Approval records the file's fingerprint, and any later change deactivates it until re-approved. This keeps "presence in the library is not endorsement".
- **Teaching:** "Olympus, learn how to …" drafts a skill file through the write gate, shows it, and activates it on approval.
- **First skill pack:**
  - `people-resolver@1`, `mail-collector@1`, `mail-organizer@1` (formalizing Phase 3's workers);
  - `project-briefer@1`;
  - `research-scout@1`, which wraps the existing research agents;
  - `design-brief@1`, used in Phase 8.

**Exit test:** a skill written by Kevin in Obsidian appears in the armory as pending. Once approved, it is usable in a plan, and it deactivates when he edits it.

### Phase 6 — Codex as the second engine (S–M)

- `CodexEngine` over `codex exec --json`, with MCP configured per run from the Phase 0 findings.
- Engine choice per task or per worker, shown in the plan. The default is Claude.
- On a Claude limit, the pause notice offers **Continue on Codex** as a button. It never switches silently, per Kevin's decision.

**Exit test:** the Natalie swarm runs with Codex workers. A replayed Claude limit shows the switch offer, and accepting it resumes the task.

### Phase 7 — Write-capable tools (M)

- **Vault tools** through the write gate: `vault.create_note`, `vault.append`, and `decisions.propose`, which proposes a Decision Log entry without writing it directly.
- **Project tools:** `projects.create_branch`/`worktree` (recoverable, so they run within the plan), and `delegation.start`, which hands off to the existing delegation path under the same plan approval.
- **Gmail drafts and send.** This needs a Google scope upgrade, so Kevin re-consents once; that is a check-in Google itself imposes.
  - `gmail.create_draft` is `external_write`, confirmed per action.
  - `gmail.send` is `irreversible`: a final review of participants and content, then an explicit Send, as the manual already specifies.
- The acceptance profile refuses every external write.

**Exit test:** *"Draft a reply to Natalie's latest thread proposing Thursday"* produces a draft that Kevin reviews and sends from Olympus, with two confirmations and nothing sent without them.

### Phase 8 — Design co-building (L)

- **Conversation phase:** the `design-brief@1` skill asks focused questions and produces a **brief artifact** (goals, audience, references, constraints) that Kevin edits or approves.
- **Build phase:** a delegation run (Claude Code on the subscription) builds a first draft in a sandbox worktree under `app_data`. A local preview server serves it in a sandboxed view in Operations. This needs a scoped CSP addition for the loopback preview origin, reviewed as a security change.
- **Iterate loop:** Kevin comments ("bigger headline, calmer palette"). Each round is a new run on the same worktree, with before/after snapshots and one-click revert to any round.
- **Promotion:** copying the result into a real project is an explicit, approved step.

**Exit test:** from *"design me a landing page for Olympus"*, three rounds of back-and-forth produce a previewable, revertible design, and nothing touches a real project until it is promoted.

### Phase 9 — Local voice (M; independent, can run in parallel with Phases 5–8)

- A local speech-to-text sidecar (whisper.cpp) and local text-to-speech (Kokoro), managed like other child processes. Push-to-talk and the opening briefing use them. Realtime becomes an optional paid route.

**Exit test:** a spoken exchange and the opening briefing with no OpenAI key present, with latency measured and recorded.

### Phase 10 — Computer and apps (L, one connector at a time)

- Extend `launch_quick_app` into an **app-connector** family. Each connector is a tool set with explicit effects. Candidates: Spotify control, calendar, files within approved folders.
- General UI automation (Windows UI Automation) comes last, behind a separate decision. Its effect is `execute` or `irreversible` by default, with per-action confirmation.

**Exit test:** defined per connector. Each connector gets its own short decision, because each opens a new trust boundary.

## 6. Safety model, summarized

- **Grants are enforced by Olympus, not requested of the model.** The MCP token encodes the grant, and the effect tier sets the gate. External writes and irreversible actions always confirm per action.
- **Untrusted content stays data.** Mail, web and file text arrive as marked evidence. A plan that reads untrusted content cannot also hold an unconfirmed `external_write` grant.
- **Engines have no built-in tools** outside delegation's worktree sandbox.
- **No silent spend.** Subscription only, key-free child environments, pause on limits, and API routes used only by explicit choice.
- **Everything is recoverable or confirmed,** following the manual's autonomy table. The journal records every call with its approval id.
- **The acceptance profile covers all of it.** Engines are replayed and external effects refused, so every phase can be accepted on synthetic data first.

## 7. Verification standard for every phase

1. `cargo test --lib`, `npm run build`, every `scripts/test-*.mjs`, and new harness pages for new surfaces, with the Replay engine for streams.
2. A Windows acceptance pass on the synthetic profile, run by a **local** session on Kevin's PC, with the rows added to `DESKTOP-ACCEPTANCE.md`.
3. One live check on the subscription, using real but read-only data where possible.
4. A short receipt in `docs/` and `NEXT-SESSION.md`. No claim of "works" without saying which of 1–3 was reached.

## 8. Where the work runs

The engine spike, live checks, desktop acceptance and anything touching the subscription **must run on Kevin's PC**. A cloud session cannot reach his machine or his Claude login.

**Recommendation:** execute this plan from **one local Claude Code session** in the Olympus folder. It can build, launch the app, run the acceptance pass and use the real `claude` and `codex` CLIs, with no hand-offs. Cloud sessions remain useful for isolated code work.

Building Olympus this way also uses Kevin's Claude subscription limits.

## 9. Check-ins: the complete list

Everything not listed here proceeds without asking.

| # | When | What Kevin decides |
| --- | --- | --- |
| 1 | Now | Approve this plan and the standing authorization (section 10) |
| 2 | End of Phase 0, only if the spike finds something impossible | How to adjust the plan |
| 3 | Phase 4, Gate B | The armory and swarm visual design (yes / change this) |
| 4 | Phase 7 | Google re-consent for draft/send scopes (Google requires it) |
| 5 | Phase 10, per connector | Each new computer or app trust boundary |
| — | End of each phase | "Ship it" to release and install. These can be batched if Kevin prefers. |

Plan approvals, write confirmations and send confirmations inside the product are Olympus's normal operation, not project check-ins.

## 10. Standing authorization requested

To keep check-ins this low, the executing session needs:
- Branch, commit and push to a feature branch per phase (`armory/phase-N`), including docs, tests and receipts.
- Run local builds, tests, the synthetic acceptance profile and the engine spike on Kevin's PC.
- Make read-only live checks on Kevin's real Gmail cache and vault through the subscription engine.

Still excluded without a word from Kevin: merging to `master`, releases and installs, any Gmail write, any Google scope change, deleting data, paid API calls, and anything in Phase 10.

## 11. Risks and how the plan contains them

| Risk | Containment |
| --- | --- |
| Provider terms for automated personal use of a subscription are undocumented | Kevin reviews the Anthropic and OpenAI terms before Phase 1 ships. The API engines remain as a fallback he can choose. |
| Limit behaviour is undocumented | Phase 0 captures it. Unknown failures are treated as a pause, never as an automatic retry. |
| CLI output formats drift between versions | Minimum version check at startup, stream parsing pinned by replay fixtures, and a clear "engine version unsupported" state |
| Latency from process start | Warm `--resume` sessions, timing recorded in receipts, and a streaming UI from the first delta |
| Prompt injection via email | Scoped grants, untrusted-evidence marking, no unconfirmed external writes, and a journal of every call |
| Swarms burn through the subscription | Concurrency cap, turn and time limits per plan, and limits shown in the plan card before approval |
| Scope creep in the visual work | Gate B, and "every pixel is a real event" |
| Local transcripts left by engines | Phase 0 finds where they go. They are redirected to app data or cleaned up under Olympus's control. |

## 12. What does not change

Two-tier memory and selective promotion, and the Decision Log being evidence rather than instruction. The write gate. Truthful loading, empty, failed and stale states. Dry voice. The opening briefing. Research presence not meaning endorsement. The acceptance profile's isolation. The Coding Delegate's sandbox and review.

## 13. Proposed product priorities (replacing the list in the manual)

1. The engine on the subscription (Phases 0–1).
2. The armory and tool-using tasks (Phase 2).
3. The orchestrated swarm with plan approval and the Operations view (Phase 3).
4. The show: armory and swarm in the instrument (Phase 4).
5. Skills (Phase 5).
6. Trustworthy live project briefings and curated memory: maintained, not expanded.
7. Codex, write tools, design co-building, local voice, computer and apps (Phases 6–10).

The existing 0.20.0 minor issues (the truncated scan-failure path, the stale-state lag) fold into Phase 1's first release.
