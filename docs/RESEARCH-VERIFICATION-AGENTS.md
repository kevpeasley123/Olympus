# Olympus — First communicating agent pair

Implementation receipt · September 23–24, 2026 · source worktree, not an installed release.

## CURRENT AGENT STATE

Three executable roles now exist in source: Research Agent @1, Verification Agent
@1, and the existing Coding Delegate. Only the new pair has the new compiled
`AgentDefinition` contract. Olympus is their orchestrator. Communication Assessment
and Project Relevance remain skills; Communication Intelligence and Knowledge Audit
remain their existing agent-free workflows. Sol/Astra/Opus/Realtime remain models.
Documentary Agent Index entries do not become executors through Markdown status.

This is implemented and deterministically exercised, not a claim of a successful
paid/native pilot. No live provider request, Coding Delegate pilot, installation,
vault-note edit, commit, or push was performed for this slice. The earlier API
diagnostic reported `credit_balance_exhausted`; no successful new live completion is
inferred from credentials being present.

## CODING DELEGATE

Preserved without redesign. Classification: **implemented, unproven, potentially
dormant**. The September 23 inventory audit detected Claude Code 2.1.222 and zero
delegation runs in the inspected operational database. The catalog labels driver
detection as that dated audit observation, reads current SQLite run/completion
counts without running recovery, and directs inspection to the existing project
delegation panel. Its definition version is explicitly unknown/absent rather than
inventing a retroactive @1 contract.

The operator's latest instruction supersedes the audit's proposed Coding-pilot
prerequisite. Proving Coding is not a dependency for this pair. “Deprecated” is not
supported by the evidence.

## RESEARCH AGENT

`research@1`, handler `research_verification::research`, investigates one explicit
question of at most 500 characters. The backend selects only Markdown Pantheon
entries tagged `olympus/research` under `02 - Research/`. It resolves containment,
reads fresh metadata/body, preserves stance, and retains source snapshots. No web,
project-file, memory, or general filesystem tools are exposed to either model.

Skills: existing `research_retrieval::retrieve` as `research-retrieval@1`, plus the
new structured `evidence-synthesis@1`. Retrieval runs in parent-owned preparation
on Research's behalf so Research cannot choose paths or widen scope. It is lexical,
not exhaustive search: three excerpts initially, at most three additional distinct
sources in clarification, 4,000 characters per excerpt. A scan admits at most 2,048
directory entries, 256 Markdown files, 512,000 bytes per file, and 16 MB total reads.
Exceeding a scan limit fails explicitly; it does not silently claim full coverage.

Output: up to five stable-ID candidate claims, exact evidence citations, reported
contradictions and unanswered questions. Empty evidence cannot become a supported
answer without a subsequent verifier citation. A clarification output must preserve
the original claim IDs and text. The original output is retained separately.

## VERIFICATION AGENT

`verification@1`, handler `research_verification::verification`, uses the new
`claim-verification@1` skill. It receives the candidate claims and exact parent-owned
excerpts in a separate model request/run, with a separate compiled role and prompt.
Its independent responsibility is claim assessment, not a second persona.

Every candidate must appear exactly once as `SUPPORTED`, `CONTRADICTED` or
`INSUFFICIENT`, with a bounded explanation. Supported/contradicted judgments require
at least one exact quote of 8–1,000 characters from the supplied excerpt and its
matching source identity/full-file fingerprint. Insufficiency may have no citation.
Contradictory/disputed source stance is visible; source stance is not an endorsement.

These are model judgments about supplied excerpts. Matching a quote is deterministic;
entailment/truth is not. The UI states that distinction and excludes unsupported
claims from its supported section. Neither role can write sources, promote memory,
modify projects, grant approval, alter policy, make commitments, or create peers.

Both use the existing backend PRIMARY route (currently `gpt-6-sol`, medium), with
no fallback. Different models are not needed to establish separate roles. The
definition snapshot includes the exact instruction string, schemas, skills, source
scope, effect prohibitions, peers, model strategy and version; each child binds its
definition fingerprint. Actual returned model and usage come only from receipts.

## MULTI-AGENT GRAPH

`research-verification/v1` is one compiled runner, using the shared `GraphNode`
descriptor for inspection. It is not a DSL, registry of dynamic executors, scheduler,
or generic peer framework.

```text
Explicit question / scoped evidence
  → Research @1, round 0
  → EvidencePacket
  → Verification @1, round 0
  → VerificationResult to Olympus
      ├─ final / no new sources → deterministic join
      └─ clarification + new matching sources
           → ClarificationRequest
           → Research @1, round 1 (same claim IDs/text)
           → ClarificationResponse
           → Verification @1, round 1
           → VerificationResult to Olympus
           → deterministic join
  → separate Olympus brief
```

The parent owns source selection, dispatch, dependencies, identities, budgets,
deadline, cancellation, result validation and join. Join requires all dispatched
children to have completed, revalidates the final packet, and partitions the final
structured findings into supported/contradicted/insufficient claim groups. It does
not call another model or silently rewrite historical Research output. A completed
workflow can report contradictions; “completed” is execution state, not agreement.
Unresolved claims yield `insufficient`; failures, cancellation, timeout and
interruption never yield a brief. No matching evidence makes zero model requests.

## AGENT COMMUNICATION

Four closed typed packet variants: `EvidencePacket`, `ClarificationRequest`,
`ClarificationResponse`, `VerificationResult`. No unused challenge type or open chat.

Each envelope records sender and recipient role/version/run, graph and parent run,
correlation, round, source identities/fingerprints, action/expected response, time,
deadline and remaining request budget. The parent validates endpoints, completed
sender/pending recipient, allowed edge, schema, exact sender-output binding,
correlation/round, ordering/duplicate identity, time, source references, request
budget and candidate-output fingerprint. The final join rechecks these bindings.

Model prose cannot supply envelopes, modify definitions or call a dispatcher. There
is no public IPC “send arbitrary agent message” command. The model returns only its
role's structured output; the parent constructs and validates packets from it.

## BOUNDED LOOP

At most one clarification round, four model requests, six source excerpts and five
claims. There are no automatic retries or model fallbacks. The parent has a 240-second
deadline; existing transport also bounds each request to 60 seconds. Cancellation
is checked between steps and polled during a request; dropping the pending HTTP
future prevents its result from advancing the graph. This does not promise that a
provider has undone already-processed work or that unreported usage is zero.

Only initially insufficient claim IDs may be challenged. If retrieval finds no
additional matching source, the parent saves that reason and joins the initial
findings with insufficiency intact. A second clarification is a contract failure.
Source content changes/unreadability before dispatch, after a response or at join
fail the run. A final-save transaction vetoes success if cancellation wins the race.

## RUN EVIDENCE

SQLite tables `research_verification_runs` and
`research_verification_checkpoints` hold the mutable in-progress header and
append-only full checkpoints respectively. Terminal records cannot be rewritten by
the runner. Start IDs are idempotent for the same question; conflicting reuse is
rejected. Only one parent run may be active at a time. No automatic restart/resume.

Each parent retains the exact graph/agent/skill snapshots, limits, timestamps,
source excerpts, source fingerprints, ordered observable events, independently
identified child runs, model inputs, structured outputs (including invalid JSON
values for failed validation), typed messages and final brief. Request receipts are
also recorded in existing `model_requests`; child links retain their exact receipt.
No hidden chain-of-thought is stored. Failure before valid JSON is an error, not a
fabricated structured response.

Recovery marks unfinished parents/children interrupted and records when recovery
observed that condition. It does not invent execution end times or usage. History
inspection is read-only and reads original snapshots; it does not substitute today's
catalog or silently re-evaluate old evidence. The source fingerprints use Olympus's
existing normalized-content hash (line-ending/trailing-whitespace normalization),
not a byte-exact file hash.

Evaluation facts retain initial unsupported claim IDs, whether clarification was
requested/executed, which insufficiencies were resolved, and observed verification
request latency. Missing latency/usage remains unknown. Per-request receipts permit
later usage comparison. Feedback and claim taxonomy are explicitly unknown; no
opaque quality score or automatic optimization is introduced.

## AGENT CATALOG

Research / Pantheon → **Research with verification & agent catalog** is a secondary
disclosure next to Knowledge Audit. No new top-level section.

The catalog separates two compiled role definitions, current pair availability, the
legacy Coding Delegate, Olympus as orchestrator, and dated documentary candidates /
external Codex roles. Current availability means dependencies allow an attempt;
it does not claim tested provider credit/access. Agent Index notes remain untouched.

An agent links to its recent workflow runs; each child execution opens its saved
definition. Operator inspection shows who executed, their pass and receipt, original
Research findings, independent judgments, why clarification occurred, packet
contents, saved source quotes/fingerprints, the separate brief and evaluation facts.
Current composed skill contracts and original saved contracts remain distinguishable.
Raw contract/message details are disclosures, not new navigation destinations.

The backend-owned assistant build inventory now acknowledges the pair and qualifies
the existing `awaiting_review` behavior as Coding Delegate-specific. Chat still
cannot launch this workflow; the operator uses its explicit Research UI action.

## AUTHORITY

The authority boundary is executable control flow, not merely instructions to a
model. This module has source-read functions and operational SQLite writes; no
source writer, shell/tool invocation, memory-promotion function, project mutator,
approval-consumption path, arbitrary peer creation, or user-selected model route.
Start accepts only ID/question and rejects unknown fields. Message/output schemas
reject unknown approval/effect fields. Neither skill metadata nor a packet changes
the compiled role or parent workflow. Source citations are evidence, not consent.

## TESTS

- Full Rust library regression: **337 passed, 0 failed, 2 paid tests ignored**.
  Seventeen new deterministic pair tests include correct direct/clarification flow,
  unknown roles, availability gates, no widened source/effect fields, source scope,
  source immutability, sender/recipient/version/edge mismatch, schema rejection,
  stale correlation/hash, duplicate and late messages, evidence mismatch, exceeded
  clarification, claim rewrites, unsupported-claim separation, failure propagation,
  in-flight cancellation, final-save cancellation race, timeout/recovery, immutable
  terminal history and read-only catalog behavior.
- TypeScript + production Vite build: passed.
- Research browser harness: **22 checks passed**, normal viewport and 390×844.
  Covers role categories, history/current definition isolation, actual-run fixture
  shape, packet types, receipt unknowns, history response races, invalid output,
  unavailable dependencies, explicit start and cancellation, and narrow layout.
- Existing workflow-inspection projection regression: **12 passed**.
- `git diff --check`: passed.

Fixtures use temporary Research files, disposable SQLite and synthetic responses;
the checked-in browser fixture is exported from the actual deterministic runner.
Build retains existing `gray-matter`/buffer/chunk-size warnings and Rust's existing
unused `ContentBlock.text` warning. Paid quality/latency/usage validation and native
installed acceptance remain unproven. No provider availability or quality claim is
made from these fixtures.

Reproduce: `cargo test --lib` in `src-tauri`; `npm run build`; run Vite and open
`/research-verification-harness.html?check`. To refresh the synthetic fixture, set
`OLYMPUS_RESEARCH_FIXTURE` to an output JSON path and run the
`catalog_reads_do_not_recover_or_mutate_runs_and_can_export_synthetic_ui_fixture`
test. This export uses synthetic sources only.

## NOT IMPLEMENTED

No Coding pilot/redesign, unrestricted web or curated project-file scope, graph
editor, runtime DSL, generic agent framework, dynamic agents/plugins, marketplace,
arbitrary peer chat, personas, general scheduler, parallel fan-out, one-agent-per-node
conversion, open debate, autonomous repair/rewrite/policy changes, automatic
definition/skill/graph adoption, system-wide capability map, opaque scores, or new
permanent navigation. No aggregate evaluation dashboard, feedback collection or
historical-run reinterpretation. No vault Agent Index rewrite. Home semantic
navigation remains the separately approved next slice; it is not folded into this
agent implementation.

Future improvement remains: run → evidence → evaluation → proposed change → test →
comparison → operator review → versioned adoption. Definitions never authorize
their own changes. Role/prompt/schema/behavior changes require deliberate version
review; saved definitions and outputs remain historical evidence.

## NEXT AGENT

None recommended yet. The new independent verification responsibility is justified;
fixtures establish mechanics, not a need for another role. The next useful evidence
is an explicitly started, scoped live Research/Verification run after provider
access is available, followed by review of unsupported claims, useful clarification,
latency and usage. Coding's dormant pilot is not a prerequisite.

## Implementation map

- `src-tauri/src/commands/research_agents.rs`: compiled definitions/schemas/skills.
- `src-tauri/src/commands/research_verification.rs`: fixed runner, source boundary,
  messages, validation, persistence, cancellation, catalog and IPC.
- `src-tauri/src/commands/research_verification/tests.rs`: deterministic acceptance.
- `src/components/panels/ResearchVerification.tsx` and its stylesheet: secondary UI.
- `src/services/researchVerification.ts`: typed IPC contract.
- `src/research-verification-harness.tsx`: isolated browser acceptance harness.
