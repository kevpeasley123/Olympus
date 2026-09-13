# Current development: Communication Intelligence v3

See [Communication Intelligence v3](COMMUNICATION-INTELLIGENCE-V3.md). Explicit Analyze/Refresh now sends bounded selected excerpts to the existing OpenAI primary route for interpretation, with a genuine three-pass cached-thread expansion loop. Two skills and the five-node graph remain; background findings and operator feedback are visible. No mail/project actions or automatic learning. Installed release remains 0.16.0. Earlier sections below describe historical versions and their verification.

# ARCHITECTURE CRITIQUE — Communications v2

September 12, 2026. This review supersedes the initial four-skill/nine-node design. It is an architectural correction to current development work, not a rewrite of historical run records.

## KEEP

Keep manual local analysis, deterministic candidate narrowing, bounded source reads, fingerprinted evidence, generated-not-authoritative findings, explicit failure/recovery and reviewable feedback. `OLYMPUS-MANUAL.md` assigns Git facts, vault intent and SQLite operational history different ownership; no generic skills framework should override that distinction.

## CHANGE

| Initial design | Concrete problem in the implementation | Adopted change |
| --- | --- | --- |
| Separate triage and summary skills | `summarize` called `triage` again, duplicating assessment and making apparently independent branches dependent in practice | `communication-assess@1` computes assessment once and derives concise source context from it; it emits no recommended disposition or next-move policy |
| Recommendation skill | Mostly a small deterministic label/guidance mapping; no independent execution boundary | Ordinary synthesis policy, not a registered skill |
| Nine nodes | Join, ranking, recommendations and final truncation were cheap steps with no separate recovery benefit | Five nodes: snapshot, select, assess, project, synthesize |
| Three retrieval stages | Reopened the same files for each thread; next action was predetermined; early unique name matches could hide another project's alias | Inspect all bounded catalog names and aliases before classifying. No discovery loop |
| Gmail-shaped project input | `ThreadInput` required mailbox-specific fields irrelevant to project matching | Provider-independent `EvidenceArtifact` made of bounded text parts and `SourceRef` values |
| Length-only join | Equal-length outputs could still refer to different messages | Verify message/thread/fingerprint identity, ordering, summary references and project source references before synthesis |
| Broad recommendation vocabulary | CONFIRM could imply committing; RESPOND/DECIDE were not supported by implemented inference; REVIEW and INVESTIGATE overlapped | REVIEW / VERIFY / MONITOR for guidance; absent action remains an assessment |
| `needs_you` ranking label for uncertain mail | Project Command Board already uses NEEDS_YOU for actual delegation checkpoints | Communication ordering uses attention_candidate / review_candidate / background, and the mail group is labelled Attention; no assertion of a confirmed checkpoint or urgency |

Code evidence: [assessment and policy](../src-tauri/src/commands/gmail/communication_skills.rs), [fixed runner and evidence join](../src-tauri/src/commands/gmail/intelligence.rs), [project matching](../src-tauri/src/commands/project_relevance.rs), [existing Project Board semantics](../src/services/projectCommandBoard.ts).

## REMOVE

Remove the artificial project search loop, redundant registered skill wrappers, and gratuitous graph nodes. Do not add a plugin loader, executable skill packages, graph DSL, dynamic routes, model calls for rule-based classification, generic scoring engine, or a new scheduler. Do not force a universal recommendation enum onto Project/Research/Delegation before there is a second concrete consumer with compatible semantics.

The old three-stage behavior is better described as a bounded deterministic search cascade than loop engineering. Calling every `for` loop discovery would blur the conceptual distinction the operator explicitly wants preserved.

## REUSE

- `commands/workflow.rs`: shared fixed `GraphNode` and inspectable `SkillContract` metadata, not an execution engine.
- Gmail `store.rs`/`communications.rs`: account/horizon restrictions, current-fingerprint candidate selection, bounded cached threads and local counts.
- `project_notes.rs`: declared project typing and name/alias parsing. The matching skill receives data; the runner owns the contained bounded reader.
- `vault_write::content_fingerprint`: source fingerprints; no vault writes introduced.
- Existing run/event tables and restart/idempotency conventions; no database migration required by v2.
- Existing operator approval and delegation review boundaries remain untouched.

## GENERALIZE

`project-relevance@2` accepts `EvidenceArtifact { parts: [{ source: { sourceType, sourceId, fingerprint }, text }] }` plus supplied project metadata. It has no Gmail fields, filesystem path-selection mechanism, source-discovery callback, model, or network capability. Tests run identical matching through Gmail-labelled and document-labelled artifacts. This provides a concrete reusable boundary without inventing Slack ingestion or a general document platform.

Limits remain four parts, 2,301 characters per part (the current bounded subject + body adapter), 24 project records, 12 aliases per record. Oversized alias catalogs fail rather than silently dropping aliases and concealing a conflicting match. Literal description phrases no longer independently create project matches; that fallback could mistake shared vocabulary for identity. A source with no matching name/alias stays unresolved, not unrelated.

## KEEP GMAIL-SPECIFIC

OAuth, read-only scopes, native commands, account ownership, horizon selection, sent/received chronology, candidate generation, mailbox source access and thread question preparation remain in Gmail/Communications. The reusable project matcher does not interpret a question mark as a response obligation or know what INBOX means. The run still owns the account identity; generic source IDs are not external execution destinations.

## FIRST LOOP

No discovery loop is justified in the current deterministic matcher. The entire permitted catalog is already small, local and known. One catalog read for matching and one freshness recheck before publication is sufficient. Neither is represented as discovery.

A future, evaluation-driven **evidence gap resolver** could be a real loop: unresolved finding -> choose the next permitted source based on the current gap -> inspect new evidence -> stop when resolved or budget exhausted. Project disambiguation may eventually use it, but only when the next retrieval is genuinely conditional and useful. Do not add a model solely to make that loop exist. Knowledge Audit already has bounded source inspection; v2 does not rename or expand it.

## FIRST GRAPH

Knowledge Audit is already Olympus's first executable fixed graph. Communications remains the next useful product test, not a reason to derail work into another workflow.

```
snapshot -> select -> assess --+
                   -> project -+-> synthesize
```

`communication-intelligence/v2` binds `communication-assess@1` and `project-relevance@2`. Synthesis validates the full evidence join, applies categorical policy and publishes up to five items. Independent branches execute sequentially because their local computation does not justify parallel scheduling overhead. No parallelism is claimed. Failure leaves persisted evidence and stops publication; manual retry creates a new run.

## SKILL MODEL

A skill is a compiled reusable function with explicit types, validation, source/effect limits and an independently testable behavior contract. The active registry contains two skills, not every helper. Schemas are inspectable metadata; the actual boundaries are typed Rust construction, deserialization guards, validation and fixed native handlers. There is no general JSON-schema interpreter or arbitrary skill execution command.

Registry availability is separate from invocation authority. The assistant inventory lists current compiled capabilities and the manual trigger; it does not claim chat can execute them autonomously. Historical runs keep their saved graph definitions, skill contracts and output vocabulary. v1 is not rewritten or replayed using v2 semantics. Outdated graph versions are withheld from the current brief and remain inspectable.

## RECOMMENDATION MODEL

| Proposed term | v2 treatment |
| --- | --- |
| REVIEW | REVIEW: examine evidence and decide whether further action is needed |
| CONFIRM | VERIFY: establish the uncertain fact, without implying confirmation of a commitment |
| INVESTIGATE | VERIFY: resolve source/relationship uncertainty; specific guidance carries the detail |
| MONITOR | Retained as a possible guidance type, not emitted just to fill a brief |
| RESPOND | Do not emit as an authoritative next action from a question-mark heuristic; REVIEW first |
| DECIDE | Reserved for an actual identified choice/checkpoint, already represented in Project/Delegation |
| NO ACTION | Internal assessment outcome; does not create a recommendation card |
| NEEDS YOU | Operational checkpoint state elsewhere in Olympus; not a recommendation type or mail urgency claim |

Attention yes/no/uncertain answers whether the inspected evidence plausibly warrants review. Display priority uses explicit categories, not numeric importance or unsupported deadline urgency. No global Project Board migration is justified by this local improvement.

## RUN EVIDENCE, STORAGE AND FEEDBACK

Reuse `communication_runs`, `communication_events`, and `communication_evaluations`. Record actual node events, immutable contracts and timestamps, selected message evidence and the inspected project catalog's names/aliases/paths/fingerprints. Catalog evidence records zero discovery iterations. Raw bodies are not copied to run events; concise source excerpts remain local as before. SQLite owns this derived operational evidence; vault indexes/intent and Gmail remain unchanged.

Feedback remains explicit opened/false-response/false-deadline/project-dismissal events. Do not infer ignored from absence of clicks, interpret dismissal as a source edit, or add project acceptance without its authority contract. Correction events are an evaluation foundation, not automatic learning. A generic feedback ontology, automatic revision and evaluation dashboard remain premature.

Storage tradeoffs remain explicit: runs are retained, history listing is bounded, no new retention UI is added, and the small local run holds the existing database lock for snapshot consistency. Hard filesystem timeouts and generalized concurrent execution are not solved here. If scale requires them, change the runner around a detached immutable snapshot rather than widening skills.

## UI AND PRIVACY

The recommendation-first brief, source review, inspection and collapsed analytics remain. New project results say deterministic match; old lookup records retain historical labels. The UI does not depict the simplified graph as a model agent or pretend rule-based source extraction is semantic reasoning. Failed, changed-source and obsolete-version briefs are withheld.

Analyze is still manual and entirely local. No new Gmail requests or model exposure. Existing explicitly submitted thread questions use the existing reasoning-provider path. No new mail, memory, task, project, skill or graph write authority.

## Verification

- `npm run build`: passed.
- Full Rust lib suite: **286 passed, 0 failed, 2 ignored** (288 total), using the existing external Cargo target.
- Communications browser harness: **49 checks passed**, including consolidated registry/graph bindings, deterministic-match presentation, source access, feedback, stale/failure withholding, analytics, layout and motion behavior.
- New tests cover name-vs-alias conflict, document reuse, no forced description match, input bounds, evidence-identity joins, current registry/taxonomy and preservation of historical v1 records.
- No new schema migration, model calls, Gmail writes, commit, push or installation. Native real-mailbox acceptance remains separate from these synthetic/backend checks.
