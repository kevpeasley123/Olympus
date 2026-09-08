# Project Command Board

Project mode opens a compact portfolio: status brief, operator attention, filters,
and consistent STATE / NEXT MOVE + OWNER / OLYMPUS RECOMMENDS rows. Open Project
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
  not evidence that every task or milestone was finished.
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

Filtering uses derived statuses; sorting supports priority, source recency and name.
Unknown projects precede monitoring so incomplete active work does not disappear
behind the watchlist. Shared delegation polling prevents separate panel snapshots.

## Verification

15 pure derivation checks; 12 browser fixture checks (filters, detail mounting,
context/draft/send behavior and board overflow at 1440/1280/980). Existing six
service harnesses pass. TypeScript and Vite production build pass. No lint script
is configured. Browser fixtures perform no paid model call or vault mutation.
Native approval, paid delegation and general operator ownership remain unverified.
