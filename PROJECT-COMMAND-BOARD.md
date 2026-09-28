# Project Command Board

Project mode opens a compact portfolio: status brief, operator attention, filters,
and consistent STATE / NEXT MOVE + OWNER / OLYMPUS RECOMMENDS rows. (Since
2026-09-28 the separate operator-attention section is gone: NEEDS YOU and BLOCKED
rows are pinned at the top instead. See the section at the end.) Open Project
mounts one detailed workspace with vision, recent commits, recorded intent, tasks,
Git/worktree details, Obsidian navigation, and the existing delegation workflow.
One centre-panel scroll area respects the desktop shell; cards have no scroll areas.

## Sources and derivation

`projectCommandBoard.ts` is a read-only projection, not a new database.
Git owns activity, the vault owns classification/vision/next_step and tasks,
and delegation records own run phases. Pantheon remains reference material,
not a project execution or commitment source.

- NEEDS_YOU: recorded waiting plan or awaiting_review result. Each run is retained
  as a separate attention checkpoint, including concurrent runs.
- IN_PROGRESS: approved/preparing/planning/editing/testing/reviewing run exists.
- MONITORING: explicitly declared watching, with no run/checkpoint above.
- COMPLETE: explicitly archived, with no run/checkpoint above. This means archived,
  not evidence that every task or milestone was finished. Since 2026-09-28 it is
  displayed as ARCHIVED everywhere; `COMPLETE` remains the data value that voice
  navigation uses.
- UNKNOWN: all other projects or unavailable delegation data. Git dirtiness and
  recent commits never prove execution; a recorded next step does not prove readiness.
- READY, BLOCKED and external WAITING are typed/filterable but currently have no
  authoritative source. They remain empty rather than being guessed.

Next move is the operator checkpoint, active delegated task, or recorded next_step.
Owner is OPERATOR for checkpoints, OLYMPUS for active runs, NONE for archived or
watching without a next step, otherwise null (unknown). General blockers and
operator decisions are unavailable. The checkpoint count is not a total decision count.
Last change explicitly identifies Git commit or delegation update; note modification
is not yet supplied and task-file timestamps are not treated as project progress.

Recommendations and the portfolio brief are labelled deterministic. They perform
no writes, approvals, commitments or API calls. Review focuses the existing console,
attaches inspectable/removable source context, preserves a nonempty draft, and waits
for Send. Canvas and delegation retain existing backend confirmation gates.

Filtering uses derived statuses; sorting supports priority, source recency and name
(since 2026-09-28, NEEDS YOU and BLOCKED rows stay first under every sort).
Unknown projects precede monitoring so incomplete active work does not disappear
behind the watchlist. Shared delegation polling prevents separate panel snapshots.

## Verification

15 pure derivation checks; 12 browser fixture checks (filters, detail mounting,
context/draft/send behavior and board overflow at 1440/1280/980). Existing six
service harnesses pass. TypeScript and Vite production build pass. No lint script
is configured. Browser fixtures perform no paid model call or vault mutation.
Native approval, paid delegation and general operator ownership remain unverified.

## Design-review changes — September 28, 2026

Items U1, D1, D3, D5, D6, F1 and F2 of the
[design review](docs/reviews/2026-09-28-design-usability/DESIGN-USABILITY-REVIEW.md).
Code: `ProjectsPanel.tsx`, `projects.css`, `services/projectCommandBoard.ts`,
`services/projectBriefing.ts` (`projectAttention`).

**Scan state.** The board renders `projectScan` rather than inferring from the
project count:

- loading — a skeleton and "Scanning projects…", no rows;
- failed (no scan has succeeded this launch) — "Project scan failed HH:MM — reason.
  Showing nothing rather than stale data." with Retry, and no rows;
- stale (a later refresh failed) — "Last successful scan …. Latest refresh failed:
  reason. These rows may be out of date." with Retry, above the last genuine rows;
- empty — "No projects found", naming the stored `projectsRootPath` and the vault's
  `01 - Projects`, with Rescan. Preferences does not edit the root.

The browser preview keeps its example projects under "Browser preview · example
project data".

**Brief, freshness and legend.** One line of counts replaces the repeated summary.
A freshness line reads "Projects scanned … · tasks … · runs …", ages on its own
15-second clock, and rescans projects and re-reads tasks and runs when clicked. A
legend states once "Ω rule-based suggestion · not approval" and "Attention:
observations, not blockers".

**Rows.** NEEDS YOU and BLOCKED rows are pinned first with their checkpoints and a
Review action. A recommendation is shown only when it is specific to the row: for a
waiting plan, "Plan recorded … ; read it before approving implementation"; for a
result, "Result preserved … ; run the applicable checks, then record your review";
for a running delegation, its phase and last update. Generic advice is omitted, and
zero-value footers are hidden. Owner reads as a chip ("Owner: You", "Olympus",
"External", "None", "Unknown"). Dates use the shared formatter.

**Attention.** Each row and the detail view list source-labelled observations:
"Vision not stated", "Vision has no review date" or "Vision last reviewed N days
ago" (Vault note); uncommitted changes in the primary checkout, a repository with no
commits, and linked worktrees with uncommitted files (Git); "Agent result awaiting
review since …" (Run record). Attention never changes operational status or owner.
Including Attention in the opening briefing was assigned to integration QA and is
not described here.

**Detail.** Repository facts come first; the name and next step are not repeated.
The delegation panel's changes are in
[AGENT-DELEGATION.md](docs/AGENT-DELEGATION.md#project-mode-review-surface--september-28-2026).
Board and detail scroll positions survive mode switches for the session. Leaving
Project mode closes the open project unless it holds an unsent run draft or review
notes.

**Size.** 11px text floor, 32px targets, 1200px content width.

Verification: build; `scripts/test-project-board.mjs` (board derivation, Attention
versus status, ARCHIVED mapping, prepare blockers, review-note persistence and
invalidation, completion checklist); project-board harness scan-state checks; mock
checks at 1280, 1440, 1920 and 2560 recorded in the
[implementation checklist](docs/reviews/2026-09-28-design-usability/IMPLEMENTATION-CHECKLIST.md).
Not verified in the desktop app.
