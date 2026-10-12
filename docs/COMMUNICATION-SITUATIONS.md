Status, 2026-10-12: the reference for situation understanding and Situation maps, released from 0.18.0 and part of the installed 0.30.0. Layout, polling, header status and recovery, the navigator and draft handling follow the September 28, 2026 design review in [COMMUNICATIONS.md](COMMUNICATIONS.md#design-review-changes--september-28-2026). Workstream priority is in [EXECUTIVE-PRIORITIZATION.md](EXECUTIVE-PRIORITIZATION.md), dossiers in [OPERATIONAL-DOSSIERS.md](OPERATIONAL-DOSSIERS.md), and attention suggestions and the optional local analysis model in [EMAIL-ATTENTION.md](EMAIL-ATTENTION.md). The September 13, 2026 visual passes that preceded the design review (relationship web, reference-render visuals, compact overview, relationship dossier, map polish, final overview polish) are recorded in git history (`cb25daf`).

# Communications: evolving situations

Implemented September 13, 2026; released in 0.18.0.

## Operator-approved experience

Communications leads with an ongoing situation briefing beside a relationship map. Situations emerge automatically from relevant correspondence; they are not a fixed taxonomy. Each has where things stand, what changed and informative recommended next moves. The operator can focus a person to inspect conversation logs, inspect original cached threads and quoted practical details, rename, merge, close, dismiss or restore a situation, and switch to an overview of available situations.

**Add an update** (Save update) records corrections, goals, changes and pasted external summaries as explicit operator context. Recent explicit updates take priority over prior generated inferences. Matching Research Center excerpts supply context, never automatic operator intent. Recommendations remain generated advice, not obligations or approved actions. Relationships and roles are inferred; neither an email nor a generated map establishes legitimacy.

Reply drafts are generated only after **Draft reply**. The initial recipient comes from the latest cached incoming sender, not model output. To, subject and body are editable and saved locally with revision checks. (Since 2026-09-28 unsent edits are also kept in session view state across mode switches, closing a changed draft asks Keep editing / Save and close / Discard changes, and recipients keep display names and are parsed on blur or save; see [COMMUNICATIONS.md](COMMUNICATIONS.md#design-review-changes--september-28-2026).) There is no send command, Gmail draft creation, attachment upload or permission expansion. A later sending evolution must show recipients/content/attachments for review, require explicit Send and a final confirmation.

## Maps

Communications opens on **Situation maps**; **Browse email** is a separate view. With no published situation, the map area says whether discovery is running, failed or has not identified a situation, without inventing relationships.

Document-backed situations open on the whole situation: workstream cards around a central anchor, each with up to two representative names and its actor count. Selecting a workstream shows its contextual actors grouped by role, and selecting an actor opens the relationship dossier. `contextualActors.ts` derives actors conservatively from explicit, document-cited representation links; ambiguous, co-occurring, conflicting and operator-only affiliations are not fused. It is a frontend projection, not identity resolution or a persistent entity type. Email-only situations show a correspondence map of the people inferred from their threads; selecting a person opens their conversation log.

`SituationRelationshipWeb.tsx` renders an SVG web with keyboard-operable HTML buttons at graph coordinates; `situationGraph.ts` assigns deterministic, bounded slots around the anchor, with no physics simulation. Edges show workstream membership, role grouping and recorded relationships whose endpoints are visible; uncertain or uncited relationships are dashed. Zoom has five steps (1, 1.2, 1.5, 1.9, 2.4) and Reset view changes only the camera. Traveling lights along edges are decorative, not evidence of processing, and are removed under reduced motion.

## Implementation

- `src/components/panels/SituationsWorkspace.tsx`: the Situation maps view: navigator, overview, inspector (Briefing, Activity & updates, Draft, Add an update) and situation management. The maps are `SituationRelationshipWeb.tsx` and `DocumentSituationMap.tsx`; source review, the draft editor and the next-step strip are `SituationSourceReview.tsx`, `SituationDraftEditor.tsx` and `NextStepStrip.tsx`; `useSituationSnapshot.ts` polls.
- `src/services/situations.ts`: typed native command boundary; fixture client is separate and imported only by development harnesses. `situationGraph.ts` lays out maps; `contextualActors.ts` projects document-backed actors.
- `src-tauri/src/commands/gmail/situations.rs`: account-scoped persistence, snapshots, operator edits and native background cadence.
- `src-tauri/src/commands/gmail/situations/engine.rs`: incremental fixed workflow, changed-thread selection, discovery, synthesis, validation and atomic publication.
- `src-tauri/src/commands/gmail/situations/analysis_provider.rs`: the email analysis route (OpenAI primary by default, or an opt-in local Ollama model; see [EMAIL-ATTENTION.md](EMAIL-ATTENTION.md)).
- `src-tauri/src/commands/gmail/situation_contract.rs`: typed strict discovery/briefing outputs with evidence validation, including standalone attention suggestions. These are purpose-specific compiled contracts, not a new general agent runtime or additions to the older two-skill registry.
- `src-tauri/src/commands/gmail/situations/attention.rs`: Snooze, Handled and Dismiss decisions on attention suggestions.
- `src-tauri/src/commands/gmail/situations/drafts.rs`: explicit generation and optimistic local saves.
- `src-tauri/src/commands/gmail/situations/documents.rs`: account-scoped document status and open for imported context.

Additive tables: `communication_situations`, `communication_situation_sources`, `communication_situation_updates`, `communication_situation_state`, `communication_situation_drafts`, and `communication_situation_contexts` for imported document context. No source mail or vault intent is rewritten. Run/event receipts use existing communication tables under `communication-situations/v1`; the older v3 history query excludes these records. Model request receipts use the existing prompt-free model telemetry.

The workflow is snapshot → discover → brief → validate → publish. There are normally at most two model requests per refresh batch, and no model-selected tools or hidden expansion loop. Discovery constrains each thread's output with a source-specific schema: thread identity and contact/relationship emails must come from that thread's supplied participants. When contact, detail or output-bound validation fails, one bounded map-only retry returns no practical details and must still pass participant, relationship, source identity and output validation, so a recovery batch makes at most three requests. Discovery groups related threads into existing or new situation IDs. Synthesis can revisit dirty situations without reinterpreting unchanged messages. Publication checks account, history range, operator revision, all current mail fingerprints and Research snapshot again. A context change aborts publication and leaves previous understanding intact.

Discovery validates participant membership, relationship endpoints, output size and source identity. Independently of situation relevance, it may return one attention suggestion per thread, with an exact source quote and literal deadline text ([EMAIL-ATTENTION.md](EMAIL-ATTENTION.md)). Practical details require exact source quotes; payment/date values must occur in those quotes. Portal values must be literal HTTPS addresses without embedded credentials. This validates source grounding, not the truth or safety of a sender's claims. Briefing recommendations must point to supplied current threads. Source excerpts and generated content are untrusted data, not execution instructions.

## Refresh and privacy

Background understanding defaults on for this operator-approved evolution and runs only while the native app is open, including when another mode is selected. The worker checks every 30 seconds after a 20-second startup delay, with at least five minutes between background analysis attempts; it skips while Gmail is syncing or needs authentication. Consecutive failures back off from five minutes to four hours, and the snapshot reports the real resume time. Operator edits invalidate the pending context and make the next worker check eligible. **Refresh situations** in the Communications header runs it on request. The single-running-analysis constraint prevents overlap with thread triage.

The configured email analysis route (the OpenAI primary model by default; an opt-in local Ollama model when `OLYMPUS_EMAIL_ANALYSIS_PROVIDER=ollama`) receives bounded cached email excerpts, situation context, selected operator updates and relevant Research excerpts. **Draft reply** always uses the OpenAI primary route. The UI and Gmail preferences disclose this; the background toggle pauses it. Pausing also invalidates an in-progress analysis. Gmail remains `gmail.readonly`, tokens remain in the existing native credential store, and no mailbox or model call occurs merely by opening the browser harness.

Frontend snapshots poll without initiating model calls: every 3 s while the maps are shown, 15 s otherwise, and not while the window is hidden. The poll passes its revision and an unchanged snapshot is not re-parsed. `situation_snapshot` also reports understanding freshness: last publish, last attempt, consecutive failures and the worker's real resume time during backoff. Existing map node positions, selected situation/person, scroll and editable draft text survive refreshes. New people fade in briefly, with reduced-motion support. Source changes mark findings/drafts stale; old understanding remains visibly available. Preflight and run failures are surfaced instead of silently presenting completion.

## Bounds

- Existing Gmail history range and 2,000-message cache bound apply. This cannot reconstruct pre-cache correspondence.
- Six changed threads per batch, four latest eligible messages per thread, 2,000 body characters each. A thread with more than 24 participants is recorded as skipped rather than analysed. Attachments are not read.
- At most six situation briefings per batch, eight current thread observations each, five practical details per observation in synthesis, three Research excerpts of 2,000 characters each.
- Up to 24 active situations; a new situation beyond that is kept as a deferred observation. Snapshot/catalog surfaces active situations plus recent archive entries within 96 total. Up to 2,000 recent thread observations, 32 recent operator updates and 100 local drafts are surfaced. Synthesis uses four recent matching updates; discovery uses eight recent updates. Longer context is explicitly bounded.
- Maps show eight people or contextual actors per page, with Previous/More paging. Overview is a situation-card index; there is no cross-situation shared-person map.
- Background batches are incremental, not token-by-token graph streaming. A large initial backlog can take multiple refresh cycles.
- Research matching uses the existing deterministic retrieval. Model interpretation and grouping quality still require live provider/mailbox acceptance; synthetic validation does not establish that quality.

## Verification

Synthetic harnesses: `situations-harness.html` (`?run` for its checks, `?navigator` and `?documents` for the navigator and document fixtures) and the integrated `communications-harness.html`. All examples are invented. A native development build runs the background worker against the real cached mail with the configured provider, so it is not a synthetic test; the debug-only acceptance profile refuses Gmail access. Interpretation and grouping quality depend on live provider and mailbox use and are not established by synthetic checks.

## Local document foundations

Situations can include an account-scoped `communication_situation_contexts`
foundation. It contains typed people, organizations, services and unknown roles;
workstreams; cited facts; and local source paths/fingerprints. The UI starts with
workstreams, then shows entities and a briefing together. Document facts remain
separate from evolving email interpretation. An estimate, signed agreement or old
balance never establishes current payment/completion status by itself.

`scripts/import-situation-context.py` imports an explicitly curated pack while
Olympus is stopped. It verifies source hashes and graph references, backs up the
database, retains extracted provenance in the app-data situation-imports folder,
and supports individually reviewed dismissal/merge IDs. Original files remain
unchanged. This is an operator-assisted import, not an automatic folder watcher.

Private foundation payloads are attached only by `snapshot()`. Internal
`situations()` (used by discovery and drafts) does not load them. Exact contact
matches run locally and expose only candidate situation IDs alongside already
authorized email evidence. No document prose, financial support text or identity
documents are added to model prompts. User-entered updates retain the existing
disclosed model-processing behavior. Merging document-backed situations through
the generic merge UI is blocked until a context reconciliation workflow exists.

Discovery prompts require meaningful ongoing work/coordination. No new map
is a valid outcome. A backend gate prevents specified routine standalone
activation, verification, purchase and balance notifications from creating maps;
this is a conservative guard, not an exhaustive spam classifier. Existing
situations can still receive relevant informational evidence.

On 2026-09-13 one Home foundation was imported from an operator handoff of 57 folder files; real content stays outside Git, and the `?documents` fixture is synthetic. Vite denies `output/**` and SQLite files.
