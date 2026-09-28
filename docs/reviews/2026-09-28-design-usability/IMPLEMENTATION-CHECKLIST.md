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

### Left for surface agents

- **Command:**
  - U1 ring readout ("Scanning projects…", "Project scan failed · Retry") from `projectScan`, and header next-step blanking. Pass `projectScan`/`rescanProjects` down from App.
  - U2, U6, U10.
  - Ring roving tabindex and "Skip to console".
  - F6: chat links, transcript ISO time and day separators via `dayLabel`, Replay visibility.
  - Chat "Open in library" via `openResearchEntry`.
- **Projects:**
  - U1 board skeleton and banner.
  - F1 freshness line from `projectScan.lastSuccessAt` and the stores' `lastSuccessAt`.
  - U3: DelegationPanel draft into `projectDrafts`; DelegationReview into `reviewNotes`, with `projectId` set; board and detail scroll.
  - D5, U11, and `formatWhen` for commit dates.
- **Research:**
  - LibraryPanel state into the `research` slice.
  - Consume `useNavigationTarget("research")`.
  - U7, F3.
  - Button sizes (D1).
- **Communications:**
  - Its state into the `comms` slice; consume `useNavigationTarget("communications")`.
  - `subscribeToRefresh` and extend the Ctrl+R label.
  - U8, U12, F4, "Close draft" Save/Discard.

## Items

| ID | Summary | Status | Files | Verification | Limitations |
| --- | --- | --- | --- | --- | --- |
| U1 | Seed projects shown as real; scan state | partial | `src/hooks/useDashboardData.ts`, `src/services/storage.ts`, `src/data/seed.ts` | build; mock (`scanFails`: no seed name in Project or on the ring; scan OK renders mock projects; browser demo keeps labelled seed) | Data layer only. Ring readout, board banner, Retry and header blanking are surface work (Command, Projects). |
| U2 | Voice failure alarms the instrument | pending | | | |
| U3 | Operator work lost to refresh and navigation | partial | `src/state/viewState.ts`, `src/App.tsx` | build; mock (Project detail cleared on mode switch when no work is open) | Store and App-level project detail rule only. Panels must move their state into the slices; the "keep detail open" path is exercised once ProjectsPanel/DelegationReview write `projectDrafts`/`reviewNotes`. |
| U4 | Restart beside Refresh | done | `src/components/panels/PreferencesDialog.tsx`, `src/components/panels/LibraryPanel.tsx` | build; mock (no restart control on the strip; Restart asks for confirmation) | Confirmation names drafts generically; live reply, voice and running delegated runs are listed only when observed. Native restart not exercised. |
| U5 | Claim-to-evidence path | pending | | | |
| U6 | Typed replies with Voice on | pending | | | |
| U7 | Research inspectors and reading position | pending | | | |
| U8 | Communications at laptop widths | pending | | | |
| U9 | Keyboard model and Preferences dialog | partial | `src/services/shortcuts.ts`, `src/components/Modal.tsx`, `src/components/panels/{AmbientDock,PreferencesDialog,ChatPanel,LibraryPanel}.tsx`, `src/styles.css` | build; mock (dialog role/label, focus in, Tab trapped, Escape closes, focus back to gear, Ctrl+\ suppressed, popover text, Ctrl+K → console in Research, `/` → search only outside fields) | Ring roving tabindex, "Skip to console" and the ≤15-Tab target are Command surface work. |
| U10 | Opening briefing in Text mode and labels | pending | | | |
| U11 | Delegation plan, blockers, approval legibility | pending | | | |
| U12 | Gmail recovery; data-reducing actions | pending | | | |
| D1 | Type scale and size floor | partial | `src/styles.css` `:root` | build | Tokens only (`--text-micro` … `--text-2xl`, `--leading-*`). Surfaces apply them. |
| D2 | Tokens, contrast, focus ring | partial | `src/styles.css`, `commandAgents.css`, `researchVerification.css`, `situations.css`, `scripts/test-css-tokens.mjs` | unit (`node scripts/test-css-tokens.mjs`: 0 undefined); mock (library search shows the ring) | One-off colour folding and a full contrast audit remain. Focus styles that replace the outline with a border/colour change were left as they are. |
| D3 | Implementation details and dates in ordinary views | partial | `src/services/time.ts`, `src/services/time.harness.ts`, `scripts/test-time.mjs` | unit (25 checks, three time zones) | `formatWhen`/`dayLabel` exist; no surface uses them yet. |
| D4 | Workflow Inspection layout for inspectors | pending | | | |
| D5 | Project board repetition | pending | | | |
| D6 | Precise state names | pending | | | |
| F1 | Source-specific freshness | partial | `src/hooks/createPollingStore.ts` and the store hooks | build | `lastSuccessAt` exposed; nothing renders it yet. Communications last-run time still needs backend exposure. |
| F2 | Attention field | pending | | | |
| F3 | Research search, lists, capture | pending | | | |
| F4 | Situation navigator scale | pending | | | |
| F5 | Hidden work, WebGL fallback, deferred init | pending | | | |
| F6 | Links, Ctrl+R, error boundaries, seed chat, transcript dates, Replay | partial | `src/components/ErrorBoundary.tsx`, `src/App.tsx`, `src/components/panels/AmbientDock.tsx`, `src/hooks/useDashboardData.ts`, `src/services/storage.ts` | build; mock (Ctrl+R while typing does not reload and refreshes projects, tasks, runs, library, graph, vault writes; forced Research render error shows the fallback with header and console still mounted) | Done here: Ctrl+R, boundaries, seed conversation. Left: chat links via `open_external_link`, transcript day separators, Replay visibility (Command surface). |
