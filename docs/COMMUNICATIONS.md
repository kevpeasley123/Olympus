Status, 2026-10-12: the Communications workspace reference, part of the installed 0.30.0. Communications has two views: **Situation maps**, the default ([COMMUNICATION-SITUATIONS.md](COMMUNICATION-SITUATIONS.md)), and **Browse email** (below). Thread triage in Browse email runs `communication-intelligence/v4` only on request ([COMMUNICATION-INTELLIGENCE-V3.md](COMMUNICATION-INTELLIGENCE-V3.md), [WORKFLOW-INSPECTION.md](WORKFLOW-INSPECTION.md)); background situation understanding calls its configured analysis route while the app is open. The console is the on-demand **Ask Olympus…** dock shared with the Project and Research modes. The September 28, 2026 design-review section is the current layout, polling and wording.

# Design-review changes — September 28, 2026

Items U3, U5, U8, U12, D1, D3, F1, F4 and F5 of the [design review](reviews/2026-09-28-design-usability/DESIGN-USABILITY-REVIEW.md). Code: `Communications.tsx`, `SituationsWorkspace.tsx`, `SituationRelationshipWeb.tsx`, `DocumentSituationMap.tsx`, `NextStepStrip.tsx`, `SituationSourceReview.tsx`, `SituationDraftEditor.tsx`, `useSituationSnapshot.ts`, `GmailSettings.tsx`, `communications.css`, `situations.css`; services `gmail.ts`, `situationNavigator.ts`, `situationGraph.ts`, `mapTypography.ts`, `recipients.ts`, `commsTime.ts`; Rust `gmail/store.rs` and `gmail/mod.rs` (`gmail_cache_counts`), `gmail/situations.rs` (freshness and revision).

**Laptop layout.** From 1200px wide, the navigator, map and inspector sit side by side, with an inspector of about 300px (`clamp(290px, 24vw, 340px)`); email and document situations share one layout. At 1500×800 and above the inspector's width (at least 370px) and height are derived from the measured console column (`--situation-chat-width`, `--situation-chat-height`); this rule was written for the console column of 0.19.0 and its rendering beside the on-demand console dock (0.29.0 onward) has not been verified. At 2200px the inspector grows to 520–680px and the briefing reads at 15px. Below 1200px the inspector stacks under the map and the page scrolls. Where the window is short or the inspector narrow (below 1500 wide or 900 tall), a one-line **next-step strip** above the map states the briefing's useful next step and jumps to it. When too little height is left for a readable map, the page scrolls instead of squeezing the canvas.

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

# Browse email

Browse email shows, top to bottom: a cached-view disclosure (configured sync limit; Inbox and Sent only; not a complete mailbox; "Not enough history for comparison"), the collapsed **Thread triage history**, the message list, and a collapsed **Analytics** disclosure. Pages hold 40 messages; changing page returns to the list heading. The view range (7, 30, 90, 180 or 365 days) never changes sync history or starts ingestion; ranges beyond the configured history are disabled.

## Analytics

The native `gmail_workspace` command extracts only metadata and a 180-character preview from SQLite JSON, matches candidates by account/message/current fingerprint, aggregates in Rust, and returns aggregates plus the selected 40 rows. It does not deserialize full bodies into the dashboard. The `gmail_workspace_scope` index (account, availability, scope, date) constrains the query. Datasets over 2,000 eligible messages fail with the bounded-range error rather than silently truncate.

Analytics shows four counts, the received/sent chart with its text values, distinct threads, Inbox/Sent counts and the ten most frequent received senders. All refer to available, in-scope cached messages within the rolling view range, capped by configured history and excluding future timestamps:

- Messages: eligible message count, including Inbox and Sent.
- Attention: distinct messages with at least one current candidate.
- Responses: messages with `possible_response_needed` candidates.
- Deadlines: messages with `possible_deadline` candidates; this is not a count of parsed dates or commitments.
- Threads: distinct eligible thread IDs.
- Sender distribution: exact sender-header grouping of messages without SENT. No identity normalization, person/service inference or reputation scoring.
- Activity: UTC calendar buckets within the rolling interval; SENT labels classify outgoing, remaining messages are received. Boundary days are partial.
- Inbox / Sent: independent label counts, which may overlap for self-mail.

Counts never imply full-mailbox coverage. Configured sync horizon is not proof that every day successfully imported. No historical coverage ledger or candidate snapshots exist, so no trend or comparison is shown.

List previews use the stored Gmail snippet, entity-decoded with literal angle brackets escaped, whitespace-normalized and limited to 180 characters; they never fall back to converted body markup. A missing snippet shows an open-thread prompt, and search rows show a keyword-match cue.

## Groups

Inbox uses the INBOX label. Attention uses any fingerprint-current candidate. Responses uses `possible_response_needed` candidates, without invented action extraction. Projects uses the project-relationship candidate. People filters received messages by exact sender header. Search reuses local FTS keyword/prefix AND matching, at most two threads with four messages each, across synced history; it is separate from the view range. No Gmail query syntax or semantic search is advertised. The Attention, Responses and Projects groups state that their rows are suggestions, not approved actions, commitments or project assignments.

## Thread inspector

Selecting a message lazily loads its in-scope cached thread (maximum 100 messages). Cleaned source text renders inertly; attachment metadata is listed without downloading content. Inspect source shows message/thread IDs, fingerprint and body status. Findings apply to the selected row and are labelled Generated; search results have no attached candidate findings. The close control receives focus, Escape closes, and focus returns to the invoking row. Late thread responses cannot restore a closed or different selection.

"Ask Olympus about this thread" prepares a prompt in the console; it does not send automatically. Existing drafts are preserved. The thread is an attachment: the transcript shows the operator's words with an "Attached: Gmail thread · <subject>" chip, and the reference itself sits under Inspect (see [COMMAND-CONSOLE.md](COMMAND-CONSOLE.md), Attached context). The model still receives the marker. A validated hexadecimal thread marker is resolved natively against the enabled account and existing scope, with at most four excerpts and existing saved provenance. Typed messages sent while Communications is open carry a workspace marker and a Communications label in the transcript; the native evidence packet adds seven-day deterministic aggregates and the top five sender headers, and the general attention questions ("What needs my attention?", deadlines this week) include up to two candidate threads. The assistant's analytics window is seven days regardless of the view range. Microphone-driven questions keep their query-based routing. Arbitrary natural-language analytic filters and live answer quality are not covered by tests.

## Data boundaries

Source metadata and counts are facts about the local cache. Candidate interpretations remain generated suggestions, never reviewed relationships, tasks, decisions or commitments. Browse email makes no mailbox writes and sends nothing to a model by itself. Models receive evidence when a question is sent, when thread triage or **Draft reply** is requested, or when background situation understanding (pausable) analyzes changed threads; see [COMMUNICATION-SITUATIONS.md](COMMUNICATION-SITUATIONS.md). Its failures back off rather than repeating every cycle. Remove cached mailbox also deletes the derived situation, draft, briefing and analysis records.

## Visual harness

`communications-harness.html`, served by `npm run dev` on port 31420, renders synthetic states: populated, empty, syncing, disconnected, network error, safety limit and authentication required, with a narrow-study toggle; `?run` runs the interaction checks. `communications-viewport-harness.html` runs the viewport matrix. No real Gmail data, credentials or model requests are used.

## Deferred

Historical comparison coverage, semantic topics, accepted/dismissed project linking for mail, generic action extraction, person/service identity, semantic search, attachment ingestion, multi-account, Gmail sending or mutation, autonomous handling and task/decision creation.
