# Coding-agent delegation contract

This document defines the recoverable boundary Olympus uses to launch Claude
Code, Codex, or another coding agent. The first registered pilot driver is
Claude Code 2.1.220 on Windows; driver selection remains explicit rather than
automatic.

## Pilot outcome

From a project briefing, Kevin can approve a bounded task. Olympus creates an
isolated workspace, launches one known coding-agent driver, shows meaningful
progress, pauses at critical decisions, and returns a reviewable result with a
clear recovery path.

The pilot does not auto-route between models, deploy, push, merge, delete human
work, or run arbitrary command text supplied by the frontend.

## Run record

Every delegated run needs durable, inspectable state:

| Field | Meaning |
| --- | --- |
| Run ID | Stable identifier for events and recovery |
| Project ID | One tracked project, resolved by Olympus |
| Task | The approved outcome in plain language |
| Driver | A fixed registered adapter such as Codex or Claude Code |
| Model | Model selected by the adapter, if exposed |
| Phase | Current state from the state machine below |
| Workspace | Isolated worktree or equivalent sandbox |
| Branch | Dedicated, attributable branch |
| Started / updated | Honest elapsed time and liveness |
| Milestone | Latest meaningful progress statement |
| Checkpoint | Decision or approval currently needed |
| Recovery | How to inspect, keep, or abandon the result |
| Outcome | Summary, verification evidence, changed files, and remaining risk |

## State machine

```text
proposed
  -> approved
  -> preparing
  -> planning
  -> editing
  -> testing
  -> reviewing
  -> complete

Any active phase -> waiting
Any active phase -> failed
Approved or active -> cancelled
```

`waiting` always names what is needed and who can provide it. `complete` means
the approved outcome is actually achieved, not merely that an agent stopped.

## Isolation and recovery

- Work starts from a known commit in a dedicated worktree and branch.
- Existing uncommitted project work is never adopted silently. Olympus pauses
  and offers to protect it or choose a clean base.
- The run records the base commit, branch, and workspace before editing begins.
- Agent commits remain attributable to the run.
- Push, merge, deploy, and deletion stay separate operator-approved actions.
- Abandoning a run should preserve the branch by default. Destruction requires
  explicit confirmation and a precise target.

## Checkpoints

Olympus pauses before:

- a better direction conflicts with the current project vision;
- requirements are materially ambiguous;
- architecture or visual language would change;
- external communication, push, deployment, or purchase;
- overwriting or deleting human work;
- expanding the task beyond the approved outcome;
- continuing after verification reveals a broader defect.

Ordinary file edits, local tests, and small implementation choices may proceed
inside the isolated boundary.

## Driver boundary

The Tauri backend owns process launch. The webview selects only a registered
driver ID and run ID; it never supplies an executable, shell command, or raw
argument string.

Each driver adapter must:

1. confirm its executable and version;
2. build fixed arguments in Rust;
3. constrain the working directory to the run workspace;
4. pass only the minimum required environment;
5. emit structured phase, milestone, checkpoint, and completion events;
6. distinguish process output from user-facing progress;
7. terminate cleanly and report whether child processes remain.

Raw chain-of-thought is neither requested nor displayed. The activity surface
shows observable actions and milestones: planning, editing named areas, running
checks, reviewing, waiting, complete, or failed.

## First driver

Claude Code 2.1.220 is the pilot driver. Its native executable is resolved from
one backend-owned location beneath `APPDATA`; the webview cannot choose a
program or arguments. The adapter uses structured streaming output, a fixed
UUID session, a $5 run ceiling, and a two-stage permission boundary:

1. A read-only planning run creates the isolated branch/worktree and ends in
   `waiting`.
2. A second operator approval resumes that same session with a bounded set of
   edit and local verification tools.

The bundled Codex executable is not used because Windows currently refuses
standalone execution. Auto-routing belongs after this one driver proves its
end-to-end behavior.

## Implementation map

- Durable run and event records: SQLite `delegation_runs` and
  `delegation_events`.
- Driver, worktree creation, progress parsing, cancellation, recovery, and diff:
  `src-tauri/src/commands/delegation.rs`.
- Proposal, checkpoint, progress, cancellation, and review surface:
  `src/components/panels/DelegationPanel.tsx`.
- Entry point: **Prepare Claude run** beside a real committed next action in
  Project mode.

The process boundary, persistence, state transitions, frontend build, and unit
tests are verified. A real paid Claude run and its human checkpoint remain the
acceptance test; Olympus does not initiate that run without the operator's
button press.

The backend stores the Claude process ID. Cancellation terminates the full
Windows process tree so a child test runner does not survive invisibly; restart
recovery reports whether that recorded process is still present before allowing
the run to resume.

## Acceptance evidence

The first delegation path is not complete until it demonstrates:

1. an approved task tied to a tracked project;
2. clean worktree creation from a recorded base;
3. visible phase and milestone changes;
4. at least one pause/resume checkpoint;
5. a real edit and relevant verification;
6. an outcome summary that matches the diff;
7. preservation of the result without pushing or merging;
8. a tested cancellation and recovery path.
