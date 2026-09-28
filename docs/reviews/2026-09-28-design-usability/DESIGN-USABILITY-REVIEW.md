# Olympus — design, usability and functional review

Date: 2026-09-28. Independent review; recommendations only. No production code was changed.

## Scope, state and limitations

- **Code reviewed:** branch `claude/blissful-lamport-2l4o96` at `374112a`. Its tree is identical to `master` at `fa9073a` (PR #2). This is 0.19.0 plus the 2026-09-28 review fixes and the opening briefing. The working tree was clean before this review; the only files added are this report and `screenshots/`.
- **Earlier findings are not re-reported.** Where an earlier fix is now visible in the UI, it is noted under strengths.
- **Method:** the real `index.html` and the repository's harness pages ran in headless Chromium against a Vite dev server, plus one production `vite preview` build for timings. A synthetic Tauri IPC mock was injected at page load so the desktop code paths render with realistic data:
  - 8–25 projects, delegation runs in every phase, 60–3,000 research entries, 500-message transcripts;
  - Gmail situations from the repository fixtures;
  - a voice session that fails with a quota error.
- **Viewports:** 1280×800 (the app minimum), 1440×900, 1920×1080, 2560×1440, and a 960×1040 half-screen snap.
- **Motion:** checked with and without reduced motion.
- **Interaction:** keyboard walks and state-survival tests were scripted.

> **Inspection limits — read before acting.**
> - **Not seen:** the native desktop app, WebView2, a real GPU, audio, a microphone, the real vault, real mail, or any live provider.
> - **WebGL:** it ran on SwiftShader, so no frame-rate or GPU-cost claim here is representative. Motion-on captures were slow and some states were captured with reduced motion.
> - **Mock artifacts:** the IPC mock is synthetic. Where a mock gap produced an artifact (for example a stray voice-session error line), it was discarded.
> - **Evidence labels:** every recommendation carries *observed* (seen in a screenshot or measured in the browser), *code* (supported by source reading), or *hypothesis*.
> - **Needs the desktop app to confirm:** items marked **[native check]**.

Ten representative screenshots are in `screenshots/`. The full working set (about 300 captures, the mock and the scripts) is in the session scratchpad, which is temporary.

| Screenshot | Shows | Used in |
| --- | --- | --- |
| [01](screenshots/01-command-1440-populated.jpg) | Command at 1440×900, populated: the instrument composition at its best | Strengths, P2 |
| [02](screenshots/02-command-1280-voice-quota-failure.jpg) | Command at 1280×800 after a voice quota failure: red core, raw provider string | U2 |
| [03](screenshots/03-project-scan-failure-shows-seed.jpg) | Project board after a failed scan: seed projects shown as real, no error | U1 |
| [04a](screenshots/04a-review-notes-typed.jpg) → [04b](screenshots/04b-review-notes-wiped-after-check.jpg) | Delegation review before and after running a check: notes wiped; unstyled form | U3, U11 |
| [05](screenshots/05-research-disclosures-hide-library.jpg) | Research with both inspectors open: library gone; header overlap | U7 |
| [06](screenshots/06-comms-map-1280-small-text.jpg) | Communications at 1280: briefing below the fold, small map text | U8 |
| [07](screenshots/07-comms-1920-balanced.jpg) | Communications at 1920: the balanced target composition | Strengths, U8 |
| [08](screenshots/08-comms-review-source-no-findings.jpg) | "Review source" popover: "No candidate findings", covering the briefing | U5 |
| [09](screenshots/09-project-refresh-beside-restart.jpg) | Pantheon strip: Refresh beside Restart; oversized library buttons | U4, D1 |

Screenshots 06–08 come from the Communications harness page, which adds a fixture selector row of about 100px at the top. The findings account for it.

## Overall assessment

Olympus has a real identity. The omega instrument, the night-mountain photograph, Cinzel for the wordmark, mono tracking for labels and restrained amber accents read as one product. At 1440 and wider, Command holds the "one instrument, readable across the room" test (`screenshots/01`). Communications at 1920 is the best composed surface in the app (`screenshots/07`).

The product's strongest quality is epistemic honesty in its copy:
- "Rule-based suggestion · not approval"
- "Agent-reported outcome — unverified until review"
- "not a claim that every source supports its answer"
- "No open questions recorded… does not establish that everything is resolved"

That discipline is rare, and it is the thing to protect.

The weaknesses cluster in three places:

1. **The most glanceable surfaces can contradict that honesty.**
   - Before the first project scan, and indefinitely after a failed scan, the Command ring, the header next-step and the Project board show the built-in example projects as if they were the real portfolio (`screenshots/03`).
   - When the voice provider fails, which is the documented current state, the whole instrument turns red and stays red while text reasoning is healthy (`screenshots/02`).
2. **Checking why Olympus said something is harder than it should be.** Research sources in a chat reply cannot be opened. A situation's "Review source" opens the whole thread with the message "No candidate findings supplied" (`screenshots/08`). Verification evidence links do not open their excerpts.
3. **The operator's work is not safe from navigation.**
   - Running a delegation check wipes the review notes (`screenshots/04a`, `04b`).
   - Switching mode discards project detail, drafts, library search, the Communications selection and scroll position.
   - Unsent local reply drafts disappear without a prompt.

Beyond these, the design system has drifted:
- 36 font sizes;
- 61% of Project-mode text under 11px;
- 561 distinct hex colours;
- one undefined token that silently zeroes a card's padding.

Laptop-width layouts lose the primary answer below the fold in Communications, and in Research when both inspectors are open. None of this requires a redesign. Most of the highest-value fixes are small.

**Note on the opening briefing added this session:** the reviewers found two problems with it.
- With Voice replies on (the default) and credit exhausted, every launch now triggers a failed voice session, and that failure is what turns the instrument red (U2).
- With Text replies, the briefing is added silently and nothing shows that it exists (U10).

Both are addressed below.

## Strong choices to preserve

- **Honest state language:**
  - "Unknown" and "unreported (not zero)" are kept distinct from empty.
  - Stance defaults to `unevaluated`, and "Saving a source is not agreeing with it".
  - Document facts are labelled Documented, Reported or Unconfirmed.
  - Next steps carry "guidance, not a commitment".
- **Status is never colour-only on the board.** Every row carries text status, and NEEDS YOU adds a left rule (observed).
- **"Review with Olympus" attaches context and waits for Send.** It never acts on its own (observed).
- **The write gate:**
  - Keep is the default and focused, and Escape keeps the file.
  - Path, reason, line counts and a diff are shown.
  - A decline is reported plainly: "Kept your version… Nothing was overwritten" (observed).
- **Two-stage, backend-owned delegation approval with per-criterion evidence.** Check buttons say "runs agent code" (observed).
- **Console Text | Voice toggle kept separate from the microphone.**
  - The microphone state is spelled out: "Microphone on · audio sent to OpenAI · stop to end".
  - Playback receipts distinguish Played, interrupted, and "Audio unavailable · text preserved" (observed).
- **The opening briefing is deterministic and dry.** "Olympus is open. The project scan failed, so there is no project briefing yet." is the right tone (observed).
- **Workflow Inspection's layout is the best inspector idiom in the app:** key/value header, a real structure diagram with node states, and a selected-node panel (observed). Research Verification, Knowledge Audit and model diagnostics should adopt it.
- **The Communications briefing structure:** CURRENT STATE → NEEDS CONFIRMATION → USEFUL NEXT STEP, with a VERIFY label and a "Reason:" line (observed, `screenshots/07`).
- **Untrusted content renders inert.** Raw HTML in research notes and mail shows as text, and links route through the external-link command in Research (observed, confirming the earlier fix).
- **Tiered translucency tokens.** No prose sits on the bare photograph, and no text failed contrast on those surfaces (measured).
- **Reduced motion is honoured at several layers:** MotionConfig, 14 media queries, and travelling lights and transitions removed (measured).

---

## Recommendations

Each recommendation gives the surface, observation and evidence, operator impact, change (before → after), benefit and tradeoff, effort, confidence, and an acceptance check.

**Flags:**
- ⚑ **visual language:** changes the established visual language.
- ⚑ **layout contract:** changes a documented layout decision.
- ⚑ **autonomy:** touches the autonomy or memory model.

None is approved by being listed here.

### A. Usability defects

#### U1. The instrument and board show example projects as real before or instead of a scan
- **Surface:** Command ring, header next-step line, Project board.
- **Observation:**
  - With the scan rejected, the board lists Olympus "Latest commit: b02ed86 Initial Olympus dashboard build · 4/25/2026" and "Agentic AI Scaffolder", and the header shows a seed next step (observed, `screenshots/03`).
  - The ring labels the same seed projects before the first scan and after a failure (observed).
  - `projectsError` is returned by `useDashboardData` but never read by `App` (code, `App.tsx:31-51`, `useDashboardData.ts`).
  - Seed projects enter through `applyPersistedState` spreading `seedState` (code, `storage.ts:123-138`).
- **Impact:**
  - This breaks the manual's "Unknown state stays explicit" on the surfaces the operator trusts at a glance.
  - On every desktop launch the ring shows fiction until OneDrive and git return. After a failure it shows fiction indefinitely.
  - The opening briefing correctly says the scan failed while the ring beside it shows a portfolio.
- **Change:**
  - **Before:** seed names on the ring and board; no error anywhere except the one-time briefing.
  - **After:**
    - On desktop, `projects` starts empty. The ring draws an unlabelled rim with "Scanning projects…" in the readout, and the board shows a skeleton.
    - On failure: ring readout "Project scan failed · Retry"; board banner "Project scan failed 10:42 — {reason}. Showing nothing rather than stale data. [Retry]"; header next-step blank.
    - Seed data stays browser-only.
- **Benefit / tradeoff:** the glance becomes trustworthy. The instrument is briefly emptier at launch.
- **Effort:** S–M. Touches `storage.ts`, `useDashboardData`, `App`, `ProjectsPanel`, `CommandInstrument`, `HeaderBar`. `projectsScanned` and `projectsError` already exist.
- **Confidence:** observed plus code.
- **Acceptance:** with a rejected `scan_tracked_projects`, no seed name appears anywhere, the error is visible in Command and Project, and Retry rescans.

#### U2. A voice-provider failure turns Command red, sticks, and the opening briefing triggers it on every launch
- **Surface:** Command instrument core, console status line.
- **Observation:**
  - With `create_voice_session` returning 429, the Ω core renders red and the console shows the raw "OpenAI returned 429: insufficient_quota" with no Dismiss or Retry (observed, `screenshots/02`).
  - `voice.phase === "ERROR"` maps to the instrument's `error` visual state (code, `App.tsx` visualState mapping). `realtimeVoice.fail` keeps ERROR until the next voice start (code, `realtimeVoice.ts`).
  - Auto Speak defaults to on, so the opening briefing's replay hits this on each launch while credit is exhausted.
- **Impact:** the first impression on every launch is "something is broken", but reasoning, text and data are fine. The signal points at the wrong subsystem. `docs/AMBIENT-MOTION.md` says error states should not alarm.
- **Change:**
  - **Before:** red core plus a raw provider string.
  - **After:**
    - The core stays idle.
    - The console voice row reads "Audio unavailable — OpenAI quota exceeded. Replies stay in text. [Retry audio] [Dismiss]".
    - After two consecutive failures in a session, the opening briefing is not replayed, and the row offers "Switch replies to Text".
    - The instrument's `error` state is reserved for reasoning or request failures.
- **Benefit / tradeoff:** no false alarm, and a clear path back. Audio failure becomes quieter, so the console line must be clear.
- **Effort:** S.
- **Confidence:** observed plus code. [native check] for WebView2 autoplay under the new `--autoplay-policy` flag.
- **Acceptance:** with the voice session rejecting, `data-visual-state` stays `idle`, the message can be dismissed, and Retry calls `start` once.

#### U3. Navigation and refreshes destroy operator work
- **Surfaces:** Delegation review, Project detail, Library, Communications drafts.
- **Observation:**
  - **Delegation review:** after two notes were typed and "I reviewed" was ticked, running "Frontend build" cleared both notes and the checkbox (observed, `screenshots/04a` → `04b`). `refresh()` resets `notes`, `checkIds` and `reviewed` on every call (code, `DelegationReview.tsx:20-27`).
  - **Mode switches:** Project → Command → Project dropped an open project detail and an unsent run proposal, and reset board scroll from 900 to 0 (measured). Research search is cleared and Communications re-selects the first situation (measured). Only the console draft survives.
  - **Local reply drafts:** these are discarded when leaving Communications, and "Close draft" discards without a prompt (observed).
  - **Add Entry:** this closes without asking when only title and why-kept are filled (measured).
- **Impact:** the operator often glances at Command mid-task. The cost is retyping review evidence, proposals and replies, and an orphaned approval proposal left to expire.
- **Change:**
  - Review notes, evidence choices and the checkbox persist across `refresh()`. Only choices whose check went stale are reset.
  - A small per-mode view store in `App`: project detail id, draft task and criteria per project, library query, section and scroll, Communications situation, workstream and actor, and an unsent draft body.
  - "Close draft" with changes asks "Save / Discard".
  - Add Entry keeps its last unsent draft until it is saved or explicitly discarded.
- **Benefit / tradeoff:** no silent loss. This is a small change to the current "mode switch clears the project filter" rule. Keep clearing the filter unless a draft or review is open.
- **Effort:** S for the review notes; M for the view store.
- **Confidence:** observed plus code.
- **Acceptance:** type review notes, run a check, and the notes remain. Type a task, go to Command and back: the detail, draft and scroll are restored. Close a changed reply draft and a prompt appears.

#### U4. "Restart Olympus" sits beside "Refresh" with a mirror-image icon and no confirmation
- **Surface:** Pantheon strip, shown in Project and Research.
- **Observation:** ↻ Refresh entries and ↺ Restart Olympus desktop app sit adjacent, identically styled, with no confirmation (observed, `screenshots/09`; code, `LibraryPanel.tsx:470-490`; `lib.rs` `app.restart()`).
- **Impact:** one misclick stops in-flight replies and voice, denies a pending write-gate request, kills delegation processes through the Job Object, and loses unsent drafts.
- **Change:**
  - **Before:** ↻ ↺ side by side.
  - **After:** Restart moves to Preferences with a power icon and a confirmation that names what will be interrupted ("1 run in progress, 1 unsent draft").
- **Effort:** S. **Confidence:** observed plus code.
- **Acceptance:** no restart control on the strip; restart takes two deliberate actions.

#### U5. The path from a claim to its evidence is broken or missing in three places
- **Surfaces:** chat research disclosure, Communications "Review source", Research Verification evidence links.
- **Observation:**
  - **Chat:** "Research supplied to this reply" lists title, stance, path and excerpt as plain text with no interactive element (measured, 0 controls; code, `ChatPanel.tsx:344-352`).
  - **Communications:** "Review source" on a recommended move opens a fixed ~580×358px popover over the briefing that says "Olympus findings · selected message: No candidate findings supplied for this selection" (observed, `screenshots/08`). The situation path passes `candidates: []` (code, `SituationsWorkspace.tsx:30`, `Communications.tsx:111`). The quotes that support the move are in a different, collapsed overlay.
  - **Research Verification:** every citation reads "Saved source excerpt" and targets a closed `<details>` that does not open on click (measured).
- **Impact:** "check why Olympus said this" is the central thinking-partner workflow. Today it means retyping a title into library search (which does not search bodies) or reading a whole thread with nothing highlighted, and the UI says there are no findings when there are.
- **Change:** one "evidence link" behaviour used everywhere.
  - **Chat source:** "Open in library" switches to Research, opens the entry and highlights the excerpt window. If the stored fingerprint differs from the current file: "Changed since this reply".
  - **Communications:** "Review source" opens three labelled blocks in the inspector column, not a popover: *Recommendation (generated)* · *Quoted from source* (the exact `details[].quote`, jump-highlighted in the message) · *Full thread*. Never "No candidate findings" when opened from a situation.
  - **Verification:** link text "{source title} · excerpt"; opens and scrolls to the excerpt, and offers "Open entry".
- **Benefit / tradeoff:** fact, inference and source stay adjacent and distinguishable, which is the manual's core requirement. Needs a small navigation event and fingerprint lookup; both values already exist.
- **Effort:** M.
- **Confidence:** observed plus code.
- **Acceptance:** from each of the three surfaces, one click shows the verbatim source text, visually distinct from generated text.

#### U6. With Voice replies on (the default), typed answers do not stream and arrive as a summary
- **Surface:** Command console.
- **Observation:**
  - `sendText` passes a voice depth whenever Auto Speak is on, and `useDashboardData` drops every delta when a voice depth is set (code, `realtimeVoice.ts:277-281`; `useDashboardData.ts`, `case "delta"`).
  - The console shows "Processing command…" until completion (observed), then leads with the ≤55-word spoken summary, with the written answer behind "View full response" (observed).
- **Impact:** the streaming work documented in COMMAND-CONSOLE.md is bypassed for the default setting. A typing operator waits for the whole structured response, then reads an abstract.
- **Change:**
  - **Before:** typed input with Voice on gives no stream and summary-first.
  - **After:** typed input streams the written answer as primary. The spoken summary becomes a small caption or disclosure and is still spoken. Voice-initiated turns may stay summary-first.
- **Benefit / tradeoff:** perceived latency and reading both improve. Needs structured-stream handling in `responses.rs` and the Anthropic adapter, for example streaming the `visualResponse` field or requesting two output items.
- **Effort:** M (backend and frontend).
- **Confidence:** observed plus code.
- **Acceptance:** typed input with Voice on shows text within about 1 s of the first token, uncollapsed.

#### U7. Research: the inspectors crush the library, and opening an entry loses your place
- **Surface:** Research panel.
- **Observation:**
  - **Inspectors:** Knowledge Audit and Research Verification are stacked `<details>` above the library, each `max-height:70%`. With both open the library measured **2px** tall (observed, `screenshots/05`). With one open there are three nested scroll regions.
  - **List → entry → Back:** the list was scrolled to 2,784px. The entry opened at scrollTop 101, so its title and metadata were out of view. Back returned to 0. Focus went to `<body>` both times (measured).
  - **Header:** "Migrate 20 entries" overlaps the entry count and "Add Entry" wraps at 1280 and 1440 (observed, `screenshots/05`).
- **Impact:** the operator cannot read a verification brief next to its source, and browsing a large library means repeatedly finding your place again.
- **Change:**
  - A segmented control in the Pantheon header, **Library | Questions (verified) | Audits**. Each gets full height, and catalog deep links select "Questions".
  - On open, save list scroll, set 0 and focus the entry title. On Back, restore scroll and focus the originating row.
  - Migrate becomes an inline notice row; header buttons use `nowrap`.
- **Benefit / tradeoff:** full-height reading; one more control in the header. ⚑ Small IA change inside Research; no new top-level navigation.
- **Effort:** S (scroll and focus) to M (segmented view).
- **Confidence:** observed.
- **Acceptance:** at 1280×800 a verification brief starts within the first 300px, and the library is one click away with scroll intact. Back lands on the same, focused row.

#### U8. Communications at laptop widths: the answer is below the fold and map text is 7–10px
- **Surface:** Situation maps, whole-situation view.
- **Observation:**
  - The side-by-side layout starts at ≥1500px wide. At 1280 and 1440 the briefing (the "what needs me" answer) sits below the visible area (observed, `screenshots/06`).
  - Map cards scale to 0.6 there: titles 10.3px, actor previews 8.1px, counts 6.6px (measured).
  - At 1920 the composition is balanced (observed, `screenshots/07`).
  - At 2560 the scale inverts: map titles 25px, briefing body 13px (measured).
  - "Activity & updates" opens as an absolutely positioned 65vh overlay that covers the briefing and intercepted clicks on "Draft reply" (observed; code, `situations.css:104`).
- **Impact:** on the operator's likely laptop the primary recommendation is not visible on arrival, and the visible map is hard to read.
- **Change:**
  - **Before:** map on top, briefing below the fold; overlays float over content.
  - **After (pick one):**
    - Side-by-side from about 1200px with a ~300px inspector.
    - Or a one-line strip above the map: "VERIFY · Mortgage — Confirm the current servicer… ↓".
  - In both cases:
    - Map text floors at 12px (fewer nodes per page rather than shrinking).
    - Node scale capped at ~1.1×, and the briefing grows to 15–16px at ≥2200px.
    - Activity, logs and updates render in the inspector column, not over it.
- **Benefit / tradeoff:** the answer is visible on arrival; the map loses width at mid sizes.
- **Effort:** M. ⚑ layout contract (SITUATION-MAP-POLISH).
- **Confidence:** observed and measured (the harness chrome overstates the fold by about 100px; map sizes are unaffected).
- **Acceptance:** at 1440×900 the useful next step is visible without scrolling, no map text is under 12px, and Draft reply stays clickable with Activity open.

#### U9. The keyboard model is inconsistent and long
- **Surfaces:** app shell, Command, Research, Preferences.
- **Observation:**
  - **Shortcut popover:** it says Ctrl+K "focuses search in the open library" and that cycling covers three modes. In Command, Ctrl+K focuses the console; cycling covers four modes; Ctrl+Shift+M (microphone) is not listed (observed; code, `AmbientDock.tsx:125-147`).
  - **Ctrl+K:** two window listeners own it. In Research it goes to the console or the library depending on which re-subscribed last (measured; code, `ChatPanel.tsx:122-126`, `LibraryPanel.tsx:173-177`).
  - **Tab order:** it takes 67–69 Tab presses to reach the console in Command, because each of about 44 constellation stars is a tab stop (measured).
  - **Preferences:** it has no dialog role, does not trap focus, ignores Escape, covers the mode switcher, and Ctrl+\ still switches mode under it (measured).
  - **Library search:** no visible focus (`input { outline: none }`, code `styles.css:120-126`).
- **Impact:** shortcuts are untrustworthy, the primary input is last in tab order, and a modal isn't modal.
- **Change:**
  - One shortcut registry that feeds the popover.
  - Ctrl+K always means the console; library search moves to `/`.
  - The ring becomes one widget with roving tabindex (arrows between segments and into stars), plus a "Skip to console" link.
  - Preferences reuses the write-gate modal primitive (dialog role, focus trap and restore, Escape) and opens below the header.
  - One `--focus-ring` token.
- **Effort:** M. **Confidence:** measured.
- **Acceptance:**
  - ≤15 Tab presses to the console in Command.
  - The popover matches behaviour in every mode.
  - Escape closes Preferences and returns focus to the gear.
  - Every tab stop shows a visible change.

#### U10. The opening briefing is invisible in Text mode and mislabelled
- **Surface:** Command console.
- **Observation:**
  - With Auto Speak off, the console stays "OLYMPUS READY" and the briefing sits in the collapsed conversation (observed). `responseReady` is set only for operator-initiated turns (code, `ChatPanel.tsx:98-102`).
  - The briefing shows "Playback unconfirmed" although no audio was attempted, and carries the microphone icon (observed).
  - It is persisted each launch and enters model history (code).
- **Impact:** manual Proactivity stage 1 is not delivered to a text-only operator, and the receipt misstates what happened.
- **Change:**
  - **Before:** "OLYMPUS READY".
  - **After:**
    - "BRIEFING READY", plus a one-line preview of the first sentence under the status. It clears when the console is opened. Non-modal, and it does not open the aperture.
    - The bubble label reads "Opening briefing · from project state, no model".
    - Playback reads "Not spoken (Text replies)".
    - Never collapsed.
    - Excluded from model history via a `kind: "briefing"` marker.
- **Effort:** S. **Confidence:** observed plus code.
- **Acceptance:** with Auto Speak off the dormant bar indicates a briefing; no "unconfirmed" receipt; the briefing never appears in the request history.

#### U11. Delegation approval: the plan can't be read first, refusals come late, and the decision is hard to read
- **Surfaces:** Project detail, DelegationPanel, DelegationReview.
- **Observation:**
  - **Reading the plan:** a waiting run's plan is visible only after "Review resume scope", which starts a 10-minute approval proposal (observed; code).
  - **Late refusals:**
    - "Prepare Claude run" is offered on a project with a waiting run, and on a project with uncommitted work. The backend refuses only after the task and criteria are written, with "Protect it before preparing a run", though no protect action exists (observed; code, `delegation.rs:1283,1289`).
    - Watching projects pre-fill the task with a decision, not a coding task (observed).
  - **The approval subject:** it shows the raw scope string "implement-v2: Read,Glob,Grep,Edit,Write,Bash(git status:*)…", a 20-character hash with no branch, and an absolute expiry. Approve has the same weight as Cancel and sits about 500px down (observed).
  - **The review form:** it renders in unstyled browser-default 16–18px labels beside 9–11px board text (observed, `screenshots/04b`). "Record review and complete" is disabled with no stated reason.
- **Impact:** the operator decides under a timer without having read the plan, fills forms that will be refused, and cannot see what completion requires.
- **Change:**
  - A read-only Plan disclosure on the waiting run card, using `fetch_delegation_review`, which already returns it.
  - Disable Prepare with an inline reason ("Run in progress — review it below" / "Commit or stash 3 uncommitted changes first"). Don't pre-fill tasks on watching projects.
  - Render the subject as a definition list: Repository · Base (branch @ short hash) · Permitted actions in words ("Read and edit files; run git status, npm build/test, cargo test/check. No commit, push or merge. $5 and 45 minutes per launch.") · a live "Expires in 9:41". Approve is the single primary button; the run's Cancel becomes "Stop run…" with a confirmation.
  - Next to Complete, a live checklist: "✓ Diff reviewed · ✗ Criterion 2 needs a note (12/20) · ✓ No failed or stale checks".
- **Benefit / tradeoff:** a better-informed decision with no change to the approval model.
- **Effort:** M.
- **Confidence:** observed plus code.
- **Acceptance:**
  - A waiting plan is readable without a proposal being created.
  - No enabled Prepare path exists that the backend would refuse.
  - The complete button always states its missing conditions.

#### U12. Gmail recovery is buried, and data-reducing actions lack recovery information
- **Surfaces:** Communications header, Preferences › Gmail.
- **Observation:**
  - **Status:** the error fixture shows "GMAIL · Connected · read only" beside "⚠ Gmail sync issue", and Sync stays enabled in the auth-required state (observed).
  - **Recovery path:** Details → Connection & history settings → Preferences → expand Gmail → Reconnect, four steps (observed).
  - **Backoff:** the 4-hour background backoff added in the fixes is not shown anywhere (code).
  - **Cache removal:** the confirmation lists what it deletes, including imported document context, updates and drafts, but gives no counts, no "cannot be undone" and no re-import path, and is styled like Keep (observed). The manual requires "explicit approval plus recovery information" for deletions.
  - **History range:** narrowing it prunes immediately, with no warning (code, `GmailSettings.tsx:22`, `store.rs`).
- **Change:**
  - Messages carry their action: "Authentication required — [Reconnect]"; "Understanding paused after 3 failures; next attempt 3:40 PM — [Retry now]".
  - The header never says Connected while an error is set.
  - The settings link opens Preferences with Gmail expanded.
  - The removal confirmation reads "Deletes 1,842 messages, 3 situations, 12 updates, 2 drafts and imported document context (58 sources). Cannot be undone; document context must be re-imported with scripts/import-situation-context.py." with destructive styling.
  - Narrowing the range asks first.
- **Effort:** S–M (the next-attempt time needs backend exposure). **Confidence:** observed plus code.
- **Acceptance:** Reconnect is one click from an auth failure; the removal confirmation shows counts and the recovery path.

### B. Design refinements

#### D1. Consolidate the type scale and set a size floor ⚑ visual language
- **Observation:**
  - 36 distinct font sizes, with 9.5% using the `--text-*` tokens (measured).
  - At 1440×900, 45 of 74 text elements in Project mode are under 11px (measured). The smallest are the most decision-relevant: "OWNER UNKNOWN" at 8px, status chips and filters at 9px, console status and the Text/Voice toggle at 9px.
  - Library action buttons render at about 17px beside 10px ghost actions (observed, `screenshots/09`).
  - At 2560 all type stays fixed while rows stretch to about 2,100px (observed).
- **Impact:** the ownership and status facts the board exists to show are the hardest text to read, and the manual's "readable across the room" fails on the console status.
- **Change:**
  - Six steps with an 11px floor (10px only for tracked uppercase numerals).
  - Owner shown as a labelled chip ("Owner: You").
  - Library buttons at the ghost-action size.
  - Board content `max-width` about 1,200px.
  - A `clamp()` scale at ≥2000px for console status and briefing text.
- **Effort:** M–L. **Confidence:** measured; the exact scale is a design judgement.
- **Acceptance:** under 10% of rendered text below 11px in any mode at 1440.

#### D2. Token hygiene and contrast
- **Observation:**
  - `--secondary` is used in 13 rules and never defined; `--space-10`, `--space-14` and `--text` are also undefined (measured). `.delegation-run` therefore computes `gap: normal` and zero padding, so its content touches the card border (observed).
  - 561 distinct hex colours, 517 of them used once.
  - 10 different focus-ring colours.
  - `--label` #6b7a90 measures 4.28–4.39:1 on panels and 3.27:1 over the bright photo, which fails AA for its 11px uses.
- **Change:**
  - Define the missing tokens.
  - Add a CI grep that fails on `var(--x)` with no definition and no fallback.
  - Set `--label` to `#7d8ba1` (5.55 / 4.99 / 4.15 on dense, panel and chrome-over-bright surfaces).
  - One `--focus-ring`.
  - Fold one-off colours into the palette opportunistically.
- **Effort:** S. **Confidence:** measured.
- **Acceptance:** 0 undefined tokens; the audit reports no small-text contrast failures in Research.

#### D3. Stop implementation details leaking into ordinary views
- **Observation:**
  - "communication-intelligence/v3 · completed · 18 ms" in the brief footer.
  - Message IDs and fingerprints under "Why this?".
  - "[Gmail thread: <id>]" typed into the console prompt.
  - "Run · communication-intelligence/v4" as a title.
  - The raw scope string in approvals (U11).
  - Raw ISO timestamps in commit lists and verification runs.
  - Raw JSON in model diagnostics.
  - "no such table: research_verification_runs" as a catalog error.

  (All observed.)
- **Change:**
  - Human labels in primary views ("Analysed 3 threads · 9/12 6:00 PM · [Inspect]"), with identifiers kept inside inspection details.
  - Thread references passed as hidden structured context.
  - One shared `formatWhen()` in place of 41 ad-hoc date calls; relative plus local time ("2 h ago · 09:55").
  - Friendly errors with the technical detail in a disclosure.
- **Effort:** S. **Confidence:** observed plus code.

#### D4. Use the Workflow Inspection layout for every inspector
- **Observation:**
  - Research Verification reads as a dump: run metadata before the brief, raw ISO times, JSON beside the answer, and mixed button styles (observed).
  - Knowledge Audit shows raw `snapshot_ready` strings (observed).
  - Model diagnostics are raw `<pre>` blocks (observed).
  - Workflow Inspection already solves this well (observed).
- **Change:** order each as question → answer or brief (Supported / Contradicted / Insufficient with counts) → evidence cards → small structure diagram → receipts and JSON under "Internals". Diagnostics become a table: time, route, model, status, first token, latency.
- **Effort:** M. **Confidence:** observed.

#### D5. Project board: stop spending the first viewport on repetition ⚑ layout contract
- **Observation:**
  - At 1280×800 no project row is visible on arrival. At 1440 the first row starts at y≈660 (observed).
  - A NEEDS_YOU project appears in the brief, the attention section, its row, and the opening briefing (observed).
  - Every NEEDS_YOU row repeats "Inspect the recorded scope or result…", and every row repeats "Rule-based suggestion · not approval" and "0 delegation checkpoints" (observed).
- **Change:**
  - Pin NEEDS_YOU and BLOCKED rows at the top with their checkpoint text and Review action, replacing the separate attention section.
  - Reduce the brief to one line of counts.
  - State the disclaimer once as a legend.
  - Make recommendations run-specific ("Plan waiting 45 min") or omit them.
  - Hide zero-value footers.
- **Effort:** M. **Confidence:** observed; the IA choice is a judgement.
- **Acceptance:** at 1440×900 the first project row starts above y≈300.

#### D6. Name states precisely
- **Observation:**
  - "Speaking" labels both text streaming (instrument readout) and audio playback (observed).
  - A live microphone is a small grey line (observed).
  - "COMPLETE" means archived (code and docs).
  - "Agent-reported outcome — unverified until review" stays on completed runs (observed).
  - Grammar: "1 have active delegated work" (observed).
- **Change:**
  - "Responding" for text; "speaking" only for audio.
  - A distinct "MIC LIVE" indicator.
  - "ARCHIVED" in place of "COMPLETE".
  - "Operator review recorded {date}" on completed runs.
  - Pluralisation fixed.
- **Effort:** S. **Confidence:** observed.

### C. Functional optimizations (existing workflows)

#### F1. Show freshness where decisions are made
- **Observation:**
  - No surface says how current it is.
  - The board has no scan time. Communications shows absolute "Last sync: 9/12/2026, 6:00:00 PM" and never shows when the understanding last ran.
  - The catalog's "Observed" time is 7px.

  (Observed.) Polls run at 10 s, 30 s, 60 s and 300 s across surfaces (code).
- **Change:** one quiet line per surface:
  - Project: "Projects scanned 40 s ago · tasks 12 s · runs live".
  - Communications: "Mail synced 4 min ago · understanding 12 min ago · background on".
  - Each is a click target that refreshes that source.
- **Benefit:** "Unknown" and "stale" become visible rather than inferred.
- **Effort:** S–M (the Communications last-run time needs backend exposure).
- **Confidence:** observed plus code.

#### F2. Put the manual's missing "Attention" field back
- **Observation:**
  - `src/services/projectBriefing.ts` computes deterministic attention items: vision never reviewed or older than 90 days, uncommitted worktree changes, agent work awaiting review. Nothing imports it now (code).
  - The board says "Blockers… not recorded", and neither board nor detail shows Attention, which is the fifth required briefing field in the manual.
- **Change:**
  - An ATTENTION line on the row and a section in the detail, fed only by those source-labelled facts: "Agent worktree has 3 uncommitted files", "Vision last reviewed 63 days ago".
  - Feed the same facts to the opening briefing.
- **Effort:** S–M. **Confidence:** code.
- **Acceptance:** a fixture project with a dirty worktree shows the item on the board and in the briefing.

#### F3. Make library search and lists match how research is judged
- **Observation:**
  - "Olympus" matches every entry via the automatic `olympus/research` tag.
  - Stance, why-kept and bodies are not searched, though chat retrieval does read bodies. The code comment justifying the exclusion is stale.
  - Stance never appears in lists.
  - "Recent" sorts by publication date, not date added.
  - Guide, Paper and Talk collapse to ARTICLE.
  - The form's drop zone accepts no drops.
  - Add Entry never sends `project`.
  - Wikilinks look like buttons and do nothing, and `![[_attachments/…]]` renders as a stray "!" plus a dead chip.

  (Measured and code.)
- **Change:**
  - Exclude the automatic tags from search, and add stance and why-kept to the match fields.
  - Search bodies as a second tier: "Also mentioned in body (n)".
  - A stance mark on each row.
  - "Recently added" by created date.
  - Preserve source types.
  - Relabel to "Choose a file…".
  - An optional Project select.
  - Wikilinks resolve to library entries or render as plain text; attachments render as "Attachment · file.pdf · Open".
- **Effort:** S–M. **Confidence:** measured plus code.

#### F4. Make Communications scale past a handful of situations
- **Observation:** with 52 situations:
  - There is no sort, filter or search.
  - Tab passes 34 or more navigator cards before reaching the map.
  - Overview cards cannot be clicked.
  - Cards show raw ACTIVE or EMERGING and "0 evidence items" rather than priority.

  (Measured.)
- **Change:**
  - Sort by the review policy (Needs attention → Review soon → other, then recency), with a filter (Active / Emerging / Has open questions) and a priority chip per card.
  - Roving focus in the list and a "Skip to briefing" link.
  - Overview cards open their situation.
- **Effort:** M. **Confidence:** measured.

#### F5. Reduce work nobody is watching
- **Observation:**
  - `situation_snapshot` polls every 3 s and calls `setData` unconditionally, re-deriving priority and actor projections (code).
  - `gmail_status` polls every 2 s while Preferences is open, even when its section is collapsed (code).
  - The Communications brief polls every 10 s while collapsed (code).
  - The WebGL scene initialises even when the app opens in Research. With WebGL disabled, startup long tasks drop to 0.46 s (measured, but on SwiftShader).
  - The SVG ring and day arc are hidden until the scene is ready, and there is no fallback if WebGL fails: the instrument disappears and a mismatched "Retry 3D view" pill remains (observed).
  - Idle Command writes about 42 transform attributes per second on ring nodes (measured).
  - The header Ω animates in all modes (measured).
  - The 2.4 MB background PNG is upscaled 1.53× at 2560 (measured).
- **Change:**
  - Revision-based `setData` skip for the snapshot; poll only visible sections.
  - Initialise the scene on first Command activation or when idle, show the SVG ring immediately, and keep it as the WebGL-failure fallback.
  - Pause decorative animation outside Command.
  - Serve the background as WebP or AVIF.
- **Benefit:** faster first paint in non-Command launches, a Command that never disappears, and less CPU on a laptop.
- **Effort:** M.
- **Confidence:** code and measured on SwiftShader. [native check] Profile on the real GPU before prioritising beyond the fallback.

#### F6. Small correctness and robustness items
All effort S.

- **Chat links:** console markdown links use `target="_blank"` with no handler. Route them through `open_external_link`, as Research does (code). [native check]
- **Ctrl+R:** it refreshes only projects (code). Refresh every store, or relabel it "Rescan projects". Always `preventDefault` so WebView2 cannot reload mid-draft (hypothesis). [native check]
- **Error boundaries:** there are none. A render error blanks the app and unmounts the write gate (code). Add one boundary per mode, plus a root boundary that keeps the console and write gate alive.
- **First-launch seed conversation:** it renders "OLYMPUS: Tools should stay compact…" as real Olympus speech and sends it as model history (observed). Start empty.
- **Transcript dates:** timestamps have no date, so a three-day-old briefing looks current (observed). Store ISO time and add day separators.
- **Replay, Save memory and Note observation:** these are `color: transparent` until hover (code, `styles.css:1850-1864`). Keep Replay always visible when a spoken summary exists.

### D. Product-direction proposals

These need the operator's decision; each is flagged.

#### P1. Show attention on the ring ⚑ visual language
- **Why:** from Command, "what needs me" is visible only inside the console text. The ring carries names and task counts only (code, `ProjectRing.tsx`).
- **Proposal:** a small static amber notch on the segment of any NEEDS_YOU or BLOCKED project, with the readout adding "needs you". It is fed by the same deterministic board projection, with no card or panel.
- **Tradeoff:** extends the ring vocabulary the manual defines as name plus count.
- **Effort:** M.

#### P2. Let the agent catalog step aside ⚑ layout contract
- **Why:** at 2560 the catalog is about 708px wide with about 800px of empty detail. At 1280 the detail shows about three rows. It takes 29% of the width in the mode the manual defines as "one instrument" (observed).
- **Proposal:** collapse it to an icon strip (Ω plus role icons with status dots), remembered per viewer, or cap it at about 420px and give the rest to the centre track.
- **Tradeoff:** revisits the September 24 29/40/31 layout.
- **Effort:** M.

#### P3. One "what needs me" in Communications
- **Why:** "Thread analysis history" inside Browse email contains a live brief ("1 thing needs you") with a paid "Refresh intelligence" button. The situation refresh icon has the same name but does different paid work (observed).
- **Proposal:**
  - Minimum: rename to "Thread triage (manual)" and "Refresh situations".
  - Fuller: fold thread triage into situations as evidence, or add an "Unassigned threads that may need you" row on the Overview.
- **Effort:** S (rename) to L (merge).

#### P4. Make the global rail useful
- **Why:** the rail on every mode holds four tools with no launch wired (two "planned") and four consumer launchers: Spotify, Discord, X and YouTube (code, `ToolBelt.tsx`). Up to four settings-like slider icons are visible at once in Communications (observed).
- **Proposal:** the rail becomes global navigation (four modes, Preferences, Shortcuts, Restart behind a confirmation). Inert tools are hidden until wired; launchers move to Preferences or a single "Apps" popover.
- **Effort:** M.

#### P5. Give research layers 2–3 a surface ⚑ autonomy
- **Why:** the manual defines source → candidate lessons → approved guidance. Only the source layer has UI, and stance can be set only at capture.
- **Proposal:**
  - "Set stance / why kept" in the entry detail through the write gate, as a frontmatter-only edit.
  - From a verification brief, "Promote supported claim" opens the existing reviewed Decision-Log promotion carrying the claim, quote and source fingerprint. It stays historical memory, never standing instruction.
- **Effort:** M.

#### P6. Cross-surface relationships
- **Proposal:**
  - Project detail shows linked research (by `project`) and recent conversations and Decision Log entries about the project.
  - Email-only situations get a light correspondence dossier matching the document dossier: inferred role, threads, quotes, last contact, drafts.
  - Each entry lists where it was cited (`conversation_research` already stores `sourceFile`).
- **Effort:** M–L. ⚑ New read queries.

---

## Workflow friction assessment

| Journey | Steps today | Main friction | Fixes |
|---|---|---|---|
| Open Olympus and see what needs attention | 0–1 | Seed projects on the ring before or instead of a scan; red core when voice fails; briefing invisible in Text mode; attention not on the ring | U1, U2, U10, F2, P1 |
| Inspect a project and decide the next action | Board → Open project → scroll ~600px to delegation | First viewport repeats itself; Attention field missing; owner at 8px; repo facts at the bottom of the detail | D5, F2, D1 |
| Ask a question and check its context | Send → read summary → open disclosure → retype title in library | No stream with Voice on; sources not linkable; no dates in transcript | U6, U5, F6 |
| Find research and promote knowledge | Search → open → back → search | Search misses bodies and stance and over-matches automatic tags; place lost on Back; no stance in list; no promotion from verification | F3, U7, P5 |
| Understand a situation and inspect sources | Arrive → scroll to briefing → Review source → read whole thread | Briefing below the fold at 1440; "No candidate findings"; quotes in a separate overlay; overlays intercept clicks | U8, U5 |
| Review an agent run and approve | About 10 steps to complete; resume requires preparing before reading | Notes wiped by checks; plan hidden until the approval timer starts; unexplained disabled Complete; late refusals | U3, U11 |
| Move between typed and voice | Toggle in console | Voice default changes typed behaviour (no stream, summary-first); provider failure alarms the instrument; Replay hidden until hover; Preferences names the same setting differently | U6, U2, F6, U9 |

The step counts in delegation review are justified by the evidence model. The losses, the hidden requirements and the late refusals are not.

## Suggested sequence

**1. Quick refinements (each S; roughly one to two days together)**
- U1 seed projects out of the desktop runtime, with scan errors shown.
- U2 voice failure no longer alarms the instrument; no replay after repeated failure.
- U3 (part) review notes survive checks; draft prompts on close.
- U4 Restart moved behind a confirmation.
- U10 briefing indicator and labels.
- D2 tokens, `--label` contrast, one focus ring.
- D3 date formatting and friendly errors.
- D6 state names.
- F6 chat links, Ctrl+R, error boundaries, empty seed conversation.
- U9 (part) correct shortcut popover and Preferences as a real dialog.

**2. Focused next design iteration: "Evidence and continuity"**

One theme across all four surfaces, because it is what makes Olympus a thinking partner rather than a set of dashboards:
- U5: one evidence-link behaviour (chat, Communications, verification) with "changed since" indicators.
- U3: a per-mode view store so navigation never loses work.
- F1: freshness lines.
- F2: the Attention field back on the board and in the briefing.
- U11: delegation approval legibility and read-before-approve.

Acceptance is a walk-through of the seven journeys above at 1440×900 in the desktop app.

**3. Optional longer-term changes**
- D1 type scale.
- U8 Communications laptop layout.
- U7 Research segmented views.
- U6 streaming with Voice on.
- F5 lazy WebGL, SVG fallback, and polling revisions.
- F3 and F4 search and navigator scale.
- P1–P6 as the operator decides.

Profile on the real GPU before investing in rendering work beyond the fallback.

## The three changes that would most improve daily use

1. **Make the glance truthful (U1 + U2, with F1).** Olympus's value rests on stating only what it knows. Today its most visible surfaces can show fictional projects, or an alarm that blames the wrong subsystem, and on every launch while credit is exhausted they do. The fixes are small and remove the biggest trust hazard in the product.
2. **One click from any claim to its evidence (U5).** The manual's requirement that fact, inference and recommendation stay distinguishable is met in the copy but not in navigation. Linking chat sources, Communications moves and verification citations to the exact source text turns careful labelling into something the operator can use.
3. **Never lose the operator's work to navigation (U3).** Review notes, proposals, drafts, searches and reading position are the operator's investment. Keeping them across checks and mode switches removes a daily source of friction, and it makes the ambient Command mode safe to glance at mid-task, which is how it is meant to be used.
