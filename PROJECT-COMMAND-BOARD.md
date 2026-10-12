# Project Command Board

Project mode opens a purpose-first portfolio. Since 0.30.0 it defaults to **All**,
which shows the cards above the project ecosystem; **Cards** and **Ecosystem** show
one or the other. In All, hovering or focusing an ecosystem orb highlights the
matching card. Each card shows the project's emblem and name, its open vault task
count, its recorded vision, one **Next:** (or **Suggested:**) line that expands with
More/Less, and one action: Review plan, Review result, View progress, View project
or Continue. Missing vision is explicit; the generic repository scan summary is never
substituted for project purpose. NEEDS YOU and BLOCKED cards stay first and carry
their status label. Actions open the project without approving or starting
execution. Project linking, Remove from dashboard and Restore are described in
[PROJECT-LINKING.md](docs/PROJECT-LINKING.md); the conversation dock in
[PROJECT-CONVERSATION-DOCK.md](docs/PROJECT-CONVERSATION-DOCK.md).

There is no sort or status-filter control on the board. Rows sort by status
priority; a voice request can set a status filter, which shows a Clear filter
button. Sources & project tools, including Update Canvas and the freshness line,
were removed in 0.29.0 (`df3db81`); `onSyncCanvas` is still passed to
`ProjectsPanel` but nothing calls it.

Project detail opens on an overview: summary, Vision, Recent changes (up to three
commits since the previous session, or from the last 24 hours), Where it stands, and Recommended next step with **Review with Olympus**.
Below it are disclosures: **Tasks & planning** (Organizer, see
[ORGANIZER.md](docs/ORGANIZER.md), and attributed vault tasks), **Coding runs**
(open as **Current work & reviews** while a run is open), **Project records & source
details** (repository facts, note link, full commit list, vault status and
Attention), and **Edit project brief & sources**.

## Sources and derivation

`projectCommandBoard.ts` is a read-only projection, not a new database.
Git owns activity, the vault owns classification/vision/next_step and tasks,
delegation records own run phases, and Organizer records own committed tasks.
Pantheon remains reference material, not a project execution or commitment source.

- NEEDS_YOU: recorded waiting plan or awaiting_review result. Each run is retained
  as a separate attention checkpoint, including concurrent runs.
- IN_PROGRESS: approved/preparing/planning/editing/testing/reviewing run exists.
- MONITORING: explicitly declared watching, with no run/checkpoint above.
- COMPLETE: explicitly archived, with no run/checkpoint above. This means archived,
  not evidence that every task or milestone was finished. It is displayed as
  ARCHIVED everywhere; `COMPLETE` remains the data value that voice navigation uses.
- UNKNOWN: all other projects or unavailable delegation data. Git dirtiness and
  recent commits never prove execution; a recorded next step does not prove readiness.
- READY, BLOCKED and external WAITING are typed/filterable but currently have no
  authoritative source. They remain empty rather than being guessed.

Next move is the operator checkpoint, the active delegated task, the next committed
Organizer task (for projects without a checkpoint or active run that are not
archived or watching), or the recorded next_step. Owner is OPERATOR for checkpoints
and Organizer tasks, OLYMPUS for active runs, NONE for archived or watching without
a next step, otherwise null (unknown). General blockers are unavailable. The
checkpoint count is not a total decision count. Last change explicitly identifies
Git commit or delegation update; note modification is not supplied and task-file
timestamps are not treated as project progress.

Recommendations are deterministic. They perform no writes, approvals, commitments
or API calls. Review with Olympus focuses the existing console, attaches
inspectable/removable project context, and waits for Send. Delegation retains its
backend approval gates.

Unknown projects precede monitoring in the priority order, so incomplete active work
does not disappear behind the watchlist. Shared delegation polling prevents separate
panel snapshots.

## Scan state, recommendations and Attention

From the September 28, 2026 design review (items U1, D1, D3, D5, D6, F1 and F2 of
the [design review](docs/reviews/2026-09-28-design-usability/DESIGN-USABILITY-REVIEW.md)),
still current:

- **Scan state.** The board renders `projectScan` rather than inferring from the
  project count: loading shows a skeleton and "Scanning projects…"; a failed first
  scan says "Project scan failed HH:MM — reason. Showing nothing rather than stale
  data." with Retry; a later failed refresh says "Last successful scan …. Latest
  refresh failed: reason. These rows may be out of date." with Retry above the last
  genuine rows; an empty dashboard says "No projects on your dashboard yet." and
  names the discovery sources (`projectsRootPath` and the vault's `01 - Projects`)
  with Rescan. The browser preview shows example projects marked **Demo data**.
- **Recommendations.** Specific to the row: for a waiting plan, "Plan recorded … ;
  read it before approving implementation"; for a result, "Result preserved … ; run
  the applicable checks, then record your review"; for a running delegation, its
  phase and last update. In Project detail an owner of You, Olympus or External
  reads as a chip ("Owner: You"); None and unknown owners show no chip.
- **Attention.** Project detail lists source-labelled observations under Project
  records & source details: "Vision not stated", "Vision has no review date" or
  "Vision last reviewed N days ago" (Vault note); uncommitted changes in the primary
  checkout, a repository with no commits, and linked worktrees with uncommitted files
  (Git); "Agent result awaiting review since …" (Run record); Organizer records
  unavailable or tasks needing attention (Organizer). Attention never changes
  operational status or owner.
- **Session state.** Board and detail scroll positions survive mode switches for the
  session. Leaving Project mode closes the open project unless it holds an unsent run
  draft or review notes.

Verification: `scripts/test-project-board.mjs` (board derivation, Attention versus
status, ARCHIVED mapping, prepare blockers, review-note persistence and
invalidation, completion checklist), `scripts/test-project-portfolio.mjs`,
`scripts/test-project-presentation.mjs` and the project-board harness scan-state
checks. Browser fixtures perform no paid model call or vault mutation. Native
approval, paid delegation and general operator ownership are not accepted in the
desktop app.
