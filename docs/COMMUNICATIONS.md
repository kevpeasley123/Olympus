See the adopted [v2 architecture critique](COMMUNICATION-ARCHITECTURE-CRITIQUE.md) for the current skill boundaries and workflow.

# Communication Intelligence supersedes the inbox-first layout

See [Communication Intelligence](COMMUNICATION-INTELLIGENCE.md). Communications now leads with a manual, local evidence-backed brief. Two active typed skills use shared GraphNode / SkillContract definitions. The v2 graph has five nodes; project relevance uses a bounded deterministic matcher, not a discovery loop. Analytics remains collapsed. No model calls, Gmail writes, project changes or memory promotion are added. Earlier implementation entries below are historical.

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

Connection/sync header, settings route, four metrics, smart groups, 40-message pages inside a bounded scroll area, sender filter, local search, daily activity, insights and top senders. Disconnected/browser-only, empty, busy, authentication, offline and import-cap states are distinct. View range never changes sync history or initiates ingestion. Native state refreshes every ten seconds while the workspace is mounted.

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

“Ask Olympus about this thread” prepares a prompt in the console; it does not send automatically. Existing drafts are preserved. A validated hexadecimal thread marker is resolved natively against the enabled account and existing scope, with at most four excerpts and existing saved provenance. Typed messages submitted from Communications carry a workspace marker; the native evidence packet adds seven-day deterministic aggregates/top-five sender headers, and the supported general attention prompt includes up to two candidate threads. The assistant's analytics default is seven days, not the UI's larger display range. Microphone-driven questions retain their existing query-based routing. Arbitrary natural-language analytic filters and live model answer quality are not certified by these tests.

## Data boundaries

Source metadata/counts remain facts about the local cache. Candidate interpretations remain generated suggestions, never reviewed relationships, tasks, decisions or commitments. No new tables, token handling changes, mailbox writes, background model jobs or automatic excerpt submission were added. Models receive evidence only after a question is sent, under the existing Gmail disclosure.

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

Historical comparison coverage, semantic topics, accepted/dismissed project linking, generic action extraction, person/service identity, semantic search, attachments ingestion, multi-account, mail composition/mutation, autonomous handling, task/decision creation and background LLM analysis.

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
