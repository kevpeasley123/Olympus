# Olympus Agent Adapter

Read `OLYMPUS-MANUAL.md` before planning or changing the product. It is the
canonical statement of Olympus's purpose, operating model, autonomy boundaries,
and priorities.

Then read:

1. `ARCHITECTURE.md` for technical boundaries and safety invariants.
2. `docs/NEXT-SESSION.md` for current verified and assumed state (its top
   sections; older sections are marked historical). `docs/HANDOFF.md` is historical.
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
2. Run `npm run visual:review` and read the screenshots it writes to
   `output/visual-review/latest/` for the affected scenarios and viewports.
3. Critique them, fix what is wrong, capture again, and look again.
4. Finish with the full `npm run visual:review` as a regression pass.

Report mechanical results and your own visual judgement separately. A browser
capture is not a desktop acceptance: the Windows native pass is still required
for WebView2, Tauri IPC and real data. See `docs/VISUAL-REVIEW.md`.

## Shared project memory
Follow the vault's `09 - System/Vault Maintenance Protocol.md` for meaningful milestones and handoffs. Local vault: `C:/Users/kevpe/OneDrive/Desktop/Projects/Obsidian vaults/Olympus Obsidian Vault`. Capture independent session records, reconcile current summaries from fresh evidence, and distinguish intent from runtime authority. The local `olympus-memory` skill provides a compare-and-write helper. Missing coverage and inaccessible vaults must be reported; do not claim all sessions have contributed.

## Superpowers pilot boundaries — approved October 8, 2026
Use Superpowers for substantial engineering when installed; cosmetic refinements and simple label edits keep the existing lightweight workflow and do not need a new design approval. Preserve the Olympus memory protocol and existing execution authority. Every Monid execution/spend still requires a separately scoped approval. Collection inspection is not skill assignment or permission to execute. Do not claim a Codex plugin is installed from an Olympus catalog entry. Do not enable the optional visual companion or its telemetry as part of catalog inspection.
