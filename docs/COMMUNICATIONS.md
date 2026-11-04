# Communications workspace

Communications opens on **Relationships**, the focused map described in [COMMUNICATION-SITUATIONS.md](COMMUNICATION-SITUATIONS.md). **Browse email** remains a separate view. The console is the on-demand **Ask Olympus** dock shared with Project and Research. This document describes source behavior; release and native verification state belong in [NEXT-SESSION.md](NEXT-SESSION.md).

## Celestial Observatory layout

The map occupies the left pane; the right pane shows the selection's **Summary**, **Conversations**, and **Documents**. Midnight surfaces, static stars and faint astronomical arcs belong to map whitespace. The reading panel is opaque. Champagne marks selection; no animation implies active analysis. Narrow windows stack the panes instead of shrinking text.

Selecting a tile changes the detail panel without moving the map. Its separate branch arrow changes the map's focus. Breadcrumbs return to parents; bounded pages, scrolling, zoom and search keep larger maps navigable. Search covers recorded names, contact addresses, conversation subjects and document titles within the selected situation. It does not search full message bodies or file contents.

The situation selector provides direct navigation. **All** opens the existing priority directory, filters, title search and overview. **More** opens activity, operator updates, source review, local drafts and situation management. Detailed actor/workstream records, qualified related connections and valid source-linked timelines remain under Summary disclosures. These records retain their existing evidence semantics.

The Gmail status disclosure contains freshness, **Sync mail**, **Refresh situations**, background understanding and connection settings. Sync fetches mail; Refresh situations invokes the existing analysis route. Errors and recovery actions remain visible outside the disclosure. Collapsing controls does not suppress authentication or understanding failures.

## State, sources and drafts

The pure `src/services/focusedMap.ts` projection builds a navigation graph from saved context and cached observations. It does not mutate canonical entities, infer ownership from shared files, ingest attachments or invoke models. Exact recorded mailbox addresses may connect actors with correspondence; similar names and shared source references do not. Unmatched participants remain reachable. Email-derived associations remain labelled inferred.

Focus, selection, branch page, query and detail tab are kept per account and situation in in-memory view state. Mode changes preserve them; removed IDs fall back safely. They are not written to disk. Unsent reply edits retain the existing account-scoped session behavior; saved local drafts survive through the native draft store.

**Review source** separates generated interpretation, exact quoted evidence and the cached thread. Source text stays inert. **Ask Olympus** prepares a thread reference in the console without sending. **Draft reply**, under More's conversation log, is explicit and retains stale/busy gating. Closing changed drafts retains Keep editing / Save and close / Discard changes. There is no send command or Gmail draft creation.

Document opening uses situation ID and source ID through the existing native registry. Availability is checked rather than inferred from a title or path. Generated/supplied summaries retain their origin label; legacy local files do not assert authorship. Gmail attachment listings are metadata, not proof that file contents are saved. See [OPERATIONAL-DOSSIERS.md](OPERATIONAL-DOSSIERS.md).

## Polling and recovery

One situation poll serves the header and map: every three seconds while visible, every fifteen seconds otherwise, paused when the window is hidden. The native revision response avoids reparsing unchanged snapshots. Gmail status polls while visible; mail and triage history load only when shown. Ctrl/Cmd+R rereads local state without syncing Gmail or invoking understanding.

Authentication, sync failure, unavailable cached reads, analysis backoff, understanding failure and failed operator actions retain their existing separate causes and recovery actions. Preferences opens with Gmail focused. Cache removal and history narrowing retain the boundaries in [GMAIL.md](GMAIL.md).

## Development verification

`scripts/test-focused-map.mjs` checks the pure projection. `scripts/test-focused-map-browser.mjs` exercises the integrated Communications fixture and captures responsive states. `scripts/test-focused-map-sources.mjs` uses `focused-map-harness.html` for account isolation, expansive branches, delayed file availability and source boundaries. These use synthetic data; they do not prove native WebView2, real Gmail or shell opening. The older radial map and viewport studies remain historical fixtures, not acceptance evidence for the focused interface.

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

`communications-harness.html`, served by `npm run dev` on port 31420, renders synthetic states: populated, empty, syncing, disconnected, network error, safety limit and authentication required, with a narrow-study toggle; `?navigator&fit&observatory` shows the focused map with the fixture console closed. The older `?run` and `communications-viewport-harness.html` studies target the previous layout; use the focused-map browser scripts for this interface. No real Gmail data, credentials or model requests are used.

## Deferred

Historical comparison coverage, semantic topics, accepted/dismissed project linking for mail, generic action extraction, person/service identity, semantic search, attachment ingestion, multi-account, Gmail sending or mutation, autonomous handling and task/decision creation.
