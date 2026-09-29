Status, 2026-09-28: the Communications workspace reference; dated sections below are historical layers. Released through 0.19.0. The live analysis graph is `communication-intelligence/v4` ([COMMUNICATION-INTELLIGENCE-V3.md](COMMUNICATION-INTELLIGENCE-V3.md), [WORKFLOW-INSPECTION.md](WORKFLOW-INSPECTION.md)); it calls the primary model on explicit Analyze/Refresh, and background situation understanding ([COMMUNICATION-SITUATIONS.md](COMMUNICATION-SITUATIONS.md)) calls it while the app is open. Statements below that no model calls are made describe earlier versions. The September 28, 2026 design-review section immediately below supersedes earlier layout, polling and wording where they differ.

# Design-review changes — September 28, 2026

Items U3, U5, U8, U12, D1, D3, F1, F4 and F5 of the [design review](reviews/2026-09-28-design-usability/DESIGN-USABILITY-REVIEW.md). Code: `Communications.tsx`, `SituationsWorkspace.tsx`, `SituationRelationshipWeb.tsx`, `DocumentSituationMap.tsx`, `NextStepStrip.tsx`, `SituationSourceReview.tsx`, `SituationDraftEditor.tsx`, `useSituationSnapshot.ts`, `GmailSettings.tsx`, `communications.css`, `situations.css`; services `gmail.ts`, `situationNavigator.ts`, `situationGraph.ts`, `mapTypography.ts`, `recipients.ts`, `commsTime.ts`; Rust `gmail/store.rs` and `gmail/mod.rs` (`gmail_cache_counts`), `gmail/situations.rs` (freshness and revision).

**Laptop layout.** From 1200px wide, the navigator, map and inspector sit side by side, with an inspector of about 300px (`clamp(290px, 24vw, 340px)`); email and document situations share one layout. At 1500×800 and above the map uses the space left of the chat and the inspector takes the chat's width; at 2200px it grows to 520–680px and the briefing reads at 15px. Below 1200px the inspector stacks under the map and the page scrolls. Where the window is short or the inspector narrow (below 1500 wide or 900 tall), a one-line **next-step strip** above the map states the briefing's useful next step and jumps to it. When too little height is left for a readable map, the page scrolls instead of squeezing the canvas.

**Map.** The fit scale comes from the measured canvas, capped at 1.1× and floored at 0.45×; below that the canvas scrolls. Map text never renders under 12px: font sizes grow in graph units as the scale falls, and a density setting (full, compact, tight) drops secondary lines instead of shrinking text. Anchor labels wrap by whole words. A legend replaces the repeated "Organization unconfirmed" on each node. A scope with no supported actors shows a sentence rather than a lone anchor scaled up. The canvas focus ring sits inside the canvas, with a "+ or − to zoom" hint.

**Inspector.** Activity & updates, source review and drafts render in the inspector column; the absolute 65vh overlay is gone. Selecting a correspondence contact opens their log there.

**Review source.** Three labelled blocks: **Recommendation** (or Olympus interpretation), marked Generated; **Quoted from source**, marked Verbatim — the observation's exact `details[].quote` values, each with **Show in message**, which highlights the matching text in the cached thread and moves focus to it; and **Full thread**. **Ask Olympus** attaches the thread reference to the console as context under a "Gmail thread reference" heading instead of pasting it into the prompt. The situation path never says "No candidate findings".

**Header status cluster.** The header reads "Gmail · Connected · read only" (or syncing, not connected, authentication required, sync failed) and a freshness line: "Mail synced … · Understanding updated … · Background on/paused". It never says Connected alone while an error is recorded. The actions are labelled **Sync mail** (fetch new mail now; disabled until reconnected when authentication is required) and **Refresh situations** (run situation understanding now; sends cached excerpts to the reasoning provider), beside the understanding settings. The Browse email view's analysis action is renamed **Run thread triage**, under "Thread triage history".

**Distinct error states.** Each problem is stated with its cause behind Details and the one action that recovers:

- Authentication required — Reconnect, and Gmail settings.
- Mail sync failed — with the backend's scheduled next attempt ("next attempt in 5 min · 12:00") when there is one, otherwise "cached mail remains available"; Retry now.
- Mail view could not be read — Retry now.
- Understanding paused after N failed attempts; next attempt at the background worker's real resume time — Retry now. Background attempts back off from five minutes to four hours; previous analysis stays shown.
- Intelligence refresh failed · Showing previous analysis — Retry now.
- Situation action failed — Dismiss.
- Situations could not be refreshed · showing the last reading — Retry now.

The settings link opens Preferences with the Gmail section already expanded and focused.

**Data-reducing actions.** See [GMAIL.md](GMAIL.md#design-review-changes--september-28-2026): cache removal states the backend's counts and the recovery path; narrowing the history range asks first with the number of messages it would prune.

**Navigator.** Situations are ordered by the existing review policy (needs attention, then review soon, then the rest), most recently updated first within each band. Situations known only from correspondence have no saved context for the policy and read "Not assessed". Each card has a priority chip. Filters: All, Active, Emerging, Open questions; a title search. Arrow keys move between cards (one tab stop), and **Skip to briefing** jumps past the list. Overview cards open their situation.

**Session state and drafts.** Situation, workstream, actor, dossier tab, view (situations or mail), navigator filter and search, and unsent reply drafts are kept per account in session view state, so a mode switch or refresh returns to the same place; an unsent draft left open reopens in the inspector. Closing a changed draft asks Keep editing / Save and close / Discard changes. Recipients are kept as typed, display names included, and parsed when the field is left or on save: addresses are extracted, deduplicated and lower-cased, entries without an address are named ("Not an email address: …"), and at most eight recipients are allowed. A disabled Draft reply says why (another action running, or understanding needs refreshing). Drafts are lost on app restart unless saved locally.

**Polling and refresh.** One situation poll serves the header and the maps: every 3 s while the maps are shown, every 15 s otherwise, and not at all while the window is hidden. The poll passes the snapshot revision it holds; the backend answers `unchanged` and the view skips re-parsing. Gmail status is read every 10 s while the window is visible; the mail list and the thread-triage history are read only while shown. Ctrl/Cmd+R re-reads mail status, the mail view (when shown) and situations; it does not sync Gmail or run understanding.

**Wording and dates.** Ordinary views use human labels and the shared date formatter; message ids, thread ids and fingerprints are under Inspect source disclosures.

Verification: build; `cargo test --lib` with `gmail_cache_counts`, freshness and revision tests on in-memory databases; `scripts/test-situation-navigator.mjs` (15), `scripts/test-map-typography.mjs`; situations, communications, gmail and relationship-dossier harnesses; a viewport matrix at eight sizes and 25 app flows on the IPC mock (see the [implementation checklist](reviews/2026-09-28-design-usability/IMPLEMENTATION-CHECKLIST.md)). Not verified with a real account: the error states, counts, next-attempt times and revoke.

# Focused refinement — September 12, 2026

The current composition supersedes the initial layout described below. Communications now scrolls in the app's center workspace, while global navigation remains stable and the console occupies its own bottom grid row. There is no internal message-list scrollbar. Pages remain bounded to 40 messages and changing page returns to the list heading. Opening the console reserves more layout height rather than overlaying content. At narrower widths the Signals rail follows the inbox; all analytics remain in normal page flow.

An 80px intelligence strip replaces four KPI cards. The inbox occupies 70% of the wide workbench and the unboxed Signals rail 30%. “Needs You” is still the existing candidate-based Attention group; “Projects” still means suggested relationships, with explicit candidate labels. Signals list at most three existing fingerprint-current candidates with source reasons, plus suggested project relevance and compact sender counts. The backend returns these three metadata rows separately from pagination; no new analysis is produced and they are removed from the assistant aggregate packet to preserve retrieval behavior.

Analytics is collapsed by default below the workbench. It contains the existing received/sent chart, text values, thread counts and source/sender distribution. Larger view options are disabled outside the configured cache limit. Detailed cache/coverage information is behind the subtle cached-view disclosure. No fabricated trends are added.

Preview correction: three locally cached Hertz samples had Markdown link notation in converted body text and clean provider snippets. The old preview read the converted `cleanText` field. The metadata query now uses the already-stored Gmail snippet, decodes entities with literal angle brackets escaped, normalizes whitespace and limits the display to 180 characters. Missing snippets show an open-thread prompt; they never fall back to converted body markup. Source bodies, fingerprints, retrieval excerpts and normalization/sync remain unchanged. Local search rows show a keyword-match cue rather than exposing converted excerpt markup. Regression coverage preserves literal Markdown from a provider snippet and verifies canonical source remains untouched. No actual message text was printed during the Hertz diagnosis.

The synthetic harness now uses the same constrained app/grid/scroll layout and a persistent synthetic chat region, including its expanded state. The original standalone document-scrolling harness could not catch the app's clipping defect. Viewports include the in-app sidebar and 1280x720 desktop, with a 760px constrained study. Manual native mailbox layout and model-answer acceptance remain distinct from these browser checks.

Files for this refinement: `Communications.tsx`, `communications.ts`, `styles.css`, `communications-harness.tsx`, Gmail `communications.rs`, `mod.rs` (exclude new UI signals from assistant metadata), `tests.rs`, and handoff documentation. No changes to Command, Project, Research, OAuth, mailbox permissions, or sync logic. No commit/push/install.

Refinement validation: `npm run build` passed; Rust suite **268 passed / 0 failed / 2 ignored**; Communications harness **39 checks passed** in both the visible sidebar and 1280x720 browser, including constrained-width and full-width scrolling, expanded/collapsed analytics and chat exclusion. Gmail UI **17**, knowledge UI **12**, Command/instrument **82** checks passed (including reduced motion). `git diff --check` passed. Native development process remained running. Real Hertz source diagnosis was read-only and printed flags only; the revised live mailbox interface still merits operator visual review.

---

# Communications workspace — development acceptance

## Design

Communications is a fourth existing dashboard mode, with the Olympus wordmark, existing architectural background, amber selection, cool borders and compact dark panels. It occupies the operational workspace rather than duplicating or relabelling the Command ring from the reference. Command's geometry and constellation implementation are untouched by this pass. The console remains anchored at bottom right.

## Implemented

Connection/sync header, settings route, four metrics, smart groups, 40-message pages inside a bounded scroll area, sender filter, local search, daily activity, insights and top senders. Disconnected/browser-only, empty, busy, authentication, offline and import-cap states are distinct. View range never changes sync history or initiates ingestion. Native state refreshes every ten seconds while the workspace is mounted. *(Superseded 2026-09-28: status every 10 s while the window is visible; the mail list only while it is shown.)*

## Analytics

The native `gmail_workspace` command extracts only metadata and a 180-character preview from SQLite JSON, matches candidates by account/message/current fingerprint, aggregates in Rust, and sends only aggregates plus the selected 40 rows to React. It does not deserialize full bodies into the dashboard. An additive account/availability/scope/date index constrains the query; candidate lookup uses its existing primary key. Datasets over 2,000 eligible messages fail with the existing bounded-range error rather than silently truncate.

All metrics refer to available, in-scope cached messages within the rolling display interval, capped by configured history and excluding future timestamps:

- Messages: eligible message count, including Inbox and Sent.
- Needs attention: distinct messages with at least one current candidate.
- Possible responses: messages with `possible_response_needed` candidates.
- Deadlines mentioned: messages with `possible_deadline` candidates; this is not a count of parsed dates or commitments.
- Suggested project count: messages with `possible_project_relationship` candidates.
- Threads: distinct eligible thread IDs; active means present in the display interval.
- Top senders / People: exact sender-header grouping of messages without SENT. No identity normalization, person/service inference or reputation scoring.
- Activity: UTC calendar buckets within the rolling interval; SENT labels classify outgoing, remaining messages are received. Boundary days are partial. Text values accompany the chart.
- Inbox / Sent: independent label counts, which may overlap for self-mail.

Counts never imply full-mailbox coverage. Configured sync horizon is not proof that every day successfully imported. No historical coverage ledger or candidate snapshots exist; comparisons deliberately show “Not enough history for comparison.” Historical trends remain deferred even when a broader range is selected.

## Smart groups

Inbox uses the INBOX label. Attention uses any fingerprint-current candidate. Responses is the supported subset of the proposed Actions tab, without invented action extraction. Suggested projects uses the existing project-relationship candidate. People filters received messages by exact sender header. Search reuses existing local FTS keyword/prefix AND matching, at most two threads/four messages each, across synced history; it is explicitly separate from the dashboard view range. No Gmail query syntax or semantic search is advertised.

## Thread experience

Selecting a message lazily loads its in-scope cached thread (maximum 100 messages). Cleaned source text renders inertly; attachment metadata is listed without downloading content. Evidence shows message/thread IDs, fingerprint and body status. Findings apply to the selected row and are clearly labelled suggestions; search results currently have no attached candidate findings. The close control receives focus, Escape closes, and focus returns to the invoking row. Late thread responses cannot restore a closed/different selection.

“Ask Olympus about this thread” prepares a prompt in the console; it does not send automatically. Existing drafts are preserved. The thread is an attachment: the transcript shows the operator's words with an “Attached: Gmail thread · <subject>” chip, and the reference itself sits under Inspect (see [COMMAND-CONSOLE.md](COMMAND-CONSOLE.md), Attached context). The model still receives the marker. A validated hexadecimal thread marker is resolved natively against the enabled account and existing scope, with at most four excerpts and existing saved provenance. Typed messages submitted from Communications carry a workspace marker; the native evidence packet adds seven-day deterministic aggregates/top-five sender headers, and the supported general attention prompt includes up to two candidate threads. The assistant's analytics default is seven days, not the UI's larger display range. Microphone-driven questions retain their existing query-based routing. Arbitrary natural-language analytic filters and live model answer quality are not certified by these tests.

## Data boundaries

Source metadata/counts remain facts about the local cache. Candidate interpretations remain generated suggestions, never reviewed relationships, tasks, decisions or commitments. This pass added no tables, token handling changes, mailbox writes or automatic excerpt submission. Models receive evidence after a question is sent, or when background situation understanding (added later, pausable) analyzes changed threads; see [COMMUNICATION-SITUATIONS.md](COMMUNICATION-SITUATIONS.md). Its failures back off rather than repeating every cycle. Remove cached mailbox also deletes the derived situation, draft, briefing and analysis records.

## Files changed in this pass

- `src/App.tsx`, `src/hooks/useDashboardMode.ts`, `src/components/panels/HeaderBar.tsx`: mode, navigation and console routing.
- `src/components/panels/Communications.tsx`, `src/services/communications.ts`, `src/styles.css`: workspace, native client contract and scoped styles.
- `src/components/panels/ChatPanel.tsx`: prompt-only console prefill support.
- `src-tauri/src/commands/gmail/communications.rs`, `mod.rs`, `store.rs`, `tests.rs`, `src-tauri/src/lib.rs`, `src-tauri/schema.sql`: additive query index, bounded metadata aggregates, command registration and scoped evidence.
- `communications-harness.html`, `src/communications-harness.tsx`: synthetic visual/interaction fixture.
- `docs/GMAIL.md`, `docs/NEXT-SESSION.md`, `ARCHITECTURE.md`, this document.

Earlier Gmail, knowledge and constellation edits remain uncommitted alongside this pass. No commit, push or release install was requested or performed.

## Visual harness

Open `http://127.0.0.1:31420/communications-harness.html` while native development Vite runs. Add `?run` for deterministic interaction checks. It also works on another Vite port serving this checkout. Synthetic states: populated, empty, syncing, disconnected, network error, safety limit and authentication required. Smart group selectors expose responses/deadlines/project suggestions. “Toggle narrow study” constrains the container. No real Gmail data, credentials or model requests are used.

## Live data limitations

The previous session verified a successful 206-message native import. This pass has not manually reconciled the new dashboard against that mailbox, inspected real MIME samples, or exercised a paid assistant reply. Browser fixtures are not native end-to-end Gmail acceptance. Validate counts, sender grouping and candidate usefulness in the native Communications tab before treating this as production accepted.

## Deferred

Historical comparison coverage, semantic topics, accepted/dismissed project linking, generic action extraction, person/service identity, semantic search, attachments ingestion, multi-account, mail composition/mutation, autonomous handling and task/decision creation. Background LLM analysis now exists as situation understanding.

## Next visual iterations

Review density at your normal desktop size, the 300px list aperture, amber candidate tags, inspector width and how much background should show around the workspace. The reference's large companion ring is intentionally not duplicated in this separate mode.

## Tests — final pass

- `npm run build`: passed (existing dependency/chunk warnings remain).
- `cargo test --lib --manifest-path src-tauri/Cargo.toml --target-dir C:\Users\kevpe\dev-target\olympus-memory`: **267 passed, 0 failed, 2 ignored**, including all Gmail tests and three new Communications calculation/retrieval tests.
- Communications UI fixture: **29 passed**, including four-mode navigation, persistence, 40-row paging, filters, evidence, inert HTML, keyboard focus, prompt-only handoff and empty/error/auth/import-cap/narrow states.
- Gmail UI: **17 passed**; knowledge UI: **12 passed**; Command/instrument: **82 passed**, including reduced motion and hidden rendering.
- Console harness passed (conversation window, scroll threshold, ordered stream); ambient motion passed **12,000 samples**.
- Typed voice **21**, voice preferences **35**, project command board **15**, realtime voice **20** checks passed.
- Native development process rebuilt and remained running. Full app Communications navigation and the synthetic workspace were visually inspected in-browser at wide and narrow dimensions. No live Gmail dashboard or paid model answer is claimed as manually verified.
- `git diff --check`: passed. Initial Rust temporary-string lifetime compilation error was corrected before the passing suite; the initial sandboxed esbuild harness run was retried successfully with required filesystem access.
