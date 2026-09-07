# Verifiable operator approval

Status: implemented for 0.3.0. The boundary is covered by backend tests; a live desktop delegation pilot remains acceptance work.

## Problem and resulting behavior

Previously a task matching `next_step` passed the delegation check. An agent can write that prose, so the check could not establish operator consent. In 0.3.0, a vault commitment is planning context only. Starting or resuming an agent requires a backend-created approval event for the exact displayed task and execution scope.

Example: approving “Add bounded research retrieval” for project Olympus at commit A does not authorize a reworded task, project Pokedex, a different base commit, a different driver, or implementation of a plan that was never reviewed.

## Records

Add immutable `operator_approvals` rows with:

- `id`, backend timestamp, and the current backend-owned desktop session ID;
- project ID, canonical repository path, base commit, fixed driver/model ID;
- stage (`plan` or `implement`), exact task text, and scope/version;
- SHA-256 of the exact UTF-8 task text (no whitespace collapsing);
- for implementation, run ID, plan content hash, and workspace identity;
- reference to a separate consumption record binding the event to one run/stage.

Revocation is another event, not an edit of the original. Creation, consumption, and revocation all preserve an audit trail. Missing database history cannot be reconstructed from Markdown claims.

## Operator interaction and backend boundary

1. Project mode displays the proposed task and distinguishes “unverified commitment” from a verified approval.
2. **Prepare run** asks Rust to create a short-lived pending proposal. Rust resolves project, base, driver, task and scope; the webview cannot supply an executable or substitute these values during approval.
3. The desktop review displays the exact task, project, base, driver, permitted stage, and recovery location. The operator chooses **Approve planning** or **Cancel**.
4. Approval resolves only that pending proposal, in the current desktop session, before its expiry. Rust stamps and records it. Unknown, expired, replayed, cancelled, or mismatched requests deny.
5. Starting the run consumes approval transactionally before process launch. If worktree or process preparation fails, preserve the failed attempt and recovery information; do not silently reuse approval for another run.
6. Implementation requires another pending proposal showing the completed plan, changed scope if any, and permitted edit/test actions. **Approve implementation** records a separately bound event.

A session ID provided by the webview is not proof of a desktop launch. The backend must own the current session token; persisted session rows provide history, not live caller authentication.

## Validation and recovery

At both start and resume, verify project, repository, base, task bytes, stage, driver, plan (when applicable), session, expiry, revocation, and unused status. Failure creates no agent process. Editing task text invalidates an earlier approval. Approval is never inferred from the agent's output or from a note's contents.

After restart, show preserved work and the interrupted state. Require a new review before resuming; do not mint approval from a stored run. Cancellation revokes unused proposals and stops the existing process tree, preserving the worktree and diff.

Vault fields may reference an approval ID for display, but are not required for authorization. The UI derives approval status from SQLite. No writer emits “Kevin approved” prose. Existing generic vault writers never gain an approval-record creation capability. Chat memory can quote a claim about approval; that quotation has zero execution authority.

## Completion must also become evidence-based

An agent's successful exit means `awaiting_review`, not `complete`. A run records the requested outcome, criteria, actual checks with exit codes, changed files against the base (including new and committed files), and unresolved issues. Completion requires criteria mapped to evidence. Agent assertions are attributed as assertions; deterministic checks and operator review remain distinct evidence types. Push, merge, deploy, and destructive cleanup remain separate actions.

## Scope of protection

This prevents editable Markdown and generated prose from impersonating approval. It does not cryptographically prove a physical human clicked: a compromised webview, same-user process with database access, or sufficiently privileged UI automation remains outside this boundary. The app should not advertise stronger identity guarantees than it implements.

Losing SQLite loses verifiability and requires fresh approval. This deliberately trades convenience for an honest boundary. It does not require cloud identity or an orchestration framework.

## Acceptance tests before any pilot run

- Fabricated vault approval prose and a nonexistent approval ID both deny before worktree/process creation.
- Mutating one task character, project, base, driver, stage, or plan invalidates approval.
- Unknown session, timeout, cancellation, revocation, and replay deny.
- Two simultaneous start requests cannot consume one approval twice.
- Restart preserves partial work and requires fresh review before resumption.
- A failed process launch is recorded without silently returning reusable approval.
- An agent claiming “done” without required evidence cannot become complete.
- Diff collection includes committed changes and untracked files.
- A real desktop pilot demonstrates approval, checkpoint, edit, checks, review, cancellation, and recovery without push or merge.

## Implementation boundary

Individual delegated tasks require the in-app review flow. Installing this mechanism does not approve a task. Approval and consumption are recorded together before launch; failed launches require new approval. Verification records bind to the workspace fingerprint. Manual artifact or behavior review is explicitly labelled and does not claim an automated test ran.
