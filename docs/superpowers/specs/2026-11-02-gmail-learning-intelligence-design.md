# Olympus: dependable Gmail and learning briefing intelligence

Date: November 2, 2026, America/Phoenix
Status: approved by Kevin on November 2, 2026. This is the design-time evidence record; implementation and acceptance are tracked in the plan and NEXT-SESSION.md.

## Intent and agreed direction

Kevin wants Olympus to understand his life and workflows over time: email, projects, decisions, ongoing matters, and what deserves attention. The repeated dirty-checkout opening message fails that purpose. Kevin approved proceeding with the review and improvement sequence, including learning from corrections and outcomes. He wants greater persistence in the future. The proposed first persistence step is a Windows user-session tray app, after reliability and intelligence improve; this is not authorization to enable startup behavior now.

Success means a dependable connection, truthful coverage, useful prioritization, and observable improvement from feedback. Changing the greeting or varying sentences is insufficient. Learning means durable, correctable understanding and better selection of recommendations. Autonomous modification of Olympus's code, self-granted permissions, and unbounded agent activity are outside this phase.

## Evidence and current state

Inspected development checkout: `C:/Users/kevpe/Documents/Codex/2026-10-17/task/olympus-engine-status`, branch `codex/subscription-conversation`, previously verified HEAD `316f72b8305e2e8b09a7cd1d3254a90a2404baee`, with substantial pre-existing uncommitted safeguards and connection work. Original checkout contains a separate Zeus height adjustment. Preserve these changes; recheck state before implementation. Installed executable reports 0.42.0, but its contents are not equivalent to the dirty development source.

Read-only production database inspection on November 2 found:

- Gmail enabled, seven-day horizon, status `sync_error`, latest error `gmail_network_unavailable`.
- Last saved successful sync: October 28 at 11:05 PM Arizona time (2026-10-29T06:05:49Z). Recent attempts failed. This is a saved observation, not a live connectivity diagnosis.
- Situation understanding enabled, with a saved missing-OpenAI-API-key error. No key was read or added.
- 233 stored mail records and eight situation rows; these counts do not establish current coverage or useful analysis.
- 37 conversation rows, no recorded memory errors/failures. This does not prove every eligible message was learned or that recall is useful; watermark and eligibility auditing remains necessary.

Code facts:

| Area | Existing behavior | Consequence |
| --- | --- | --- |
| `src/services/openingBriefing.ts` | Deterministic composer; input is projects, board, session boundary and scan error. Dirty checkout is the highest-ranked general observation. | The reported repeated text follows its design; there is no email or model reasoning input. |
| `src/services/situationBriefing.ts` | Refreshes projects/tasks/delegation runs, then calls the same composer. | On-demand briefing has the same narrow understanding. |
| `src/hooks/useDashboardData.ts` | Saves opening/on-demand briefs as assistant messages and exposes speech output. | Delivery history exists, but meaningful-item acknowledgments and revision-based suppression are needed. |
| `src-tauri/src/commands/gmail/auth.rs` | Refresh token retrieved from Windows secret storage; `invalid_grant` becomes authentication-required; transport errors become a generic network error. | Token persistence already exists. Diagnose connectivity and consent lifetime separately. No credential extraction needed. |
| `gmail/mod.rs`, `gmail/sync.rs` | Five-minute worker, incremental history, bounded full fallback, atomic cache/cursor commit, in-process operation guard. | Preserve this implementation; improve diagnosis, scheduling durability and ownership rather than replacing sync wholesale. |
| `gmail/situations.rs` and submodules | Incremental discovery/synthesis, evidence validation, source fingerprints, explicit updates and local drafts; periodic worker with backoff. | Reuse ongoing situation records and source validation. Investigate coverage/backlog and whether published results are fresh. |
| `gmail/situations/attention.rs` | Source-bound Snooze, Handled and Dismiss decisions. | Reuse these semantics; do not infer preferences merely from inactivity. |
| `gmail/situations/analysis_provider.rs` | Development default branch named `openai` now calls subscription jobs; optional explicitly configured local Ollama path remains. | Provider naming/docs drift can obscure what really runs. Default subscription jobs are closed by current safeguards. |
| `chat_memory.rs`, memory index | Quiet-chat learning, saved memory and retrieval already exist. Learning uses subscription jobs in this checkout. | Provider availability affects memory as well as email analysis. Audit eligibility and progress; do not assume zero errors means current understanding. |
| `src-tauri/src/lib.rs` | Starts Gmail, situation and memory workers inside the desktop process. | Worker lifetime currently depends on the app process. Runtime guards are not cross-process exclusion. |

Gmail setup documentation recommends External Testing. Google's documented seven-day refresh-token lifetime for that configuration and Gmail scope is a candidate cause of repeated reconnection, not a verified configuration or explanation of the current network error. Verify consent publishing status through supported account UI before prescribing changes. Official reference: https://developers.google.com/identity/protocols/oauth2#expiration . No permanent-login guarantee is possible; revocation and account policy can still require reauthorization.

Documentation is partly stale: several feature docs still describe paid API routes or Codex fallback, while newer code gates generation. Update descriptions with any implementation change; preserve dated acceptance history as history.

## Approaches considered

1. Improve the existing launch-only composer. Cheapest, but does not satisfy accumulated understanding or reliable email awareness. Retain a small deterministic status fallback, not this as the target intelligence.
2. Maintain local evidence and ongoing understanding, synthesize bounded briefs from it, then add optional tray persistence. Recommended direction presented to Kevin and accepted for continued design/review. Reuses current Gmail, situations, memory and storage.
3. Introduce a separate Windows service or hosted system immediately. Adds credential/user-session, deployment, synchronization and operating-cost complexity before existing failures are understood. Deferred. The user has not requested off-machine operation or approved hosting.

## Goals and boundaries

- Reliable Gmail across normal app restarts, access-token expiry, temporary network loss and sleep/resume.
- Separate connection, synchronization, analysis, learning and delivery health.
- One underlying understanding model for opening, on-demand, project and Communications briefs, with different scope and length.
- Meaningful change detection, deadline awareness, waiting-on tracking and feedback-based prioritization.
- Traceable evidence, editable learning and honest uncertainty; preserve explicit operator commitments separately from suggestions.
- Preserve Gmail read-only scope, local-only drafts, temporary-chat exclusions and existing spending gates. No new sending, mailbox modification, calendar integration, model download, cloud hosting or credentials required by this design phase.
- Calendar and external conversations remain uncovered unless later explicitly connected/imported; do not imply all-life visibility.

## Proposed design

### 1. Health and collection

Expose distinct states: authorization configured/connected/reconnect-required; sync idle/running/stale/failed; analysis current/backlogged/paused/blocked/failed; memory current/pending/blocked/failed. Include last successful timestamps, bounded coverage, next retry and a safe explanatory reason. A successful sync must not mark understanding current.

First diagnose the current network failure with credential-free DNS/TLS/proxy/timeout evidence and endpoint category, then inspect consent publishing status and token-refresh flow through supported mechanisms. Never log tokens, OAuth callback queries, message bodies or unrestricted transport errors. Do not reconnect repeatedly for a network failure. Preserve cached mail and existing grants.

Reuse Gmail history cursor and atomic commits. Persist retry eligibility, run receipts and pending work rather than relying only on process memory. Classify permanent authorization failures separately from transient outages and quota delays. Honor Retry-After; apply bounded backoff/jitter. On startup/resume, process overdue work once and resume from the last committed cursor; no burst of missed ticks. Expired history triggers the existing bounded full scan, with visible scope/truncation status.

Retain the configured seven-day horizon initially. Surface that limitation rather than widening retention silently. Track long-running situations separately from cached messages; if evidence leaves scope, retain only existing permitted history and mark current evidence unavailable. Never claim fresh confirmation from an expired source. Any retention expansion requires an explicit design choice later.

### 2. Analysis provider readiness

Define a shared provider-readiness result for email understanding, chat learning and briefing synthesis. It reports actual route, availability, pause/block reason, and policy eligibility without issuing a generation request.

Do not reopen Claude/Codex generation, add an API key, or introduce a paid fallback to make the demonstration work. The currently blocked subscription route remains blocked. The optional local route is not assumed installed or quality-qualified. Build and validate the pipeline with deterministic fixtures and an injected synthetic analyzer first.

A functioning permitted analyzer is a dependency for live semantic intelligence. Source collection, source freshness, explicit corrections, deterministic deadline handling and truthful fallback can improve independently. Live usefulness acceptance cannot be declared complete until the separate provider/spending problem is resolved and the selected route is authorized.

### 3. Shared evidence and ongoing matters

Keep source stores authoritative. Add a thin evidence projection over cached mail, existing situations, project state, tasks, selected vault decisions and eligible memory. Do not duplicate whole mailboxes into a new universal memory store.

Each candidate fact carries stable identity, source type/account/project scope, source revision, observed time, source event time if known, last checked time, coverage/availability and provenance. Distinguish direct facts, operator statements and model inferences. Email text and imported research are untrusted evidence, never operating instructions.

Reuse existing situation IDs for ongoing matters. Track current state, changed facts, waiting-on parties, explicitly supported deadlines, next proposed action, operator commitments, unresolved contradictions, relevant project links and confidence. Keep cross-source associations provisional until supported by explicit links or strong evidence; shared names alone cannot fuse people/projects. Correcting an association must be reversible.

Run analysis only for changed evidence, explicit corrections, scheduled reminders/deadline transitions or an on-demand refresh. Bound inputs/output and analysis concurrency. Validate citations against the supplied evidence and recheck revisions before publishing. Publish a complete validated revision atomically; a stale or invalid result leaves the prior version visible with a freshness warning.

### 4. Brief selection and delivery

Use a shared brief service with scope (overall/project/communications), requested time window and delivery mode (opening/on-demand). Preserve differences between a prior app launch, prior successful analysis, and prior delivered brief. Opening the app is not evidence that the user received a briefing.

Rank concrete urgency and consequences first, then changed commitments/waiting-on status, progress relevant to active goals and new useful opportunities. Repository hygiene belongs below these unless it creates a real risk. Show up to three substantive highlights by default; optional detail can expand the rest. This cap and an initial 24-hour reminder cooldown are proposed defaults, not inferred preferences.

Record delivery receipts by item ID and evidence/meaning revision, separately for displayed and spoken output. Identical unresolved items are suppressed from repeated opening briefs until meaningful evidence changes, a literal deadline crosses an urgency threshold, or an explicit reminder is due. Failed delivery does not advance that channel's receipt. On-demand requests can intentionally repeat current matters and should label them unchanged.

The brief should explain what changed, why it matters and a useful next move, with expandable source references and coverage. No forced recommendation when there is nothing useful to recommend. No generic dirty-checkout advice on every launch. No inference that no commits means no work.

If sync or analysis is stale, lead with the material coverage limitation once and retain a quiet status indicator thereafter unless the failure changes. Never transform a failure into 'nothing new'. A fallback is a clearly labeled factual status update, not simulated model analysis. Newer evidence arriving during delivery invalidates the prepared draft or produces a later update; do not silently alter a delivered receipt.

### 5. Learning from correction and outcome

Reuse explicit updates, Handled/Dismiss/Snooze and chat memory. Add source-linked, revisioned learning records: what was corrected, original inference, explicit user statement/outcome, scope, reason if supplied, confidence and provenance. User edits outrank generated interpretations; retain superseded history for explanation and undo.

Explicit facts/preferences may enter memory automatically under the established memory policy. Inferred workflow patterns remain labeled provisional. Repeated supported outcomes can influence ranking gradually, within bounded rules; a single dismissal cannot globally hide a category or override a deadline. Silence, inactivity or opening an item does not establish agreement, completion or dislike. Completion is explicit or source-supported and remains separate from 'handled'.

Provide a readable 'what Olympus learned' view with edit/forget/undo and links to supporting evidence. Forgetting or correcting a learning record must invalidate dependent projections and pending briefs so the rejected inference does not reappear from a stale cache. Temporary chats do not feed learning. Retention and deletion of original source records remain controlled by existing policies; derived projections never restore forgotten learning from their own summaries.

Evaluate improvement with reviewed examples: missed important developments, irrelevant/repeated items, correct priority, citation validity, and whether an explicit correction changes the next comparable result. Do not optimize for clicks or apparent engagement. Do not claim model training or self-modifying code; this phase improves structured memory, retrieval and selection.

### 6. Future tray persistence

Phase one continues to run only while Olympus is open. Extract worker responsibilities behind interfaces that are independent of UI rendering, retaining the same trusted backend and stores. When enabled in a later phase, one per-user process owns workers and database mutations; closing the main window hides it, while explicit Quit stops it. Optional launch-at-sign-in is separately visible and configurable. No system-level service required initially.

Before tray activation implement a per-user/profile cross-process ownership guard, including installed/development conflicts, with clear status and no silent termination of another instance. Persist checkpoint/lease/run state and recover interrupted jobs idempotently. Quiet hours prevent unsolicited speech/notifications; background work never opens the microphone. Pause controls distinguish sync from analysis. Disconnect immediately cancels account work and invalidates pending outputs. Exiting is not disconnecting.

Use local scheduling, not continuous generation. An initial five-minute sync cadence preserves the existing design; process changed evidence in bounded batches after successful sync. No wake-from-sleep, logged-out operation, off-device hosting or new startup registration in the first implementation slice. A future service would need a distinct account/credential and IPC/update design and fresh approval.

## Storage, migration and recovery

SQLite remains operational state; vault notes remain human-editable memory/intent. Extend existing source/situation tables through new additive migrations only. Conceptual additions: worker checkpoints, evidence references, brief revisions/delivery receipts and learning corrections. Exact schemas and module splits are builder choices after design approval. Do not edit shipped migrations or schema.sql. No destructive migration in this design.

Use existing vault write gates and concurrent-memory compare-and-write protocol. New derived data is rebuildable from permitted source records and explicit decisions; receipts and corrections require backup/migration preservation. Before any migration, verify a restorable local operational-database backup; the vault backup does not cover it. Keep private mail, account identifiers, credentials and captured production payloads out of Git/test fixtures.

## Implementation sequence and acceptance

1. Baseline and diagnostics: record installed/source versions and current states; audit memory eligibility/watermarks, source coverage and error paths. Produce redacted failure evidence. No live generation required.
2. Gmail reliability and truthful status: deterministic tests for expired access, invalid grant, temporary transport failure, quota delay, lost history cursor, cancellation, restart/resume and atomic cursor recovery. Confirm no cache destruction or repeated consent for outages.
3. Shared evidence and brief selection: synthetic fixtures cover stale Gmail, partial scan, no commits but changed work, overdue waiting-on, repeated launches, on-demand repeat and source revision changes. Assert expected item IDs/ranking and traceable citations rather than exact prose.
4. Learning integration: explicit correction changes the next comparable brief; snooze survives restart; handled does not imply real-world completion; forget/undo invalidates dependent drafts; ignored advice does not become a preference.
5. Qualified analyzer: offline adapter and failure tests first. Later, independently authorized real-source/real-provider acceptance verifies useful synthesis within permitted cost controls. Until then, report 'pipeline validated, live intelligence blocked'.
6. Optional tray operation after core acceptance: multiple-instance, sign-in, window close versus Quit, pause, crash/resume, idle resource use and quiet-hour tests. Startup behavior remains off unless explicitly enabled.

Before release run repository-required frontend build, Rust library tests, all scripts/test-*.mjs and visual review, plus focused new checks. Use offline dependencies and fixtures; no ignored/live provider tests without separate scope. Review actual changed settings/brief screenshots and shipped flagship composition; browser fixtures do not establish native acceptance. After version bump rerun guidance-doc checks and reconcile manual/architecture/feature docs with real behavior.

Success gates: all synthetic scenarios pass; each material claim has current valid evidence or explicit uncertainty; unchanged input produces no repeated opening recommendation; failure is never reported as no news; correction persists and affects the next comparable case; real native connection survives restart and permitted refresh when separately exercised. Live briefing usefulness requires Kevin's review of representative real briefs, not only passing tests. Provider blockers or unfinished features are held back rather than hidden.

## Outstanding decisions and limits

No additional decision is needed to complete this design review or plan offline engineering. Live model route qualification remains a dependency, not assumed approval. Actual Google consent publishing status and current network failure cause are unknown. Background activation, broader mail retention and new source connections are future choices. The other checkout's Zeus edit and pending research ingestion stay separate from this feature work.

This design is ready for builder review and Kevin's approval before an implementation plan is written. No product code, settings, credentials, production data, OAuth grants or installed app state were changed during this review.
