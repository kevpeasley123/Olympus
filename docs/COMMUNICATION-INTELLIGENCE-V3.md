# Communication Intelligence v3

Development implementation, September 13, 2026. Installed release remains 0.16.0 until a separate release request.

## Adopted critique

- **Keep:** two skills, five-node fixed graph, evidence joins, separate attention/priority/recommendation, immutable historical payloads.
- **Change:** interpret selected source content with the primary reasoning model. Include informational updates and source-specific next moves, not only heuristic attention flags.
- **Remove:** extra skills, generic agent scheduler, artificial lookup passes and automatic self-modification.
- **Generalize:** a typed supplied-thread assessment contract and strict structured-output adapter without retrieval or execution authority.
- **Gmail-specific:** account/horizon selection, immutable cache snapshots, cached thread expansion and navigation.
- **First loop:** conditional evidence expansion is useful because additional thread history or excerpt text can resolve a concrete uncertainty. A predetermined cascade is not presented as a loop.
- **Model boundary:** explicit Analyze/Refresh; local narrowing before any model call. Existing Sol medium route, no provider fallback.

## Graph and bounds

`communication-intelligence/v3`: snapshot -> select -> assess / project -> synthesize. Assessment binds `communication-assess@2`; provider-independent literal name/alias matching remains `project-relevance@2`. Assessment and project work are coordinated in the fixed runner; no parallel scheduler or arbitrary graph execution.

Selection uses available, in-scope, time-bounded cached mail for the enabled account. Up to four recent flagged threads are preferred, then the most recent remaining threads fill a six-thread cap. This permits unflagged transactional updates without sending the entire cache. It does not guarantee coverage or semantic relevance; six candidates can still miss important mail. Counts come from SQLite, never the model.

Each selected thread has an immutable local snapshot of up to four cached messages, at most 2,000 text characters per message. Initially only its latest two messages and first 1,000 characters each are exposed. The model receives available-expansion flags and bounded matching project metadata. Account credentials, unrelated mail, attachments, arbitrary files and chat history are excluded.

Assessment returns what happened, what changed, operator impact, attention (`needs_you`, `background`, `uncertain`), priority (`high`, `normal`, `low`), recommendation (`review`, `verify`, `monitor`, `no_action`), next move, exact ordered evidence references and evidence sufficiency. Source text and project context are untrusted data, not instructions. Mailbox-level counts and authority remain deterministic.

When evidence is insufficient, the model can request `older_messages` or `fuller_excerpt`. The runner expands only the same immutable thread snapshot and re-evaluates only changed threads. There are at most three model calls per run, with a 60-second HTTP timeout per call and a pre-call run deadline. No automatic transport retries or fallback. Stop reasons distinguish sufficient evidence, no new evidence, unavailable context and exhausted pass budget. Insufficient results remain uncertain/verify, never a confident no-action finding. No further source is fetched from Gmail, the web or a project file during this loop.

The matcher still reports suggested/ambiguous/unresolved literal relationships. It does not semantically resolve ownership or promote a project relationship. Model interpretation can discuss supplied suggestions, but cannot replace the matcher's evidence or confirm project intent.

## Persistence, privacy and authority

Existing communication run, event and evaluation tables are reused; no schema migration. The DB mutex is released before model awaits. Account, horizon and cache fingerprints are checked before each call and before publication; project fingerprints are rechecked before synthesis. Changed context, provider refusal/incomplete output, malformed schema or evidence mismatch fails closed and withholds the brief. Disconnect during a call prevents later passes/publication; already-transmitted excerpts cannot be recalled.

Model requests use the shared Responses transport with `store:false`, strict JSON Schema and existing model diagnostics. No tools or model-controlled endpoint. The strict adapter rejects partial/refused output even when text exists. See [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs) for the schema/refusal boundary.

Run events retain pass source IDs, source fingerprints, excerpt fingerprints, character counts, assessments, expansion decisions, stop reasons and model request IDs/actual model/usage. Raw prompts are not copied into diagnostics; normalized source snapshots are already in the Gmail cache. Historical receipts identify the exact evidence fingerprints but do not preserve separate immutable copies of every excerpt after cache deletion or replacement. UI recommendations are model judgments, not mathematically proven facts.

Feedback choices Useful, Interpretation incorrect, and This needs me append evaluation events scoped to an existing run/thread and enabled account. Older response/deadline/project corrections remain available. Feedback is inspectable in run details. It does not automatically retrain a model, alter priorities, rewrite a skill, create a task, send mail or mutate project/vault state.

## Operator use and verification

In the native development app: Communications -> Analyze communications (or Refresh intelligence). The disclosure explains selected excerpts go to OpenAI. Read the foreground brief, expand Background, and use Why this? for evidence, missing-context reasons and feedback. Inspect analysis shows graph events, request receipts and saved skill contracts. The browser harness is synthetic and cannot call the native model route.

Verified: frontend build; Rust suite 296 passed / 2 ignored; Communications synthetic browser harness 57 checks, including no model call on opening, background visibility, feedback wiring, stale/failure withholding, source access and narrow layout. Backend fixtures exercise actual v3 orchestration with an injected model: expansion, no-new-evidence stop, third-pass budget, changed-cache/disconnect failure without DB lock, invalid output, history replay and scoped feedback. Existing shared chat transport tests still pass.

Not yet verified: paid live Responses acceptance of this particular schema, real-mailbox interpretation quality, and native operator interaction. No real mail was sent to a model during implementation. A first explicit native acceptance run should compare each generated conclusion with its source and record Useful/Incorrect/Missed feedback; results may require prompt or selection tuning. Do not call the synthetic harness proof of production interpretation quality.
