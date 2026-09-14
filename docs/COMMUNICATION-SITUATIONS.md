## Latest: executive prioritization — September 13, 2026

Home's next step now comes from a pure, source-linked review policy. Explicit
payment-coordination questions can take precedence; general reviews, ties and
unsupported/empty states remain honest. Status and priority are separate.
A recommended workstream gets a navigation link and subtle map cue; no auto action.
Update Olympus is now Add an update because it opens the operator-context form.
See [EXECUTIVE-PRIORITIZATION.md](EXECUTIVE-PRIORITIZATION.md) for scope, rules and
exact verification, including the recurring parallel Rust HTTP fixture failure
and successful full serial rerun (313 passed, 2 ignored). Build passed; policy 23;
priority browser 17/10/10/20; existing map/dossier/Gmail matrices all passed.
Projection reads saved SituationContext, not unlinked new Gmail correspondence.
No new model path, persistence/tracking framework, commit, push or install.

## Latest: final executive overview polish — September 13, 2026

Whole briefing now prioritizes state, discrete saved open-question bullets and
amber next-step guidance. Changes, coverage/date and qualifications are secondary.
Facts distinguish documented/known, operator context and open questions. Compact
refresh/settings icons retain functions; lower disclosures renamed to Latest
communication update, Activity & updates, Closed & dismissed. Geometry unchanged.
See [FINAL-OVERVIEW-POLISH.md](FINAL-OVERVIEW-POLISH.md) for exact files and review.
Fresh build passed; Rust 313 passed/2 ignored; actor 23, dossier 22, graph 19,
typography 6, saved Home pairings 3; browser dossier 53, navigator 76 + reduced 76,
Communications 58, Situations 14, Gmail 19 and all five viewport cases passed.
No commit/push/install.

## Latest: Situation Map polish — September 13, 2026

Wide inspector reduced by 50px; whole-word two-line names, two-provider summaries,
subtle connected-edge emphasis, Reset view labels, compact error fallback and
expandable briefing excerpts. All seven workstream/dossier paths reviewed.
Existing contextual projection now recognizes cited originator contacts and
preserves distinct representative roles within a company. Actual saved Home
Barrett/Brandon, Gastelum/Luis and True North/Paul projections verified read-only.
See [SITUATION-MAP-POLISH.md](SITUATION-MAP-POLISH.md) for files and caveats.
Build passed; Rust 313 passed/2 ignored; actor 23, dossier 22, graph 19, typography
6; browser dossier 53, navigator 68 + reduced 68, Communications 58, Situations 14,
Gmail 19 and five viewport cases passed. No commit/push/install.

## Latest: relationship dossier — September 13, 2026

The contextual actor inspector now uses compact identity/contacts followed by
Profile, origin, business/work, saved status and a scoped useful next step.
Three collapsed record sections retain notes, facts, canonical identities and
references. No new model/API path or Gmail writes. Map/chat geometry is preserved.
See [RELATIONSHIP-DOSSIER.md](RELATIONSHIP-DOSSIER.md) for exact derivation limits,
files, review steps and fresh verification. Build passed; Rust serial rerun
313 passed / 2 ignored (one parallel HTTP fixture failure passed in isolation);
dossier browser 53, dossier projection 22, actor projection 20, graph 18,
navigator 36 + reduced 36, Communications 58, Situations 14, Gmail 19, and five
viewport cases all passed. No commit/push/install in this pass.

## Latest: compact Situation Maps overview — September 13, 2026

### Space audit and final composition
The previous view stacked the Communications identity, mode tabs, operational
controls, status/error text, selected title/metadata, workstream selector and map
toolbar above a 420px minimum canvas. The center-stack scrollbar therefore hid
lower workstreams. The new wide desktop layout merges identity, mode tabs, Gmail
state/sync/settings and understanding controls into a 60px header. Healthy watching
copy and duplicate headings are removed. Selected title/state/evidence/date occupy
one compact line; workstream buttons sit directly beneath it (about 62px combined).
Full diagnostics live behind compact, visible failure summaries, not full-width
paragraphs. Provider/error/fallback text is retained verbatim behind Details where
available; no new diagnostic facts are invented.

### Viewport and chat geometry
Communications measures its existing center-stack and chat using ResizeObserver.
On wide desktops (at least 1500px wide and 800px tall), the center spans both existing
application grid rows, reclaiming otherwise empty space to the LEFT of chat.
The map gets the remaining height through bounded flex/grid children with
min-height:0. The right inspector uses the measured chat width as its column and
subtracts the measured chat height plus spacing. Graph nodes, controls and inspector
remain clear of chat; the Communications background may extend behind that inset.
The navigator scrolls independently. Long briefing and document content scrolls
inside the inspector. Supporting logs/updates remain available from a compact
bottom action area with bounded disclosures.

Narrower or short desktops prioritize readable detail: briefing stacks below on
narrow widths and the overview remains a substantial scrollable canvas. They are
not claimed to satisfy the no-page-scroll guarantee for normal wide desktops.
The global Olympus header and Gmail read-only/data authority boundaries are unchanged.

### Fit and controls
situationGraphBounds derives the initial viewBox from ALL nodes on the current map
page, including padding. Home's seven top-level workstreams and central anchor fit
on initial entry. Five discrete levels: 1, 1.2, 1.5, 1.9, 2.4. Floating minus/reset/
plus controls occupy a protected bottom inset. Minimum/maximum controls disable.
+ or = and - act only while the map has keyboard focus. Reset restores default
scale and native scroll/pan position without changing situation, workstream, actor
or briefing. Selecting/reselecting a workstream (including Whole Situation) resets
that scope's framing; paging also opens at default fit. Zoom changes are immediate,
with no scale animation. Traveling lights remain, honor reduced motion, and no
longer require a primary Pause lights control. Enlarge map is removed.

### Fresh verification
- npm run build: passed (existing dependency/chunk warnings remain).
- cargo test --lib --manifest-path src-tauri/Cargo.toml: 313 passed, 0 failed, 2 ignored.
- Contextual actor projection: 20 passed. Graph/fit/zoom model: 18 passed.
- Controlled viewport matrix: 1755x950 overview 35; same size with long errors,
  title, briefing, expanded chat and reduced motion 39; 1920x1080 overview 35;
  1280x900 narrow stress 36; 1280x720 short-window fallback 32. All passed.
- Browser regressions: Communications 58, Situations 14, Gmail 19, Navigator 32,
  reduced-motion Navigator 32. All passed.
- Matrix assertions cover initial scroll zero, node bounds inside visible canvas,
  inspector bounds, chat exclusion, every zoom step and endpoint, reset/pan,
  selection preservation, keyboard controls, scope changes and diagnostic disclosure.

The viewport harness creates actual-size same-origin frames for reproducible tests;
it scales ONLY the outer preview for viewing in the Codex sidebar. Assertions run
inside the real 1755x950/1920x1080/etc child viewport, not against a mocked geometry.
Run /communications-viewport-harness.html and click Run acceptance matrix.
All fixture data remains synthetic. An earlier 441px sidebar run exposed an old
90px analytics-strip assertion that assumes desktop width; the requested desktop
regression now runs at a controlled 1920x1080 size. Error regressions check the new
visible summary plus retained full disclosure and cached rows.

### Files and manual review
Product: Communications.tsx, SituationsWorkspace.tsx, DocumentSituationMap.tsx,
SituationRelationshipWeb.tsx, situations.css, services/situationGraph.ts.
Verification: communications-viewport-harness.html, communications-viewport-harness.ts,
services/situationViewportChecks.ts, existing Communications/Situations harnesses,
scripts/test-situation-graph.mjs. This document and NEXT-SESSION.md record the handoff.

Review the live native Home / Whole Situation on a wide desktop: all seven branches
should appear immediately; try zoom/reset, reselect Whole Situation, open long
briefing/evidence and expand chat. Browser visual/geometry verification used only
synthetic data; native visual confirmation remains with the operator. Native dev
process 444 was responding at verification; existing development server serves the
updated frontend. No commit, push, install, mailbox mutation or model run was added.

## Reference-render visual pass — September 13, 2026

Whole Situation now presents orbital workstream cards with restrained icons, actor
previews (up to three, compact-height views show one), total actor counts and curved
tracks around a larger circular Home/Omega anchor. Clicking a workstream still
opens the contextual actor web. No reference-image names, contacts, statuses or
notification situations were inserted into live data.

Connections carry staggered white-blue traveling lights, adapting the existing
Command constellation signal cadence from hybridScene.ts: 4.5-second cycle with
about two seconds of travel followed by a pause. SVG animateMotion follows the
exact rendered curve. This is decorative motion, not evidence of live processing.
Pause lights removes the motion elements. System reduced-motion preference removes
them too, including live preference changes; static ports remain. No new rendering
library, model calls, Gmail access or persistence changes.

Navigator selection, workstream controls, glass materials and inspector typography
move toward the reference. Inspector shows recorded contact details directly, a
context breadcrumb and a return control at the top. Empty contact records are not
filled with examples. Compact windows retain a scrollable workspace and stack the
brief below the map; Enlarge/Fit remains available for long labels. This is an
incremental visual pass, not a claim of pixel-identical reference reproduction.

Verification: production frontend build passed; TypeScript passed after harness
updates; graph 15 and contextual projection 20 deterministic checks passed;
Navigator/graph 32 browser checks passed, plus 32 in the reduced-motion fixture.
Fresh Situation regression: 14 passed. Fresh Communications regression: 58 passed.
Backend unchanged; no native build/install/commit/push performed. Native development
frontend receives these changes through its existing server. Browser visual review
is synthetic and does not validate real Home facts.

## Contextual relationship web restored — September 13, 2026

The left, independently scrolling Situation Navigator remains the primary selector.
The intermediate actor-card lanes were an incorrect interpretation of compact graph
nodes and have been removed. `SituationRelationshipWeb.tsx` now renders an SVG web
with native keyboard-operable HTML buttons embedded at graph coordinates.

`contextualActors.ts` conservatively derives actor-in-context nodes from explicit,
document-cited representation links in the existing local context. Organization,
representative and situation role appear together. Canonical entity IDs, contacts,
relationship state and source references remain separate and inspectable. Ambiguous,
co-occurring, conflicting and operator-only affiliations are not fused. This is a
frontend projection, not identity resolution or a new persistent entity type.

`services/situationGraph.ts` supplies deterministic, bounded rectangular orbital
slots around a fixed central Omega anchor. Whole Situation shows the recorded
workstream hubs and one key actor per workstream (confirmed representatives preferred).
Hubs disclose total actor counts and open their workstream. Focused views replace
workstream hubs with role/function groups from actual actor roles; up to eight actors
are visible per page. Overflow workstreams and correspondence-only actors are also
paginated explicitly. Sparse scopes invent no actors. No graph dependency or physics
simulation was introduced.

Edges express recorded workstream membership, contextual role grouping and existing
relationships whose endpoints are visible. Lines terminate at node bounds; uncertain
or uncited relationships are dashed. Canonical person-to-company links inside an
already combined actor do not become duplicate self-edges. Edge titles preserve the
relationship description; evidence remains available in the inspector.

Wide layout reserves roughly 19% for navigation, 52% for map and 23% for briefing
(the rest is spacing). At constrained widths the brief moves below the canvas.
Map Fit shows the complete current page without canvas scrolling; Enlarge enables
intentional internal navigation for detail. The surrounding Communications page
remains scrollable, and persistent chat retains its separate safe row. Selecting a
node temporarily replaces the right briefing with actor role/status/evidence and
underlying identities; Back to briefing restores the situation/workstream brief.
Long node labels are clamped visually with full accessible names, tooltips and
inspector detail. There is no continuous graph animation.

Fresh verification: frontend production build passed; Rust library 313 passed,
0 failed, 2 ignored (paid acceptance). Contextual projection 20 checks; graph layout
12 checks; Situation Navigator/graph browser 28 checks; existing Situation Maps
14 checks; Communications 58 checks; Gmail 19 checks. Browser checks use synthetic
fixtures only. Whole and dense focused maps visually inspected; keyboard actor
selection/back verified. Observed 1280px narrow desktop: no horizontal overflow,
brief below map, fixed canvas and separate chat row. Wide preview measured 1680px.
Temporary browser viewport overrides reset. Existing dependency/build warnings
remain; no paid model run was added.

Preview: `/communications-harness.html?navigator` (synthetic), with 52 navigator
entries, seven populated Home workstreams, dense and long-label actor cases,
confirmed and uncertain affiliations, empty scope and a single-actor situation.
`/situations-harness.html?navigator&run` runs navigation/graph acceptance checks.
Pure checks: `node scripts/test-contextual-actors.mjs` and
`node scripts/test-situation-graph.mjs`.

Manual native-app review still belongs to the operator: inspect actual Home →
Inspections & repairs, readability and document evidence. Native visual rendering
was not automated. The frontend is served by the existing development server;
no install, commit or push was requested/performed. Gmail writes, model routing,
background intelligence changes, graph databases, automatic relationship promotion
and automatic folder ingestion remain outside this correction. Private Home
source material remains in the existing local archive, outside public fixtures/Git.

# Map-first correction after live evaluation

The first live discovery attempt failed exact quote validation (`detail_quote_mismatch`), preventing the entire batch from publishing. A later attempt failed output bounds. The interface also exposed the inbox alongside an empty situation view, making the main experience cluttered.

Communications now defaults to **Situation maps** with **Browse email** on a separate tab. Settings, archived situations and conversation/update details are disclosed on demand. The empty map area states whether discovery is running, failed or has not identified a situation, without inventing relationships.

Discovery now constrains each thread’s output with a source-specific schema: thread identity and contact/relationship emails must come from that thread’s supplied participants. It permits one bounded map-only retry when contact, optional-detail or output-bound validation fails. That retry must return no practical details and still passes participant, relationship, source identity and output validation. It cannot publish invalid quotations. Empty summaries are allowed only for excluded noise; displayed findings still require a bounded summary. This raises the maximum to three model calls for a recovery batch. Native development app was rebuilt/restarted for real-cache evaluation under the operator's explicit analysis consent. No commit, push or installed-release replacement.

Verified build, 310 Rust tests / 2 ignored, 58 Communications + 14 situation browser checks. Live retry completed successfully after source-specific schemas: one real situation published from six processed threads, no run error. Interpretation quality remains for operator review.

# Communications: evolving situations

Implemented in development on September 13, 2026. Installed release remains 0.17.0. This pass has not been committed, pushed or installed.

## Operator-approved experience

Communications leads with an ongoing situation briefing beside a relationship map. Situations emerge automatically from relevant correspondence; they are not a fixed taxonomy. Each has where things stand, what changed and informative recommended next moves. The operator can focus a person to inspect conversation logs, inspect original cached threads and quoted practical details, rename, merge, close, dismiss or restore a situation, and switch to an overview of available situations.

“Update Olympus” records corrections, goals, changes and pasted external summaries as explicit operator context. Recent explicit updates take priority over prior generated inferences. Matching Research Center excerpts supply context, never automatic operator intent. Recommendations remain generated advice, not obligations or approved actions. Relationships and roles are inferred; neither an email nor a generated map establishes legitimacy.

Reply drafts are generated only after **Draft reply**. The initial recipient comes from the latest cached incoming sender, not model output. To, subject and body are editable and saved locally with revision checks. There is no send command, Gmail draft creation, attachment upload or permission expansion. A later sending evolution must show recipients/content/attachments for review, require explicit Send and a final confirmation.

## Implementation

- `src/components/panels/SituationsWorkspace.tsx`: primary Communications view, stable keyed SVG map, overview, briefing, logs, updates, management and local draft editor.
- `src/services/situations.ts`: typed native command boundary; fixture client is separate and imported only by development harnesses.
- `src-tauri/src/commands/gmail/situations.rs`: account-scoped persistence, snapshots, operator edits and native background cadence.
- `src-tauri/src/commands/gmail/situations/engine.rs`: incremental fixed workflow, changed-thread selection, discovery, synthesis, validation and atomic publication.
- `src-tauri/src/commands/gmail/situation_contract.rs`: typed strict discovery/briefing outputs with evidence validation. These are purpose-specific compiled contracts, not a new general agent runtime or additions to the older two-skill registry.
- `src-tauri/src/commands/gmail/situations/drafts.rs`: explicit generation and optimistic local saves.

Additive tables: `communication_situations`, `communication_situation_sources`, `communication_situation_updates`, `communication_situation_state`, `communication_situation_drafts`. No source mail or vault intent is rewritten. Run/event receipts use existing communication tables under `communication-situations/v1`; the older v3 history query excludes these records. Model request receipts use the existing prompt-free model telemetry.

The workflow is snapshot → discover → brief → validate → publish. There are normally at most two model requests per refresh batch (three when the bounded map-only retry is needed), and no model-selected tools or hidden expansion loop. Discovery groups related threads into existing or new situation IDs. Synthesis can revisit dirty situations without reinterpreting unchanged messages. Publication checks account, history range, operator revision, all current mail fingerprints and Research snapshot again. A context change aborts publication and leaves previous understanding intact.

Discovery validates participant membership, relationship endpoints, output size and source identity. Practical details require exact source quotes; payment/date values must occur in those quotes. Portal values must be literal HTTPS addresses without embedded credentials. This validates source grounding, not the truth or safety of a sender's claims. Briefing recommendations must point to supplied current threads. Source excerpts and generated content are untrusted data, not execution instructions.

## Refresh and privacy

Background understanding defaults on for this operator-approved evolution and runs only while the native app is open, including when another mode is selected. The worker checks every 30 seconds after a 20-second startup delay, with at least five minutes between background analysis attempts. Operator edits invalidate the pending context and make the next worker check eligible. Manual Refresh now is also available. The existing single-running-analysis constraint prevents overlap with legacy analysis.

The primary OpenAI model receives bounded cached email excerpts, situation context, selected operator updates and relevant Research excerpts. The UI and Gmail preferences disclose this; the background toggle pauses it. Pausing also invalidates an in-progress analysis. Gmail remains `gmail.readonly`, tokens remain in the existing native credential store, and no mailbox or model call occurs merely by opening the browser harness.

Frontend snapshots poll every three seconds without initiating model calls. Existing map node positions, selected situation/person, scroll and editable draft text survive refreshes. New people fade in briefly, with reduced-motion support. Source changes mark findings/drafts stale; old understanding remains visibly available. Preflight and run failures are surfaced instead of silently presenting completion.

## Deliberate first-release bounds

- Existing Gmail history range and 2,000-message cache bound apply. This cannot reconstruct pre-cache correspondence.
- Six changed threads per batch, four latest eligible messages per thread, 2,000 body characters each. Attachments are not read.
- At most six situation briefings per batch, eight current thread observations each, five practical details per observation in synthesis, three Research excerpts of 2,000 characters each.
- Up to 24 active situations; snapshot/catalog surfaces active situations plus recent archive entries within 96 total. Up to 2,000 recent thread observations, 32 recent operator updates and 100 local drafts are surfaced. Synthesis uses four recent matching updates; discovery uses eight recent updates. Longer context is explicitly bounded.
- The map shows up to 16 people; remaining contacts stay available through the person controls. Overview is a situation-card index; cross-situation shared-person mapping is a later refinement.
- Background batches are incremental, not token-by-token graph streaming. A large initial backlog can take multiple refresh cycles.
- Research matching uses the existing deterministic retrieval. Model interpretation and grouping quality still require live provider/mailbox acceptance; synthetic validation does not establish that quality.

## Verification / development

`npm run build` passed. Full Rust lib suite: **309 passed, 0 failed, 2 ignored**. Communications regression harness: **57 checks passed**. Dedicated situation harness: **14 checks passed**, no browser errors. Desktop and narrow layouts were inspected. Existing dependency/bundle warnings and the pre-existing assistant dead-code warning remain. The dedicated browser checks cover on-demand drafting, map deduplication, source routing, incremental node identity/position, preservation of selected person and unsaved draft text, local saves, operator updates, overview and absence of sending.

Open `http://127.0.0.1:31420/situations-harness.html` for the isolated synthetic design study, `?run` for its checks. `communications-harness.html` exercises the integrated page and existing source browser. All examples are invented and clearly marked; none describe the operator's actual home purchase. Do not launch a new native build for “synthetic testing”: its enabled background worker can analyze real cached mail using the configured provider. Native acceptance is a separate step.
# Local document foundations — September 13, 2026

Situations can now include an account-scoped `communication_situation_contexts`
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

Discovery prompts now require meaningful ongoing work/coordination. No new map
is a valid outcome. A backend gate also prevents specified routine standalone
activation, verification, purchase and balance notifications from creating maps;
this is a conservative guard, not an exhaustive spam classifier. Existing
situations can still receive relevant informational evidence.

Local acceptance: one Home foundation imported from the operator handoff and
57 folder files (54 unique byte contents); 379 PDF pages, two workbooks and 48
local OCR jobs. Selected decision-relevant pages visually checked, not every
page/image. Six operator-rejected noise maps dismissed; one relevant insurance
map merged into Home with its email evidence retained. Real content is outside
Git; `?documents` uses an entirely synthetic fixture. Vite denies `output/**`
and SQLite files; tested private extraction URLs return 403.

Verification: frontend production build and native debug build pass; 313 Rust
tests pass, 2 ignored. Existing situation browser harness passes 14 checks;
document workstream selection, entity selection, provenance disclosure and
polling retention checked in browser. Native process responding and real DB
foundation verified; native visual inspection unavailable through current tools.
Latest background email refresh returned an OpenAI `response_failed` error;
the curated foundation remains available. Installed release was not replaced.
