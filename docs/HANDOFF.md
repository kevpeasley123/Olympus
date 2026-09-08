# Olympus — Current handoff

Read `OLYMPUS-MANUAL.md`, then this file. Previous chronological notes are preserved in
[the historical handoff](archive/HANDOFF-through-2026-08-04.md). That archive contains superseded claims and is not a current task list.

## Baseline verified in this session

- Remote `master` and the clean main checkout matched `c7ed98a` on 2026-09-06 (Phoenix time).
- The main checkout is `C:/Users/kevpe/OneDrive/Desktop/Projects/Olympus`.
- The old `codex/vision-foundation` worktree is 34 commits behind that baseline.
- The installed executable reports 0.2.1. Its timestamp is later than `c7ed98a`, but that does not prove an exact binary/source match.
- Baseline verification: production frontend build, all three frontend harnesses, and 177 Rust tests passed. No paid agent run was performed during that review.

## Installed release

`agent/curated-memory`, based on `c7ed98a`, was fast-forwarded into local `master`. Release code is `5cdc397`; 0.3.0 is installed and running. These changes are included:

- Question-based Pantheon retrieval selects up to three sources and up to 4,000 body characters per source. Lexical ranking is deterministic; short ambiguous follow-ups may require the operator to name a source or topic. This is not semantic retrieval.
- Retrieved sources carry title, path, date, stance, origin, partial/full status, and body fingerprint. They are evidence after the prompt-cache breakpoint, never standing instructions.
- Conversation research snapshots survive restart in SQLite and can be inspected in Chat. They show what was supplied, not what the model necessarily cited or endorsed.
- Chat memory promotion reads a persisted source message, previews the complete bounded addition, and appends to the Decision Log only after the write gate. Source changes, note changes, and read errors fail closed. It does not change `next_step` or authorize delegation.
- Profile Observations remain excluded from model memory.

See `docs/CURATED-MEMORY.md` for behavior, verification, and remaining acceptance work.

## Approval boundary and remaining acceptance

1. **Approval provenance implemented:** backend-owned, expiring proposals bind the exact task, criteria, repository, base, driver, stage, plan, and workspace. SQLite records approval and consumption before launch; Markdown cannot authorize it. See `docs/OPERATOR-APPROVAL-DESIGN.md`.
2. **Completion evidence implemented:** successful agent exit becomes `awaiting_review`. The UI records actual checks and per-criterion operator evidence against a workspace fingerprint before completion.
3. **Desktop acceptance:** demonstrate retrieval, source disclosure, persisted provenance, promotion approval/decline, and rereading new memory in the actual desktop app.
4. **Delegation acceptance:** demonstrate planning, checkpoint, isolated edit, verification, review, cancellation, and restart recovery.
5. Proactive briefs, fan-out, multiple writers, and voice remain later work. The memory milestone does not authorize them automatically.

## Settled product boundaries

Command is the full ambient instrument and chat. Project hover shows name and task count; repository and briefing detail belong in Projects. Markets and Weather were removed deliberately. The material instrument and speaking animation were approved in the August 4 desktop review; avoid re-opening settled visual decisions based on historical sections.

Git owns repository facts; vault notes own intent; SQLite owns operational records. A recommendation is not an operator commitment. Research presence is not endorsement, and historical memory is not executable authority.

## Verification commands

```text
npm run build
cargo test --lib --manifest-path src-tauri/Cargo.toml
```

Run `projectRing`, `pantheonRecord`, and `glyphState` harnesses through Vite's SSR loader. Report build, unit-test, browser, desktop, and operator evidence separately. Build output belongs outside OneDrive; isolate Cargo targets for concurrent worktrees.

## 0.3.0 release verification

- Production frontend build passed; existing buffer externalization, eval, and bundle-size warnings remain.
- All 192 Rust tests passed, including exact approval scope, replay/session/cancellation boundaries,
  immutable records, error-result rejection, criterion evidence validation, and committed/untracked file fingerprints.
- All three frontend harnesses passed. Browser fixture rendered task/criteria preparation and
  per-criterion review controls; the fixture did not execute a coding agent.
- Database backup integrity passed; the 0.2.1 rollback installer was preserved before installation.
- Installation receipts and backups live outside source under the workspace `output/olympus-0.3.0-install`.
- Paid delegation, actual desktop memory promotion, and end-to-end restart recovery still need operator acceptance.

### Installation verified on 2026-09-06 (Phoenix)

Windows reports 0.3.0 at `C:/Program Files/Project Olympus/project-olympus.exe`.
The window is responding. The installed binary matches the release output except for
Tauri's expected three-byte bundle marker (`MSI` versus `UNK`). Database integrity is
`ok`, all previous table row counts were preserved, and all seven new tables exist.
The taskbar shortcut points to the installed executable. Local changes are committed;
no remote push was performed. The full receipt is in the external output folder above.

## Desktop acceptance and 0.3.1 freshness fix

The 0.3.0 live research reply (`conversation-assistant-1788760144858`) supplied three
4,000-character excerpts. All three bodies and fingerprints matched their vault sources;
stance and origin were retained. The reply and source snapshots survived restart, and
the operator confirmed the source disclosure reappeared.

The answer nevertheless recommended implementing approval machinery already present in
0.3.0. That is a failed implementation-freshness check, not a retrieval failure. The old
prompt supplied historical decisions without facts about its running build. The 0.3.1
candidate adds backend-owned running-version and capability facts outside the cache
breakpoint, distinguishes implementation from acceptance/approval, and states the exact
number of supplied source bodies separately from the library index. No live ledger or
completed pilot is claimed. Model behavior still requires a repeated desktop query.

Promotion decline/approval, rereading promoted memory, and the bounded delegation pilot
remain acceptance work. Do not promote the stale answer unchanged. Evidence records are
outside source at `output/olympus-acceptance` in the parent workspace.

The missing-key launch issue was traced to building from a worktree without its ignored
`.env`. The existing configuration was restored, then the operator replaced an invalid
key. The replacement passed a read-only API authentication check. Configuration must stay
outside Git; a future installer should remove dependence on the build checkout path.

## 0.3.2 ambient Command update

The operator requested quiet idle motion without layout changes. The localized update
adds decorative counter-rotating SVG orbits, intermittent single tracers and inner sweeps,
small node drift, signals along real graph edges, micro arcs, and existing-vignette motion.
Labels and project segments stay stationary. The running-build freshness fix from 0.3.1
is included. See `AMBIENT-MOTION.md` for files, timings, state extension points, and tests.

Production build, four service harnesses, and the browser lifecycle fixture passed.
Desktop preview with a separate database preserved the existing layout and live graph.
No quantitative frame-rate claim is made. Memory promotion and delegation acceptance
remain unfinished; the animation request did not establish those outcomes.

Installation verified on 2026-09-07: 0.3.2 is installed and open. Release code is
`370d0eb`; the installed binary matches it except for Tauri's expected bundle marker.
Database integrity passed and existing table counts were preserved. The installed
screenshot retained the original layout and fonts (the dev preview's junction-related
font-serving warning does not affect the package). Backups and receipt are in the parent
workspace at `output/olympus-0.3.2-install`. Local source is integrated; nothing was pushed.

## 0.3.3 across-room ambient visibility

The operator found 0.3.2 too subtle. Longer illuminated orbit arcs, larger markers
and tracer tails, brighter signals, and wider core breathing contrast now carry the
motion. Orbit periods are 80/48 seconds; tracer starts are nominally 8–12 seconds.
Layout, project labels, background, reduced-motion handling, and lifecycle logic remain
unchanged. Release code: `ccb826b`. Production build and all four service harnesses
passed; an installed desktop snapshot showed the brighter arcs and preserved layout.
The operator stopped the follow-up visual inspection with Escape.
Windows reports 0.3.3; the installed binary matches the build except for the expected
Tauri bundle marker. Database integrity and existing row preservation passed. Backups
and receipt: parent workspace `output/olympus-0.3.3-install`. Physical across-room
comfort remains an operator judgment. No remote push was performed.

## 0.3.4 persistent inner rotators

At operator request, two inner arcs now rotate continuously at 10/14-second periods
in opposite directions. The existing sweep event adds three arcs for 3.8 seconds,
then returns to two. No baseline remount, new timer, dependency, or layout change.
Reduced motion freezes the two baseline arcs and hides transient sweeps. Production
frontend build and all four service harnesses passed.

## 0.3.5 full rings on separate axes

The operator requested full thin rings rotating into/out of the screen. Inner arcs
are now complete SVG circles with independent CSS perspective/rotateY projections
and distinct fixed axes. Two persist; three join on the existing burst cycle. Omega
stays foreground, labels stationary. Production build and four service harnesses
passed. The installed desktop rendered the tilted full-ring geometry. Version 0.3.5
release code is `5659090`; installed binary matches except for Tauri bundle marker.
Database integrity and row preservation passed. Receipt and backup are in the parent
workspace `output/olympus-0.3.5-install`. No remote push.

## 0.3.6 adaptive constellation and edge-on visibility

At operator request, linked notes now occupy a spacious star field behind Omega
rather than narrow project depth bands. Soft folder affinity, deterministic bounded
candidate placement, real relationship lines, project hover highlighting, and keyboard
note targets preserve function as notes grow. The existing 120-node backend cap and
linked-not-shown disclosure remain. See `PROJECT-CONSTELLATION.md` for scope and limits.

Ring projection now uses nonzero 2D scale with non-scaling SVG strokes to avoid
zero-area 3D layers disappearing edge-on. The two/five cycle remains. Frontend build
and all five service harnesses passed, including sparse/crowded placement, spacing,
input-order determinism, parent edge endpoints, and appended-note stability.

0.3.6 is installed and running; release code `9102275` matches the installed binary
except for the expected Tauri bundle marker. Database integrity and row preservation
passed. Receipt and backup: parent workspace `output/olympus-0.3.6-install`.
Desktop capture returned an unrelated full-screen application despite targeting the
verified Olympus window; final live visual acceptance is therefore unverified.
No unrelated application was controlled, and no remote push was performed.

## 0.3.7 ring-count tuning

Installed 0.3.7 reduces the expanded inner rings to three total: two permanent,
one intermittent. Timing and constellation unchanged. Production desktop build and
component rendering checks passed (default 2, expanded 3). Release `bc5988d`.
Backup: parent workspace `output/olympus-0.3.7-install/before.sqlite`. No remote push.

## 0.4.0 Command Console

The operator replaced the permanent chat sidebar with Dormant/Engaged/Transcript
modes. Dormant shows only the command bar; engaged mounts three recent exchanges;
transcript pages older history intentionally. Scroll following uses an 80px threshold
and preserves a visible message anchor during prepends. Actual streamed text is now
batched into a console-only subscription, with send/first-output instrument events.
Existing memory, observation, research disclosure, and write gates remain.

Production TypeScript/Vite and desktop packaging passed. All six service harnesses
passed. The isolated browser fixture passed 16 checks spanning modes, latest opening,
stream following/pausing, history anchors, preserved drafts, keyboard shortcuts, final
text, and availability of memory/observation forms. No live API request or vault write
was used for those tests. See COMMAND-CONSOLE.md for behavior and tuning.

Windows reports 0.4.0; release code 4fa1931 matches the installed binary except for
Tauri's expected bundle marker. Database integrity and existing row preservation
passed. Backup/receipt: parent workspace output/olympus-0.4.0-install. Desktop
inspection confirmed dormant layout, Ctrl+K opening, and the latest saved reply at the
bottom with the central instrument clear. Further native history interaction was left
to the operator when input was detected; browser history tests passed. No remote push.


## 0.5.0 Project Command Board

Project mode now opens an operational overview with a deterministic brief,
recorded operator checkpoints, compact state/next-move/owner/recommendation rows,
status filtering and priority/recency/name sorting. Open Project mounts a single
workspace with the original Canvas and delegation authorization boundaries intact.
Shared delegation polling supplies the board and detail view. Console review attaches
inspectable context without replacing an unsent draft or automatically sending.

Status is a read-only projection of vault classification/intent and actual delegation
phases. General ownership, readiness, blockers and external waiting remain unknown;
Git activity never implies execution. See PROJECT-COMMAND-BOARD.md for derivation.
Pure status checks (15), existing six service harnesses, browser board checks (12),
and TypeScript/Vite production build passed. No lint command is configured.

Installed 0.5.0 (release 3c2121c), reopened on Project mode. Native inspection
confirmed all eight live projects, eight Olympus tasks, one watchlist project,
seven explicitly unknown states, and working Open Project/back navigation. No
operator checkpoints or active delegated runs are recorded. The existing 16-check
console browser regression fixture also passed. Installed binary matches the build
apart from the Tauri bundle marker; database integrity and row preservation passed.
Backup/receipt: parent workspace output/olympus-0.5.0-install. No remote push.

## 0.6.0 Voice Phase 1

Deliberate microphone activation now shares the Command Console history, reasoning
handler and Project Command Board context. Rust issues ephemeral OpenAI Realtime
credentials; WebRTC uses gpt-realtime-2.1 / marin for transcription and concise
spoken output. One reasoning answer produces spoken and visual channels. Speech
interruption clears playback and suppresses stale audio while preserving accepted
turns in the visual history. Navigation actions are strictly allowlisted; existing
execution approval gates remain authoritative. Voice metadata persists in an
additive SQLite sidecar. See VOICE.md for architecture, files and tuning.

TypeScript, production build, MSI packaging, all 199 Rust tests, 20 simulated voice
checks and existing service harnesses passed. Console browser regression passed
16 checks; the voice browser fixture verified failure recovery, draft preservation
and interruption labels. No lint command exists. Live microphone permissions,
WebRTC audio, echo handling, voice quality and physical barge-in remain unverified:
OPENAI_API_KEY is not configured. The ignored worktree .env has a blank setting
ready for the operator. No permanent credential reaches the frontend.

Installed and reopened 0.6.0, release b257220. Native inspection confirms the
microphone control in the existing console. Windows version and binary comparison
passed (only the expected Tauri bundle marker differs). SQLite integrity is ok,
all existing row counts are preserved, and the additive voice table exists.
Backup and receipt: parent workspace output/olympus-0.6.0-install. Live audio remains
unverified pending key configuration. Main and implementation branches integrated
locally; no remote push.

## 0.6.1 Voice connection diagnostics

Operator configured the OpenAI key; the first reported live connection failed with
HTTP 429 at the WebRTC calls endpoint, after credential creation. This status alone
does not prove a billing problem or a temporary rate limit. The frontend now parses
known API error codes into actionable quota, credit, spend or rate-limit messages,
with an honest generic fallback. Raw error bodies/unknown codes are never displayed.
Ten targeted classification and redaction checks and TypeScript/Vite build passed.
No billing settings changed and no claim of successful live audio.

## 0.7.0 Asymmetric conversation layout

User turns align right (68% maximum width), Olympus turns left (88%) with steel
and navy surfaces, cyan structure and an orange Omega. Both voice and text use
ConversationBubble in ChatPanel. Spoken summaries are the primary voice content;
full visual answers remain available under View full response. Long typed answers
have a measured 220px preview with expansion. Small identity/modality labels remain.
The lower bar contains microphone status, mute, interrupt and stop controls only.

Realtime snapshot exposes transient input/output message IDs. The common turn
handler uses the input ID for the persisted message, so React retains the same
bubble on finalization without duplicate content. No new persistence store or
model/voice configuration changes. Consecutive speakers use tighter spacing.
History restoration now accounts for measured response disclosure heights.

Verification: 20 simulated voice protocol checks, voice browser layout/disclosure/
identity/deduplication checks, and all 16 console browser regressions passed.
TypeScript and production build passed; no lint script is configured. Browser
screenshot confirmed asymmetric role surfaces. No live API or microphone test was
needed for this presentation change. Version files advance to 0.7.0.

## 0.8.0 Voice preferences

Existing Preferences now exposes centralized Realtime voice selection, uniform
preview, speaking style, response depth, Auto Speak, Live Captions and interruption.
See VOICE.md for persistence and restart details. Ten supported voices verified
against official docs on 2026-09-08. No conversational architecture or agent change.
Voice was formerly the VOICE = marin constant in commands/voice.rs; it now comes
from the shared catalog and validated session creation settings.

201 Rust tests, 22 preference/session checks, 20 existing voice checks and the
production typecheck/build passed. Browser checks verified all six settings after
actual reload, preview failure recovery and unchanged conversation/project data.
Real acoustic barge-in and microphone reconnection remain operator acceptance tests.

Installed/reopened 0.8.0 (00287ec). Native inspection confirmed the Preferences UI.
The operator selected Cedar/Concise during inspection; SQLite contains all six
preferences with that selection, and conversation row count is unchanged. Integrity,
row preservation and binary comparison passed (expected Tauri bundle marker only).
A live preview was attempted, but the operator changed controls during inspection;
acoustic success is not claimed. Browser reload persistence, all 16 console checks,
and the voice layout fixture passed. Backup/receipt: parent workspace
output/olympus-0.8.0-install. No remote push.
