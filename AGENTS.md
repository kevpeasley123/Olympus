# Olympus Agent Adapter

Read `OLYMPUS-MANUAL.md` before planning or changing the product. It is the
canonical statement of Olympus's purpose, operating model, autonomy boundaries,
and priorities.

Then read:

1. `ARCHITECTURE.md` for technical boundaries and safety invariants.
2. `docs/HANDOFF.md` for current verified and assumed state.
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
