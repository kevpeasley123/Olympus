# Personal briefing and engine architecture

Status: approved by Kevin on November 8, 2026: "Yes this captures it. Continue with the build". Incremental refactoring and borrowing ideas from gbrain, not adopting it. Approval does not authorize paid inference.

## Intent

Olympus should maintain an understanding of Kevin's ongoing work and circumstances, then explain what changed since he last checked, why it matters, and whether it needs him. Email, purchases, deliveries, deadlines, project work, and explicit corrections contribute. It should investigate missing context instead of merely rewriting recent snippets. Codex and Claude Code subscriptions are first-class candidate reasoning engines alongside local models.

Earlier implementation choices are revisable. No-surprise-spending is an operator requirement; unconditional generation refusal is an implementation choice, not its definition. Source integrity, credential protection, and truthful reporting remain necessary. Kevin approved implementation of this incremental design; no database replacement or gbrain installation is proposed.

## Observed architecture and disposition

| Area | Observed implementation | Disposition |
|---|---|---|
| Gmail | Native account, refresh, cache, sync and thread commands | Keep; test connection lifecycle separately from inference. |
| Situation analysis | `gmail/situation_contract.rs` extracts source-linked observations; `gmail/situations/` handles analysis, learning and corrections | Extend this store; do not create a competing knowledge database. |
| Opening brief | `briefing_native_evidence.rs` selects four mail excerpts of 1,200 characters; project capture and display receipts are separate | Replace fixed snippet selection with investigation over situation changes; keep evidence identity and display receipts. |
| Context recall | `briefing_context_selection.rs` ranks lexical overlap and returns two memories | Replace as the sole recall mechanism; preserve a cheap keyword retrieval option. |
| Codex | `subscription.rs` refuses generation unconditionally and defines a tool-free ephemeral turn | Replace refusal with verified runtime eligibility; permit explicit read tools through a scoped adapter. |
| Claude Code | `claude_subscription.rs` refuses generation before execution; text-only instructions | Establish supported unmodified CLI integration and account/usage behavior before enabling. |
| Background jobs | `subscription_jobs.rs` depends on Claude readiness; `chat_memory.rs` depends on those jobs | Route by task capability, not a mandatory provider. |
| Local inference | `gmail/situations/analysis_provider.rs` owns Ollama configuration used by both mail and briefs | Move provider transport behind common routing; mail no longer owns general briefing inference. |
| Diagnostics | Existing model request records distinguish requested/actual models | Extend with route reason, source coverage, tool activity and contribution receipts; never invent usage. |
| Guidance | Manual describes subscription-first intent while technical guidance retains historical API defaults | Reconcile documentation with implementation at each migration stage. |

The pending 0.52 patch set is preserved separately. Whitespace/source-order correctness fixes may survive review; expanding newsletter phrase lists is not the long-term relevance design. Do not merge that release merely to clear the worktree.

## Alternatives and selected approach

1. Incremental refactor (selected): retain Tauri/React, Rust, SQLite, vault, Gmail and current situation records; consolidate routes and introduce bounded investigation.
2. Adopt gbrain as a service (rejected by Kevin): would add infrastructure, migration and ownership complexity.
3. Rewrite Olympus (not recommended): loses working connectors and source validation without first proving reasoning behavior.

Ideas borrowed from gbrain: separate ingestion/retrieval/synthesis, central model resolution, source-linked knowledge and corrections, durable jobs. Its current code was read, not installed or executed. Its background inference is not automatically covered by a harness subscription. References: https://github.com/garrytan/gbrain/blob/master/src/core/think/gather.ts ; https://github.com/garrytan/gbrain/blob/master/src/core/model-config.ts ; https://github.com/garrytan/gbrain/blob/master/docs/architecture/system-of-record.md . Review used moving master, not a pinned vendorable revision.

## Proposed responsibilities

### 1. Source services

Gmail owns authentication and synchronization. Git owns project-change evidence. Vault and conversation stores own their respective source records. Expose freshness, coverage, source revision, last success and actionable connection errors independently of model status. A model timeout must never become a Gmail reconnect request.

### 2. Shared knowledge and retrieval

Reuse situation identities and corrections. Add a revisioned change journal through an additive migration when existing tables cannot represent it. A change carries situation ID, source references, event time, observation time, previous revision, claim status, unresolved questions and explicit operator correction references. Keep raw evidence, model interpretations and operator statements distinct.

SQLite owns operational state and source references. Obsidian retains curated, portable knowledge under its existing write/reconciliation protocol. Indexes are derived; do not claim that Markdown backs up the entire database. A common retrieval service exposes current situations, related mail threads, relevant vault records, project changes and handled items. Initially use exact entity IDs, thread links and keyword search; add embeddings only if measured recall gaps justify them.

No global 'last seen' timestamp suppresses unseen work. Acknowledgment records exactly which situation revision or source change was displayed. New evidence can reopen an issue; unchanged handled evidence cannot.

Revise existing admission rules: a purchase may be tracked quietly even when its receipt deserves no attention. Add a lightweight transaction kind within the existing situation domain/SQLite database, linked by explicit order or thread evidence. Tracking and briefing eligibility are separate decisions. The existing active-situation cap must become a bounded query/UI page rather than a reason to drop tracked transactions; use pagination and archived/resolved states. Do not infer delivery completion from an expired forecast.

Durable operator facts and preferences do not expire with the seven-day learned-chat recall window. Explicit corrections take precedence for the claim they correct; source facts retain their timestamps and uncertainty; generated interpretations never override an operator statement silently. Conflicting evidence remains visible. Durable memory is editable/removable, and revoked or deleted memory is excluded from subsequent retrieval. The recent-chat window applies only to transient context, not the operator profile or ongoing obligations.

### 3. Engine router and task runner

Define tasks by capability: extraction, reconciliation, investigation, composition and verification. Each route describes runtime (Codex app-server, unmodified Claude Code, Ollama), authenticated account, requested/actual model, tool support, privacy boundary, availability and spending policy. Login, quota availability, billing mode and task quality are distinct states.

Local models are candidates for frequent bounded extraction and offline composition, not assumed qualified by parameter count. Subscription engines are candidates for investigation and synthesis. A single run uses one lead investigator; do not require a committee of agents or multiple paid calls for every brief. Specialists are invoked only for a defined missing capability.

Provider sign-in remains owned by the provider runtime. No token extraction. No silent API fallback. Reaching a subscription limit yields an explicit paused or locally degraded result. Verify current account-level overage controls and provider behavior; if included-only enforcement is unavailable, present that precise tradeoff to Kevin rather than silently enabling charges or permanently disabling every engine. This is a feasibility checkpoint, not an unresolved detail to bury in implementation.

Provider feasibility must also prove tool isolation: ambient shell/filesystem tools, hooks and installed plugins cannot bypass the task's allowed read surface. Where the runtime cannot enforce that surface, use text synthesis with Olympus-controlled retrieval steps instead of granting broader access. Successful generation alone does not qualify an investigative engine.

Official references reviewed November 8: https://learn.chatgpt.com/docs/app-server ; https://code.claude.com/docs/en/headless ; https://code.claude.com/docs/en/legal-and-compliance . Codex documents local app-server integration; Claude distinguishes using its unmodified runtime from intermediating user credentials. Claude bare mode does not use subscription login. Recheck installed CLI capabilities before selecting flags.

### 4. Briefing workflow

Trigger -> obtain change/coverage snapshot -> retrieve ongoing situations and explicit priorities -> investigate relevant gaps -> compose -> validate evidence and material claims -> persist -> display/voice -> acknowledge exact displayed revisions.

The investigator can call read-only tools for situation changes, thread retrieval, memory search and project evidence. Tool results are data, never instructions. It cannot send email, change account configuration or mark matters handled. The backend enforces these permissions, not merely the prompt.

Initial proposed bounds: 12 read-tool calls and 120 seconds per interactive investigation, with cancellation. These are engineering starting points to measure, not quality guarantees. If a source is long, retrieve targeted sections or continue the thread; do not silently cut all messages to a universal 1,200 characters. No tool budget completion is misrepresented as a comprehensive review.

Proposed opening UX: immediately show the last validated brief with its age and an updating indicator, without automatically replaying stale speech. If none exists, show progress while keeping ordinary conversation available. Replace the previous brief only after validation; a failed update retains an explicitly dated previous result. Changing conversation or canceling must not publish into the wrong conversation.

Compose a short conversational opening, normally 2-4 meaningful points, with no required slot filling. Quiet days may have no substantive update. Explain material uncertainty naturally; diagnostics belong in an expandable coverage view. Project implementation details appear only when they change Kevin's experience or require a decision. Generic vendor news appears only when tied to an explicit interest or ongoing task, with that connection supported by evidence.

Feedback updates a situation/correction record, not just a prompt. A displayed brief never itself resolves a task. Follow-up questions reuse the brief's source context and can retrieve more.

### 5. Background contribution

Workers process new evidence into proposed observations and reconcile affected situations. Jobs have IDs, input revisions, status, retry time and contribution receipts. Idempotency prevents duplicate facts on retries. An unrelated incoming email must not invalidate all work; changed cited evidence must be re-read before publishing a dependent conclusion.

Agents shown as contributing must have actual completed work and source-linked results. Avatar presence is not proof of a running worker. Existing skill metadata can describe workflows, but execution state comes from jobs. No continuous collection of unrelated chats is implied.

## Acceptance and rollout

Use synthetic scenarios first, then a consented private snapshot, then installed-app checks. Assess relevance, factual support, chronology, conditional actions, correction persistence, retrieval coverage, latency and user-rated usefulness separately from JSON validity. Compare engines on the same corpus and task; do not infer a winner from model size.

Required cases: irrelevant newsletter excluded without sender-specific blacklist; delayed order linked to its original purchase; autopay not turned into a payment request; canceled appointment supersedes original; already-handled matter suppressed; new evidence reopens a matter; unrelated items from one sender remain separate; stale/no-source coverage is truthful; provider limit does not trigger paid fallback; app restart does not duplicate jobs or consume undisplayed changes.

Roll out behind a reversible briefing-workflow setting. First shadow runs produce comparison artifacts without display acknowledgments or knowledge writes. Promote only after semantic review. Keep existing display/source checks as a compatibility boundary, then retire old selection and duplicate synthesis paths after parity. Back up before additive migration; no destructive migration is included. Full release gates and installed-app checks remain required before calling the work shipped.

## Migration roadmap

| Stage | Concrete deliverable | Existing seams | Exit check |
|---|---|---|---|
| A. Engine feasibility | Supported Codex and Claude Code runtime probes; common capability/readiness contract; explicit cost boundary | `subscription.rs`, `claude_subscription.rs`, `engines.rs`, `account_usage.rs`, `models.rs` | Authorized synthetic task completes with actual runtime/model evidence; cancellation and quota refusal behave correctly; no paid fallback. Failure produces a specific decision, not more briefing patches. |
| B. Common execution | Central task routing with local and subscription adapters; migrate one bounded extraction task first | `subscription_jobs.rs`, `gmail/situations/analysis_provider.rs`, `chat_memory.rs` | Same synthetic extraction can run through qualified routes; failures persist accurate status; one provider outage does not block all eligible work. |
| C. Situation changes and retrieval | Source-linked change projection and read-only tools across existing stores | `gmail/situations/engine.rs`, `learning.rs`, `conversation_feedback.rs`, `memory/retrieve.rs`, `briefing_projects.rs` | Cross-thread delivery/cancellation/correction cases retrieve the right history; evidence changes invalidate only dependent conclusions. |
| D. Investigative brief | One new workflow behind a setting, initially shadow-only | `briefing.rs`, `briefing_native_evidence.rs`, `briefing_synthesis.rs`, `briefing_lifecycle.rs`, `src/services/briefingSynthesis.ts`, `briefingDelivery.ts` | Same scenario suite produces supported, useful changes with correct acknowledgment, cancellation and coverage. |
| E. Reliable contribution | Route background reconciliation and memory learning through the common runner; expose genuine contribution status | `chat_memory.rs`, `subscription_jobs.rs`, `command_agents.rs`, existing situation workers | Restart/retry tests do not duplicate contributions; explicit corrections survive; displayed agent status corresponds to recorded work. |
| F. Consolidation and acceptance | Remove obsolete selector/duplicate entry points after caller migration; update manual, architecture and feature docs; verify installed app | `briefing_context_selection.rs`, `briefing_local_format.rs`, frontend briefing services and registered commands | No active caller uses retired paths; semantic evaluation plus required native/frontend/visual release checks pass; installed Gmail and real brief acceptance documented separately. |

Each stage is a separate reviewable change. No broad directory reshuffle is required. Detailed signatures, migration numbers and test commands belong in the implementation plan after this design is approved and Stage A resolves the actual provider capability contract.

## Review decision

Kevin approved this design and execution. Provider feasibility is the first independently testable stage, not the last integration task. See the companion implementation plan for progress and unresolved runtime evidence.
