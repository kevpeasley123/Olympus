# Coding-agent delegation contract

This document defines the recoverable boundary Olympus needs before it can
launch Claude Code, Codex, or another coding agent. It deliberately does not
choose the first driver. Driver selection is a product and security checkpoint,
not an implementation detail.

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

## First driver decision

Before implementation, verify which installed interface is stable enough to
control non-interactively on this Windows machine:

- Codex command-line or app automation;
- Claude Code command-line;
- another explicitly registered local driver.

Choose one pilot driver manually. Auto-routing belongs after Olympus can prove
that one end-to-end run is trustworthy and recoverable.

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
