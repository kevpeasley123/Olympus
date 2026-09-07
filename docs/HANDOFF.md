# Olympus — Current handoff

Read `OLYMPUS-MANUAL.md`, then this file. Previous chronological notes are preserved in
[the historical handoff](archive/HANDOFF-through-2026-08-04.md). That archive contains superseded claims and is not a current task list.

## Baseline verified in this session

- Remote `master` and the clean main checkout matched `c7ed98a` on 2026-09-06 (Phoenix time).
- The main checkout is `C:/Users/kevpe/OneDrive/Desktop/Projects/Olympus`.
- The old `codex/vision-foundation` worktree is 34 commits behind that baseline.
- The installed executable reports 0.2.1. Its timestamp is later than `c7ed98a`, but that does not prove an exact binary/source match.
- Baseline verification: production frontend build, all three frontend harnesses, and 177 Rust tests passed. No paid agent run was performed during that review.

## Current implementation branch

`agent/curated-memory`, based on `c7ed98a`. These changes are isolated and not installed:

- Question-based Pantheon retrieval selects up to three sources and up to 4,000 body characters per source. Lexical ranking is deterministic; short ambiguous follow-ups may require the operator to name a source or topic. This is not semantic retrieval.
- Retrieved sources carry title, path, date, stance, origin, partial/full status, and body fingerprint. They are evidence after the prompt-cache breakpoint, never standing instructions.
- Conversation research snapshots survive restart in SQLite and can be inspected in Chat. They show what was supplied, not what the model necessarily cited or endorsed.
- Chat memory promotion reads a persisted source message, previews the complete bounded addition, and appends to the Decision Log only after the write gate. Source changes, note changes, and read errors fail closed. It does not change `next_step` or authorize delegation.
- Profile Observations remain excluded from model memory.

See `docs/CURATED-MEMORY.md` for behavior, verification, and remaining acceptance work.

## What is still blocked or unfinished

1. **Approval provenance:** design review is required before implementation. See `docs/OPERATOR-APPROVAL-DESIGN.md`. Existing delegation still checks matching vault prose, not a verified approval event. Do not start an Olympus delegation run before that boundary is implemented.
2. **Completion evidence:** a successful agent exit plus a collected diff currently becomes `complete`. Explicit verification and outcome contracts must replace that inference.
3. **Desktop acceptance:** demonstrate retrieval, source disclosure, persisted provenance, promotion approval/decline, and rereading new memory in the actual desktop app.
4. **Delegation acceptance:** after the approval design and implementation, demonstrate planning, checkpoint, isolated edit, verification, review, cancellation, and restart recovery.
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
