# Implementation checklist — September 28 design review

This checklist tracks the work that implements
[DESIGN-USABILITY-REVIEW.md](DESIGN-USABILITY-REVIEW.md). It stays current so the work can resume in a later session.

- **Baseline:** `d47f95f` on `claude/blissful-lamport-2l4o96`. Its tree matches `master` at `9036e5e` and contains the security fixes and the opening briefing. The working tree was clean at the start.
- **Authorized:** U1–U12, D1–D6 and F1–F6.
- **Deferred:** P1–P6, not implemented.
- **Changes stay uncommitted** until separately authorized.

**Status values:**

| Value | Meaning |
| --- | --- |
| pending | Not yet started |
| in progress | Being worked on |
| done | Implemented and verified at the level stated in the table |
| partial | Only part implemented; the rest is listed under limitations |
| already resolved | Nothing needed; the table gives the reason |
| blocked | Cannot proceed; the table gives the reason |

**Evidence levels:**

| Level | Meaning |
| --- | --- |
| unit | Rust or TypeScript unit test, or a harness check |
| build | `npm run build` and/or `cargo test` passes |
| mock | Browser run against the synthetic IPC mock |
| native | The desktop app itself — not available in this environment |

## Plan

1. **Foundation**
   - project-scan state model
   - session view-state store
   - navigation events
   - shortcut registry
   - modal primitive and the Preferences dialog
   - error boundaries
   - tokens and focus ring
   - `formatWhen`
   - Restart moved to Preferences
2. **Surface work**
   - Command and voice
   - Projects and delegation
   - Research
   - Communications
3. **Integration**
   - build and tests
   - mock checks at four viewports
   - documentation
   - final status

## Foundation (done)

Built on `d47f95f`, uncommitted. Surface agents build on these APIs rather than
adding parallel ones.

### Project scan state — `src/hooks/useDashboardData.ts`

`useDashboardData()` now also returns:

- `projectScan: ProjectScanState` — `{ status: "loading" | "ready" | "stale" | "failed"; lastSuccessAt: string | null; error: string | null; scanning: boolean }`.
  - Desktop starts `loading` with `projects: []`. First failure → `failed`, `projects: []`. A later failure → `stale`, keeping the last genuine projects. Success with none → `ready`, `[]`.
- `demoData: boolean` — true only in the browser preview (no Tauri). There, the seed projects and conversation remain and `projectScan` is `ready` with `lastSuccessAt: null`; no scan is attempted.
- `rescanProjects()` — for Retry buttons.
- `projectsError` — kept, same value as `projectScan.error`.
- `refreshAll()` — refreshes projects, tasks, runs, Pantheon, vault graph and vault writes (settled in parallel) and calls every `subscribeToRefresh` listener.

Seed data: `src/data/seed.ts` exports `desktopInitialState` (seed settings, tools and quick apps; no projects, no conversation) and `isSeedMessage()`. `src/services/storage.ts` exports `initialDashboardState()`. Desktop hydration drops only messages that exactly match the seed fixture; stored history is otherwise untouched. A localStorage import on desktop drops the seed fixtures and stored projects.

Freshness: `PollingStore<T>` has `lastSuccessAt` (ISO). `useActionQueue()`, `usePantheon()`, `useVaultGraph()` and `useDelegationRuns()` return it. It does not trigger a re-render by itself; a freshness line re-renders on its own clock. Module-level refreshers: `refreshActionQueue`, `refreshDelegationRuns`, `refreshPantheon`, `refreshVaultGraph`, `refreshVaultWrites`.

### Session view state — `src/state/viewState.ts`

In memory only (never localStorage/sessionStorage). Hooks: `useViewSlice(key)` → `[value, set]`; `useViewEntry(key, id, fallback)` → `[entry, set]`, where `set(null)` discards the entry. Non-hook: `readViewSlice`, `writeViewSlice`, `writeViewEntry`, `subscribeViewSlice`, `resetViewState` (harnesses), `projectHasOpenWork(projectId)`.

| Slice | Shape |
| --- | --- |
| `project` | `{ detailProjectId: string \| null; boardScrollTop: number; detailScrollTop: number }` |
| `projectDrafts` | `Record<projectId, { task: string; criteria: string[] }>` — `EMPTY_PROJECT_DRAFT` |
| `reviewNotes` | `Record<runId, { notes: string[]; evidence: string[]; reviewed: boolean; workspaceHash?: string; projectId?: string }>` — `EMPTY_REVIEW_NOTES` |
| `research` | `{ view: "grouped" \| "recent" \| "all"; query: string; section: string \| null; detailEntryId: string \| null; listScrollTop: number }` |
| `comms` | `Record<accountId, { situationId; workstreamId; actorId; tab; drafts: Record<draftId, { subject; body; situationId?; messageId? }> }>` — `EMPTY_COMMS_ACCOUNT` |
| `navigation` | `{ research: ResearchEntryTarget & {revision} \| null; communications: CommunicationsSituationTarget & {revision} \| null }` |

App wiring: Project mode's open project is `project.detailProjectId` (was App state). Leaving Project mode clears it unless `projectHasOpenWork()` — a non-empty `projectDrafts[id]` or a `reviewNotes` entry with `projectId === id` that has notes, evidence or `reviewed`. Set `projectId` on review notes for this to work.

### Navigation events — `src/services/navigation.ts`

`openResearchEntry({ sourceFile, excerpt?, fingerprint? })`, `openCommunicationsSituation({ accountId?, situationId })`, `openProject(projectId)`. App subscribes (`subscribeToNavigation`) and switches mode; project detail is set directly. Research and Communications targets are parked in the `navigation` slice. The destination reads `const [target, consume] = useNavigationTarget("research" | "communications")`, acts on it, then calls `consume(target.revision)`.

Refresh bus: `subscribeToRefresh(listener)` / `emitRefreshRequested()`. Communications should subscribe its mail and situation polls, then extend `SHORTCUTS.refresh.label`.

### Shortcuts — `src/services/shortcuts.ts`

`SHORTCUTS` (by id: `console`, `cycleMode`, `microphone`, `refresh`, `escape`, `librarySearch`), each `{ id, keys, label, scope, description, matches(event) }`; `SHORTCUT_LIST` is the popover order. Helpers: `isModalOpen()`, `anotherModalIsOpen(own)`, `isEditableTarget(target)`.

- Ctrl/Cmd+K → console, one owner (ChatPanel). LibraryPanel's binding was removed.
- `/` → library search in Research, ignored in editable fields, with modifiers, or under another modal.
- Ctrl/Cmd+R → always `preventDefault` (including while typing); refreshes unless a modal is open. Label: "Refresh projects, tasks, runs, library and vault".
- Ctrl/Cmd+\\ → cycles all four modes; ignored while typing or under a modal.
- Ctrl/Cmd+Shift+M → microphone (ChatPanel).

AmbientDock's popover renders from `SHORTCUT_LIST`. Any new shortcut goes into the registry, and its handler uses `matches` and bails on `isModalOpen()`.

### Dialog primitive — `src/components/Modal.tsx`

`<Modal open onClose title labelledBy? description? role?="dialog"|"alertdialog" placement?="center"|"below-header" dismissOnBackdrop? initialFocus? showTitle? className?>`. It provides role and aria-modal, a label, focus in on open, a Tab trap, Escape (capture phase, stopped, topmost modal only), focus restore on close or unmount, and a portal to body. z-index 8000, below the write gate (9000). WriteConfirmDialog was deliberately not refactored.

### Preferences — `src/components/panels/PreferencesDialog.tsx`

Opened by AmbientDock (`preferencesOpen` state in App, as before). Order:

1. Replies & briefing — `ReplyModeToggle` (`src/components/panels/ReplyModeToggle.tsx`, shared with the console, same Text/Voice wording) and Opening Briefing.
2. Voice — `VoiceSettings` with `replyControls={false}`; the voice lab is behind a disclosure.
3. Gmail — polls every 2 s only while expanded; one read on mount.
4. Model diagnostics.
5. Restart Olympus — a confirmation step that lists observed live work (reply in progress, voice session, delegated runs in running phases). Removed from the Pantheon strip.

### Error boundaries — `src/components/ErrorBoundary.tsx`

`<ErrorBoundary label>` has a contained fallback with "Reload view" (remounts children) and a Technical detail disclosure. App wraps each region separately: header, tool rail, agent catalog, Command view, Communications, Research, Project, Pantheon strip, console and status dock. `WriteConfirmDialog` is outside all of them. No root boundary around App.

### Tokens and time

- `:root` gains `--space-10`, `--space-14`, `--secondary` (#c3ccd8), `--text`, `--text-micro` (10px, tracked numerals only), `--leading-tight`, `--leading-body`, `--focus-ring` (#efbd7a), `--focus-ring-width`, `--focus-ring-offset`.
- `--label` is now #7f93ad. Measured over the base navy and over the photograph's bright p90 rgb(75,72,71):
  - dense: 6.10 / 5.94
  - panel: 6.04 / 5.49
  - chrome: 6.06 / 4.54
  - For comparison, #7d8ba1 would still fail chrome at 4.13.
- A global `:focus-visible` rule draws the focus ring. The eleven plain ad-hoc outline colours now use the token.
- `node scripts/test-css-tokens.mjs` fails on an undefined `var(--x)` with no fallback.
- `src/services/time.ts`:
  - `formatWhen(value, { relative?, withDate?, now? })` returns strings such as "2 h ago · 09:55", "Yesterday 14:10", "Fri Sep 25, 09:03", "in 5 min · 12:00", "Tomorrow 09:00" and "Unknown time".
  - Also exports `dayLabel(value, now?)`, `isSameDay`, `clockTime`, `toDate`.
  - Tested by `node scripts/test-time.mjs`.

## Surface passes (merged)

| Surface | Branch commits | Merge | Verification reported by the pass |
| --- | --- | --- | --- |
| Foundation | `d920883` | direct | build; 10 scripts; 8 harnesses; mock checks for scan failure, Preferences, shortcuts, Ctrl+R, error boundary |
| Projects & delegation | `8f2fc27`, `06db61e` | `d2aedf4` | build; `cargo test` 385 passed; `test-project-board.mjs` (44 board + 18 review checks); project-board harness 24; mock 60/60 at 1440, board and scan subset at 1280/1920/2560 |
| Communications | `e50f851`, `4f4090e`, `6dc4f98` | `605388f` | build; `cargo test` 386; scripts including a new navigator test (15); situations 30/76/76; communications 60/60; gmail 27; relationship dossier 72; viewport matrix at 8 sizes; 25/25 app flows on the mock |
| Command & voice | `8658bcd`, `c3683e0`, `4984ae1`, `7284274`, `0e58baa` | `9d8fdf9` (conflicts in `ChatPanel.tsx` and `App.tsx` resolved by keeping both sides) | build; `cargo test` 389; 11 scripts including `test-command-voice.mjs` (14); console, typed-voice, voice, voice-settings, command-agent, project-ring harnesses; mock 200/208 (the only remaining failures are the Tab-count target — see U9); WebGL-off at four sizes |
| Research | `087cb7a`, `c2fab5d`, `3ec35f7` | `a3925ea` | build; `cargo test` 387; `test-library.mjs` (12); research-verification 29; knowledge-audit pass; workflow-inspection 23; mock 60 checks at each of four sizes (search re-run after an expectation fix) |

After all four merges: `npm run build` passes, every `scripts/test-*.mjs` passes, and `cargo test --lib` gives 398 passed, 0 failed, 11 ignored.

## Integration QA (merged tree)

A combined synthetic IPC mock covering all four surfaces ran 416 checks across 1280×800, 1440×900, 1920×1080 and 2560×1440. 412 passed. The four failures are one per viewport: the Tab count to the console (21–22 against a target of 15; see U9).

| Area checked | Result |
| --- | --- |
| Scan-state agreement across ring, header, board and briefing; no seed content | 22 per viewport, all pass |
| Voice 429 | 7 per viewport, all pass |
| Text-mode briefing, including only the newest briefing in history | 7 per viewport, all pass |
| Evidence paths | 10 per viewport, all pass |
| Four-mode continuity with work in progress | 10 per viewport, all pass |
| Keyboard | 29 of 30 per viewport |
| Restart, error boundary, write gate above Preferences | 3 per viewport, all pass |
| WebGL off; no 3D chunk on a Research launch | 3 per viewport, all pass |
| Reduced motion and long content | 6 per viewport, all pass |
| Console control row on one line | 6 per viewport, all pass |

At 2560, SwiftShader starves animation frames, so forced clicks and a WebGL-off browser were used for some captures.

**Defects fixed in QA:**

| Commit | Fix |
| --- | --- |
| `831dbb9` | F2: attention observation in the opening briefing |
| `66c4864` | NO PROJECTS readout on a genuine empty scan |
| `4a3e7fb` | Shortcut popover closes on Escape or an outside press |
| `62084f1` | Console control row fits on one line at 1280 |
| `677ab95` | Preferences follows the type scale |
| `c4a07b8` | Two harnesses updated for the redesigned inspector and the long fixture |

**Found, not fixed:**
- **Tab count:** reaching the target would need roving focus in the catalog and mode switcher, which is a design change.
- **Communications below 1500px with the console engaged:** the view shrinks to about 370px. This is a layout-contract decision (SITUATION-MAP-POLISH).
- **"Ask Olympus about this thread":** the operator's bubble shows the raw thread-reference text. Separating displayed text from sent text touches the Rust marker contract.

**Final test counts:**
- `npm run build` passes.
- 15 of 15 node scripts pass.
- `cargo test --lib` gives 398 passed, 0 failed, 11 ignored.
- Browser harnesses: 17 of 19 pages pass.
  - `communications?errors&long` is a visual fixture with no checks; it renders without errors.
  - `hybrid-core` fails its SwiftShader voice-timing check, as it did on the baseline.

## Items

The evidence recorded here is unit, build and mock only. Every item still needs desktop acceptance — see "Native checks".

| ID | Summary | Status | Main files | Verification | Limitations |
| --- | --- | --- | --- | --- | --- |
| U1 | Seed projects shown as real; scan state | done | `useDashboardData.ts`, `storage.ts`, `seed.ts`, `CommandInstrument.tsx`, `ProjectRing.tsx`, `HeaderBar.tsx`, `ProjectsPanel.tsx` | mock (loading, failed, stale and empty across ring, header and board; no seed names on desktop); unit (board states) | Browser preview keeps the labelled demo seed by design. |
| U2 | Voice failure alarms the instrument | done | `App.tsx` (`instrumentState`), `realtimeVoice.ts`, `voiceFailure.ts`, `ChatPanel.tsx`, `voice.rs` | mock (429: core idle, readable row, Retry audio / Switch to Text / Dismiss; red only on a request failure); unit | Real WebView2 autoplay and a real 429 are native checks. |
| U3 | Operator work lost to refresh and navigation | done | `viewState.ts`, `DelegationReview.tsx`, `DelegationPanel.tsx`, `delegationReview.ts`, Library files, `SituationsWorkspace.tsx`, `recipients.ts` | unit (notes survive refresh; hash change clears selections and acknowledgement, keeps notes); mock (drafts, detail, query, entry, situation, reply draft survive mode switches; close prompts) | Session memory only. Drafts are lost on app restart by design; no durable store for sensitive text. |
| U4 | Restart beside Refresh | done | `PreferencesDialog.tsx`, `LibraryPanel.tsx` | mock | Native restart not exercised. |
| U5 | Claim-to-evidence path | done | `ChatPanel.tsx` (Open in library), `library/*` (destination, `excerptHighlight.ts`), `pantheon.rs` (fingerprints), `ResearchVerification.tsx`, `KnowledgeAudit.tsx`, `SituationSourceReview.tsx`, `communications.ts` | unit (fingerprint equals retrieval's value; changed and unchanged cases); mock (Unchanged / Changed / No longer in library; citations; Review source three blocks; thread as attached context) | The Gmail thread marker is still stored in chat history, under a "Gmail thread reference" heading, because the backend reads it from the message. |
| U6 | Typed replies with Voice on | done | `voice.rs` (`VisualStream`), `responses.rs`, `assistant.rs`, `useDashboardData.ts`, `ChatPanel.tsx` | unit (escapes, surrogates, every chunk size 1–9, decoys, either field order); unit (request bytes read off a local socket list `visualResponse` first); mock (text about 0.9 s after send) | The OpenAI request now lists `visualResponse` first (`responses::VisualFirst` reorders only that object in the sent bytes; `preserve_order` stays off; stored answers unchanged). Schema-order generation is provider behaviour, not a guarantee; the Claude route follows the prompt example only. Not yet observed against the live provider. |
| U7 | Research inspectors and reading position | done | `LibraryPanel.tsx`, `library/LibraryBrowser.tsx`, `library/EntryDetail.tsx` | mock (segments; brief starts 267px down at 1280; open/back restores scroll and focus; header clean at four sizes) | — |
| U8 | Communications at laptop widths | done | `SituationsWorkspace.tsx`, `NextStepStrip`, `DocumentSituationMap.tsx`, `SituationRelationshipWeb.tsx`, `situationGraph.ts`, `mapTypography.ts`, `situations.css` | unit (map typography 10); mock (next step visible on arrival at 1280/1440; map text ≥12px at four sizes; no overlay interception) | Review source's full-thread block sits below the fold in the narrow inspector. |
| U9 | Keyboard model and Preferences dialog | done | `shortcuts.ts`, `Modal.tsx`, `PreferencesDialog.tsx`, `AmbientDock.tsx`, `ProjectRing.tsx`, `ChatPanel.tsx`, `LibraryPanel.tsx` | mock (dialog behaviour; popover text; Ctrl+K; `/`; roving ring; skip links) | Tab walk to the console in Command is 21–22, down from 67–69. The review's ≤15 was a starting point; the remaining stops are real controls (mode switcher, quick apps, catalog). |
| U10 | Opening briefing in Text mode and labels | done | `ChatPanel.tsx`, `conversationHistory.ts`, `assistant.ts`, `useDashboardData.ts` | unit; mock (BRIEFING READY; label; "Not spoken (Text replies)"; only the newest briefing in history) | — |
| U11 | Delegation plan, blockers, approval legibility | done | `DelegationPanel.tsx`, `DelegationReview.tsx`, `delegation.rs`, `delegation_review.rs` | unit (read-only plan read writes nothing; `permitted` built from launch constants); mock (plan readable without a proposal; blocker reasons; definition list; countdown; completion checklist) | Needs desktop checks: real `permitted` and `baseBranch` output, and approve/stop against the real backend. |
| U12 | Gmail recovery; data-reducing actions | done | `gmail/store.rs`, `gmail/mod.rs` (`gmail_cache_counts`), `situations.rs`, `gmail.ts`, `Communications.tsx`, `GmailSettings.tsx` | unit (counts); mock (four error states; real next-attempt times from the backend; counts dialog; narrowing prompt) | Real-account behaviour is a desktop check. |
| D1 | Type scale and size floor | done | tokens in `styles.css`; `projects.css`, `command.css`, `communications.css`, `situations.css`, `library/library.css` | mock measurements per surface | A few 10–11px mono badges remain in Communications' Browse email. The one-off colour audit is not exhaustive. |
| D2 | Tokens, contrast, focus ring | done | `styles.css`, component CSS, `scripts/test-css-tokens.mjs` | unit (0 undefined tokens); measured `--label` contrast ≥4.54 on all tiers | Colour consolidation was opportunistic, not complete. |
| D3 | Implementation details and dates in ordinary views | done | `time.ts`, `commsTime.ts`, `researchLabels.ts`, per-surface components | unit (time 25 checks); mock | Identifiers remain available inside Inspect and Internals disclosures by design. |
| D4 | Workflow Inspection layout for inspectors | done | `ResearchVerification.tsx`, `KnowledgeAudit.tsx`, `library/InspectorParts.tsx`, `ModelSettings.tsx` (diagnostics table), `WorkflowInspection.tsx` | harnesses (research-verification 29, workflow-inspection 23, knowledge-audit pass) | — |
| D5 | Project board repetition | done | `ProjectsPanel.tsx`, `projectCommandBoard.ts`, `projects.css` | mock (first row y=292 at 1440×900, y=346 at 1280×800) | Sort control wraps onto its own line at 1280. |
| D6 | Precise state names | done | `ChatPanel.tsx`, `CommandInstrument.tsx`, `ProjectsPanel.tsx`, `DelegationPanel.tsx` | mock; unit (ARCHIVED display mapping) | — |
| F1 | Source-specific freshness | done | `ProjectsPanel.tsx`, `Communications.tsx`, `situations.rs` (`understanding` last run), stores' `lastSuccessAt` | mock | — |
| F2 | Attention field | done | `projectBriefing.ts`, `ProjectsPanel.tsx`, `openingBriefing.ts` | unit (observations never change status or owner; `test-opening-briefing.mjs` 21 checks); mock (briefing observation sentence) | At most one attention sentence in the briefing; the rest stay on the board. |
| F3 | Research search, lists, capture | done | `library/libraryModel.ts`, `pantheonRecord.ts`, `pantheon.rs`, `AddEntryDialog.tsx`, `entryMarkdown.tsx` | unit (search tiers, dirty fields, source types, wikilinks); mock | No Tauri drag-and-drop. Attachments open through `open_vault_note` (Obsidian), limited to `_attachments`. |
| F4 | Situation navigator scale | done | `situationNavigator.ts`, `SituationsWorkspace.tsx` | unit (navigator 15); mock | Email-only situations show "Not assessed", because the policy reads saved document context only. |
| F5 | Hidden work, WebGL fallback, deferred init | done | `CommandInstrument.tsx`, `HybridCommandCore.tsx`, `hybridScene.ts`, `useSituationSnapshot.ts`, `situations.rs` (revision), Library model and paging | mock (WebGL-off SVG at four sizes; no 3D chunk when opening in Research; snapshot unchanged skip); measured (Research typing at 3,000 entries: long tasks 1.3–2.0 s → 0.13–0.36 s, dev build on SwiftShader) | No GPU claims. Real-GPU profiling is a native check. |
| F6 | Links, Ctrl+R, error boundaries, seed chat, transcript dates, Replay | done | `externalLink.ts`, `ChatPanel.tsx`, `shortcuts.ts`, `ErrorBoundary.tsx`, `persistence.rs` (`at`), `useDashboardData.ts` | unit; mock | Rows imported from localStorage carry their import time as their date. |

## Native checks (not available in this environment)

- WebView2: opening-briefing autoplay, and a real voice 429.
- Streaming latency on real Sol and Claude voice turns.
- `open_external_link` and `open_vault_note` round trips.
- Restart from Preferences.
- Job Object and process behaviour, unchanged from earlier work.
- The Command scene on a real GPU: deferral, SVG fallback, and pausing when hidden.
- Transcript dates on real SQLite rows.
- Gmail error states, counts and revoke with a real account.
- Delegation `permitted` text and `baseBranch` against real runs; approve and stop.
- Visual review by the operator at their normal window size.
