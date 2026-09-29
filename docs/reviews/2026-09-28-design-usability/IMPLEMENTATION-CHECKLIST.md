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
- ~~**"Ask Olympus about this thread":** the operator's bubble shows the raw thread-reference text.~~ Fixed in the follow-up below.

**Final test counts:**
- `npm run build` passes.
- 15 of 15 node scripts pass.
- `cargo test --lib` gives 398 passed, 0 failed, 11 ignored.
- Browser harnesses: 17 of 19 pages pass.
  - `communications?errors&long` is a visual fixture with no checks; it renders without errors.
  - `hybrid-core` fails its SwiftShader voice-timing check, as it did on the baseline.

## Items (reconciled 2026-09-29)

**Columns:**

| Column | Meaning |
| --- | --- |
| **Impl** | Code complete |
| **Browser** | Verified in Chromium against the synthetic IPC mock, plus unit tests. This is not desktop evidence. |
| **Desktop** | Verified in the Tauri app. Nothing has been verified there yet; see `DESKTOP-ACCEPTANCE.md`. |

**Status values:**

| Value | Meaning |
| --- | --- |
| done | Complete and verified at the stated level |
| partial | An acceptance requirement is still unmet or unverifiable in this environment |

All browser results below are from the final run on `cc0f182`:

| Suite | Result |
| --- | --- |
| Integration checks | 103 of 104 at each of 1280×800, 1440×900, 1920×1080 and 2560×1440 |
| Harnesses | 17 of 17 |
| Attachment checks | 32 of 32 at 1280 and 1440 |
| Skip-link probe | Passes |

| ID | Summary | Status | Impl | Browser | Desktop | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| U1 | Truthful project-scan state | done | ✓ | ✓ | — | Browser preview keeps the labelled demo seed by design. |
| U2 | Voice failure kept out of the instrument | done | ✓ | ✓ | — | A real 429 and WebView2 autoplay are desktop checks (D3, D4). |
| U3 | Operator work survives refresh and navigation | done | ✓ | ✓ | — | Regression fixes M1 (kept Add Entry draft), M2 (comms state purged with the cache) and L1 (untouched prefill and ended runs don't pin a project) applied 2026-09-29. Session memory only. |
| U4 | Restart moved to Preferences with confirmation | done | ✓ | ✓ | — | Real restart is desktop check A11. |
| U5 | Claim-to-evidence path | done | ✓ | ✓ | — | 2026-09-29: the chat bubble shows the operator's words plus an "Attached: …" chip with Inspect. The backend still receives the thread marker, so the resolver is unchanged. Persisted in the additive `conversation_turn_context` table. |
| U6 | Typed replies stream with Voice on | **partial** | ✓ | ✓ (mock stream) | — | 2026-09-29: the OpenAI request bytes now list `visualResponse` first (`responses.rs` `wire_body`/`VisualFirst`), pinned by unit tests including one that reads the request off a socket. No global serialization, fingerprint or persisted-contract change. **Unmet:** providers usually generate strict-schema properties in schema order, but this is not documented; the Claude route relies on the prompt example only; no live provider test (desktop D1, D2). |
| U7 | Research inspectors and reading position | done | ✓ | ✓ | — | — |
| U8 | Communications at laptop widths | **partial** | ✓ | ✓ | — | The full-thread block of Review source is below the fold in the narrow inspector. **Unresolved limitation:** with the console engaged below 1500px wide the view shrinks to about 370px; needs a layout decision and fix (not accepted). |
| U9 | Keyboard model and Preferences dialog | done against the revised criterion | ✓ | ✓ | — | 2026-09-29 revision (operator instruction): a visible, keyboard-accessible Skip to console path, with no controls removed. Met: it is the first Tab stop in all four modes, 13px with a focus ring, and Enter focuses the console. The review's original ≤15 Tab target is **not met**: Command 22, Project 36, Research 54, Communications 41. Every remaining stop is a real control. The integration check still records that target as its one failure. |
| U10 | Opening briefing in Text mode and labels | done | ✓ | ✓ | — | — |
| U11 | Delegation plan, blockers, approval legibility | done | ✓ | ✓ | — | 2026-09-29 fixes: L2 names the base branch only when HEAD is the base commit and never falls back to the project branch; L3 drops the cached resume approval when its run leaves `waiting`; L5 caches the review time. Real runs are desktop group E. |
| U12 | Gmail recovery; data-reducing actions | done | ✓ | ✓ | — | L4 (2026-09-29): backoff is reported only for the account that failed. Real account is desktop check D6. |
| D1 | Type scale and size floor | done | ✓ | ✓ | — | A few 10–11px mono badges remain in Browse email. |
| D2 | Tokens, contrast, focus ring | done | ✓ | ✓ | — | Colour consolidation was opportunistic. |
| D3 | Human labels and dates | done | ✓ | ✓ | — | — |
| D4 | Workflow Inspection layout for inspectors | done | ✓ | ✓ | — | — |
| D5 | Project board repetition | done | ✓ | ✓ | — | The Sort control wraps at 1280. |
| D6 | Precise state names | done | ✓ | ✓ | — | — |
| F1 | Source-specific freshness | done | ✓ | ✓ | — | — |
| F2 | Attention field and briefing sentence | done | ✓ | ✓ | — | The harness clock was pinned 2026-09-29, after a real-clock dependency failed a day later. |
| F3 | Research search, lists, capture | done | ✓ | ✓ | — | No Tauri drag-and-drop. |
| F4 | Situation navigator scale | done | ✓ | ✓ | — | Email-only situations show "Not assessed". |
| F5 | Hidden work, WebGL fallback, deferred init | done | ✓ | ✓ | — | No GPU claims; desktop check A12. |
| F6 | Links, Ctrl+R, error boundaries, seed chat, dates, Replay | done | ✓ | ✓ | — | 2026-09-29: the Ctrl/Cmd+R reload block moved to a capture listener in `main.tsx`, outside every error boundary. Imported-date defect fixed 2026-09-29: rows imported from localStorage now read "Imported … · original time HH:MM" (see Fixed after the readiness pass). |

## Release-readiness pass (2026-09-29)

**Changes merged:**

| Merge | Change |
| --- | --- |
| `3cec120` → `8d81a0e` | U6 visual-first request order |
| `8d81a0e` | Opening-briefing harness clock pinned |
| `4033d42` | Regression-review fixes M1, M2, L1–L5, and the Ctrl+R reload guard |
| `cc0f182` | Skip to console in every mode; attached-context chips |
| `f524120` | `DESKTOP-ACCEPTANCE.md` |

**Regression review of `d47f95f..056e91f`:**
- No Critical or High findings.
- **Approval binding:** `approvals.rs` is unchanged. The only new command is `gmail_cache_counts`. `permitted`, `baseBranch` and `reviewedAt` are output-only.
- **Account isolation:** new queries are filtered by account.
- **Earlier security fixes intact:** the CSP is unchanged; no raw HTML, `rehype-raw` or `gray-matter`; the write gate sits outside every boundary; attachment tokens, the `write_memory_artifact` enum, `vault_write` and delegation containment are unchanged.

**Hybrid-core baseline:** `hybrid-core-harness` "Voice signature follows changing speech energy" failed in every run on all three commits:

| Commit | Failed runs |
| --- | --- |
| `e4669c9` (0.19.0) | 3 of 3 |
| `d47f95f` (pre-design-review) | 5 of 5 |
| `056e91f` (final) | 5 of 5 |

- Every run used the same flags and a 1440×900 viewport, and 53 checks passed before the failure each time.
- The cause is the environment: SwiftShader renders about one frame every three seconds at a 1457px canvas, and the check needs frames to move a smoothed energy value.
- It is **pre-existing** and is excluded from the harness count above rather than counted as passing.
- It needs a GPU browser run; see `DESKTOP-ACCEPTANCE.md`.

**Test counts on the final tree:**
- `npm run build` passes.
- 16 of 16 node scripts pass.
- `cargo test --lib` gives 405 passed, 0 failed, 11 ignored.

**Accepted deviations** (recorded on operator instruction):
- **U9:** the ≤15 Tab target is replaced by the Skip to console criterion. This follows the operator's 2026-09-29 instruction not to optimize Tab counts by making controls inaccessible.
- **Session-only drafts:** drafts are held in session memory only, by design. Durable storage of sensitive draft text was not authorized.

**Unresolved** (not accepted; corrected 2026-09-29):
- **U6 — partial.** The visual-first request order is implemented and unit-tested. Live-provider evidence that written text streams before the spoken summary is absent, so it stays partial until desktop checks D1 and D2 establish the behaviour.
- **U8 — narrow Communications layout.** Below 1500px wide, with the console engaged, the map and inspector shrink to about 370px and leave empty space. This is an unresolved limitation, not an operator-accepted deviation. It needs a layout decision (SITUATION-MAP-POLISH contract) and a fix.
- **Desktop acceptance:** not started. The isolated profile and fixture scripts it needs are implemented; see `DESKTOP-ACCEPTANCE.md` section 2. 2026-09-29: two isolation defects found in the profile guard at `f073af6` (do not launch that revision) and fixed in the following commits; N1–N17 are still untested on Windows. See `NATIVE-ACCEPTANCE-2026-09-29.md`.
- **`cargo fmt --check`:** already failed on untouched files before this work.

**Fixed after the readiness pass (2026-09-29):**
- **Imported message dates.**
  - **Was:** rows imported from browser `localStorage` on first desktop launch took the import moment as their `created_at`, and the transcript showed it as the message date.
  - **Now:** the one-time import calls `append_conversation_messages` with `imported: true`. The rows it inserts are recorded in the additive `conversation_imports` table, in the same transaction, and a row already stored is never relabelled. `load_persisted_state` returns `importedAt` and no `at` for them. The transcript reads "Imported {formatWhen(importedAt)} · original time HH:MM", or "original time unknown". Such rows neither open nor break a day separator. The first session after the import shows them the same way.
  - **Limitation:** rows imported before this change carry no marker and still show the import moment as their date.
  - **Evidence:** Rust unit test `imported_rows_carry_their_import_time_instead_of_a_message_date`; `commandVoice` harness checks for the label and separators; `npm run build`. Also an `#[ignore]`d load of a database seeded by `scripts/acceptance/seed-db.mjs`. **Not seen in the desktop app:** that is N17 in `DESKTOP-ACCEPTANCE.md`.

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
