# Coding-agent delegation contract

This document defines the recoverable boundary Olympus uses to launch Claude
Code, Codex, or another coding agent. The first registered pilot driver is
Claude Code on Windows; driver selection remains explicit rather than
automatic. The version is not pinned: it is read when a proposal is prepared and
recorded with the run. The pilot was written against 2.1.220; the installed
executable reported 2.1.222 in the September 23, 2026 audit.

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
  -> awaiting_review
  -> complete

Any active phase -> waiting
Any active phase -> failed
Approved or active -> cancelled
```

`waiting` always names what is needed and who can provide it. `complete` means
the approved outcome is actually achieved, not merely that an agent stopped.

## Isolation and recovery

- Work starts from a known commit in a dedicated worktree and branch.
- Existing uncommitted project work is never adopted silently. Olympus refuses
  to prepare a run while the primary checkout has uncommitted work; the operator
  commits or stashes it first. There is no in-app protect action.
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
inside the isolated worktree. The worktree isolates changes from the primary
checkout; it does not isolate processes (see Containment and residual risk).

## Driver boundary

The Tauri backend owns process launch. The webview selects only a registered
driver ID and run ID; it never supplies an executable, shell command, or raw
argument string.

Each driver adapter must:

1. confirm its executable and version;
2. build fixed arguments in Rust;
3. constrain the working directory to the run workspace;
4. pass only the minimum required environment (for Claude Code, an allowlist that
   includes `ANTHROPIC_API_KEY` when set; for checks, an allowlist without keys);
5. emit structured phase, milestone, checkpoint, and completion events;
6. distinguish process output from user-facing progress;
7. terminate cleanly and report whether child processes remain.

Raw chain-of-thought is neither requested nor displayed. The activity surface
shows observable actions and milestones: planning, editing named areas, running
checks, reviewing, waiting, complete, or failed.

## First driver

Claude Code is the pilot driver. Its native executable is resolved from
one backend-owned location beneath `APPDATA`; the webview cannot choose a
program or arguments. The adapter uses structured streaming output, a fixed
UUID session, a $5 budget per launch, a 45-minute wall-clock limit per launch,
and a two-stage permission boundary:

1. A read-only planning run creates the isolated branch/worktree and ends in
   `waiting`.
2. A second operator approval resumes that same session with a bounded set of
   edit and local verification tools.

The $5 budget is Claude Code's `--max-budget-usd`, which applies to one launch.
Planning, implementation and every resume are separate launches, and Olympus
keeps no spend ledger across them, so a run's total can exceed $5.

Every launch passes an exact built-in tool inventory (`--tools`: `Read,Glob,Grep`
for planning; `Read,Glob,Grep,Edit,Write,Bash` for implementation, with
`--allowedTools` pre-approving only `git status`, `npm run build`, `npm test`,
`cargo test` and `cargo check` under `dontAsk`), loads no user, project or local
settings (`--setting-sources ""`, so no hooks, MCP servers or allow rules from
settings files), and loads no MCP servers (`--strict-mcp-config` with an empty
config). Arguments end with `--` so the variadic tool lists cannot swallow the
prompt. The empty `--setting-sources` value was verified against Claude Code
2.1.283; it is not yet confirmed on the installed driver (2.1.222 at the last
audit). It also stops an `apiKeyHelper` in user settings from loading.

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

The backend stores the Claude process ID and, beside it in `delegation_events`,
the process creation time. Cancellation terminates the full Windows process tree
so a child test runner does not survive invisibly; restart recovery reports a
recorded process as still present only while both the ID and the creation time
match, so a reused ID is never reported as running or killed. Each Claude
launch and each verification check is assigned to a Windows Job Object with
kill-on-close: when the process exits, leftover descendants are stopped, and
when Olympus exits or crashes the whole tree is stopped with it. Job assignment
happens just after spawn, so a descendant started in that instant could escape
it. A launch that exceeds 45 minutes is stopped the same way as a cancellation
and recorded as failed. If Olympus stops during a verification check, recovery
returns the run to `awaiting_review` and records that check as interrupted.

## Containment and residual risk

The worktree is a directory, not a sandbox. The tool, settings and MCP limits
above constrain what Claude Code offers the model; they do not confine the
processes it runs. In particular:

- `npm run build`, `npm test`, `cargo test` and `cargo check` execute
  repository-controlled code (`package.json` scripts, `build.rs`, test code,
  Cargo config). The agent can edit that code with `Edit`/`Write` and then run
  it, which is arbitrary execution as the operator's Windows user, with network
  access and the user's filesystem permissions.
- The Claude process receives `ANTHROPIC_API_KEY` (when set) because it needs
  it to call the model. Code the agent runs inherits that environment.
- The operator's **Run check** buttons run the same repository scripts again,
  outside Claude Code. The check runner clears its environment and passes only
  an allowlist (`PATH`, system and temp directories, the user profile and app
  data directories, `CARGO_HOME`, `RUSTUP_HOME`, plus a per-project
  `CARGO_TARGET_DIR`). No API key reaches it. The buttons are labelled as
  running agent-written code.
- The per-project `CARGO_TARGET_DIR` under Olympus app data is shared by that
  project's runs to avoid cold builds, so build output from one run can be
  reused by a later one.
- Checks that do not apply to a worktree are reported as not applicable, and
  missing `node_modules` is reported as such. Olympus does not install
  dependencies, because install scripts would run code from the agent's
  `package.json`.

Real containment would need an OS boundary such as Windows Sandbox or an
AppContainer with no network access. That is not implemented. Until it is,
delegate only to repositories whose content you trust, and review the diff
before running any check.

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

## 0.3.0 implementation

Vault next actions are context only. The operator edits a task and acceptance criteria,
reviews a backend proposal valid for ten minutes, and explicitly approves planning.
Implementation requires a separate review of the persisted plan and workspace.
Approval records are immutable and consumed once before launch. Restart requires fresh
review; cancellation preserves the workspace and revokes pending scope.

An agent result ends at `awaiting_review`. The review UI records fixed build/test checks
and per-criterion evidence against a workspace fingerprint. Completion requires an
explicit operator review; latest failed or stale checks block completion. Manual evidence
is recorded as manual evidence. The app does not infer that every project needs the
same checks. See `OPERATOR-APPROVAL-DESIGN.md` for limits and pilot acceptance work.
