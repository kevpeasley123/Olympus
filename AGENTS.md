# Olympus Agent Adapter

Read `OLYMPUS-MANUAL.md` before planning or changing the product. It is the
canonical statement of Olympus's purpose, operating model, autonomy boundaries,
and priorities.

Then read:

1. `ARCHITECTURE.md` for technical boundaries and safety invariants.
2. `docs/NEXT-SESSION.md` for the current version, open work, decisions
   waiting on Kevin and known issues. Earlier handoffs are in `docs/archive/`.
3. `CLAUDE.md` for model/API constraints that apply to any implementation agent,
   despite the filename.

## Role

Act as a focused implementation and review partner for the Olympus desktop
application. Preserve the distinction between Git truth, vault intent, and
generated recommendations.

## Working rules

- Verify premises against code or runtime before building on a handoff claim.
- Keep changes isolated and recoverable.
- Never present an Olympus recommendation as an operator commitment.
- Pause before product-direction, architecture, or visual-language changes that
  conflict with the current vision.
- State which verification level was actually reached.
- Kevin works in development mode (`npm run tauri dev`). Package or install
  only when he asks, or through "Bring everything current".

## Keeping guidance current

Each kind of fact has one home. Put it there and nowhere else; anywhere else,
link to it.

| Fact | Home | Rule |
| --- | --- | --- |
| Product intent, operating policy, autonomy | `OLYMPUS-MANUAL.md` | Describes what Olympus is for and how it behaves. No versions, release dates or build state. |
| Technical boundaries and safety invariants | `ARCHITECTURE.md` | Describes the code as it is. No "current as of" stamps or counts that drift. |
| Model and API constraints, the release routine | `CLAUDE.md` | Applies to every implementation agent. No project state. |
| Agent working rules | this file | No project state. |
| Current version, open work, decisions waiting on Kevin, known issues, next steps | `docs/NEXT-SESSION.md` | Rewritten, not appended, at the end of each session and at every release. At most 150 lines. |
| Release history | `docs/RELEASES.md` | One line per release, appended. |
| How one feature works | `docs/<FEATURE>.md` | Describes what ships. When the feature is replaced or removed, update or move the doc to `docs/archive/` in the same commit. |
| Dated records: reviews, audits, superseded designs, old handoffs | `docs/reviews/`, `docs/archive/` | Never edited to look current. |

- A change that adds, removes or alters behaviour a document describes updates
  that document in the same commit. Removing a UI entry point counts, even when
  the backend stays.
- Outside the handoff's dated verification record and the release lines, do not
  record test, file or command counts. They go stale with the next commit; the
  scripts report them.
- `scripts/test-guidance-docs.mjs` enforces what a script can prove: the handoff
  names the current version and stays short, `docs/RELEASES.md` has the
  version, every repository file a live doc names exists, every `npm run`
  script named exists, and the `ARCHITECTURE.md` command table matches
  `src-tauri/src/lib.rs`. It is a `test-*.mjs` script, so the release gate runs
  it. Run it after a version bump.
- Every release commit bumps the version, adds its `docs/RELEASES.md` line and
  rewrites `docs/NEXT-SESSION.md`, together.

## "Bring everything current"

The owner's standing release instruction. The procedure and what it authorizes
are defined in `CLAUDE.md` under that heading; follow it exactly.

## UI changes

Before implementing interface motion, search the installed Kinetics skill indexes
and reuse a matching pattern when appropriate. The three skills are
`interaction-and-input-skills`, `feedback-and-state-skills`, and
`surface-and-motion-skills`; each has `references/pattern-index.json` with pattern
names, purposes, synonyms, and reference paths. Read only matching references.
For example, Border Beam is in Surface and Motion Skills. Preserve existing
design and real state semantics; consult these skills even when the request does
not explicitly name them. If they are unavailable, say so and use project primitives.

Look at what you changed, don't only compile it. For any change to Command or
shared UI:

1. Run the focused tests (`node scripts/test-*.mjs` for what you touched).
2. Capture the screens you changed and read the screenshots. `npm run
   visual:review` writes to `output/visual-review/latest/`, but it drives the
   Command harness without `?flagship`, so it shows the pre-October-7
   composition, not the shipped Command. For the shipped Command, capture
   `command-agent-harness.html?flagship` (as `scripts/flagship-review.mjs`
   does) until visual review is pointed at it.
3. Critique them, fix what is wrong, capture again, and look again.
4. Finish with the full `npm run visual:review` as a regression pass.

Report mechanical results and your own visual judgement separately. A browser
capture is not a desktop acceptance: the Windows native pass is still required
for WebView2, Tauri IPC and real data. See `docs/VISUAL-REVIEW.md`.

## Shared project memory
Follow the vault's `09 - System/Vault Maintenance Protocol.md` for meaningful milestones and handoffs. Local vault: `C:/Users/kevpe/OneDrive/Desktop/Projects/Obsidian vaults/Olympus Obsidian Vault`. Capture independent session records, reconcile current summaries from fresh evidence, and distinguish intent from runtime authority. The local `olympus-memory` skill provides a compare-and-write helper. Missing coverage and inaccessible vaults must be reported; do not claim all sessions have contributed.

## Superpowers pilot boundaries — approved October 8, 2026
Use Superpowers for substantial engineering when installed; cosmetic refinements and simple label edits keep the existing lightweight workflow and do not need a new design approval. Preserve the Olympus memory protocol and existing execution authority. Every Monid execution/spend still requires a separately scoped approval. Collection inspection is not skill assignment or permission to execute. Do not claim a Codex plugin is installed from an Olympus catalog entry. Do not enable the optional visual companion or its telemetry as part of catalog inspection.
