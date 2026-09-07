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
