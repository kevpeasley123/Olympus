# Automatic analysis readiness and resumption

Spec: ../specs/2026-11-02-automatic-understanding-correction.md.
Approved direction: ordinary use teaches Olympus; no categorization workflow.
Execution: inline, existing isolated worktree; one final independent review.

## Scope and constraints

Repair the automatic workers before expanding inference. Readiness is a local
preflight, never proof of working analysis. Preserve generation, acceptance,
account, source, temporary-chat and spending gates. No live calls, credentials,
installs, production database writes, push or merge. Use synthetic databases and
temporary vaults. Keep genuine failure budgets and backoff. Existing exhausted
rows cannot safely be reset from their last error alone: earlier failures may
have been real. Leave those rows unchanged pending a separately evidenced repair.

## Task 1: shared preflight

Expose state, stable code, reason and canAttempt from subscription job readiness.
Email configuration uses the same contract and local-model validation as execution.
Check preflight before recording a model request. A blocked/configuration result
is distinguishable from an attempted inference failure by exact error codes.

Tests first: unsupported local names cannot appear attemptable; blocked jobs
create no model request; acceptance never permits a local or subscription call.
Run focused offline Rust tests; expect failing behavioral assertions, then green.

## Task 2: automatic worker recovery

Chat tick excludes blocked learning from its due-query while continuing archiving;
pending chats resume when readiness allows, without toggling settings. Recheck at
execution to handle eligibility changes. A block between selection and execution
does not consume a failure. Status separates pending work, readiness and genuine
stopped attempts. Email preflights before vault/model work; waiting outcomes leave
real backoff unchanged. Existing request/source guards remain authoritative.

Use an injected analyzer only at the inference boundary. Synthetic quiet chats
must archive while blocked, retain watermarks, later persist learned memory and
summary automatically, expose the same bounded memory text used by recall, and
avoid duplicate analysis. Real failures retain backoff/caps. Email waiting must
not increment failure counts or claim successful completion. Run focused tests
RED then GREEN and full offline Rust suite.

## Task 3: truthful status and handoff

Update the existing Memory preferences status, without adding controls: pending
versus learning, blocked reason, and accurate single-provider wording. Add focused
browser coverage and inspect screenshots; run build, all test scripts and full
visual regression. Update feature docs and handoff. Commit this local checkpoint
after review and preserve the shared Obsidian milestone record.

## Follow-on sequence

Then extend offline conversation/project/email scenarios through useful briefs,
connect natural conversational corrections with provenance, and qualify the
authorized analyzer. After that sequence, audit Obsidian memory end to end:
capture, persistence, indexing/retrieval, source freshness, conflict handling,
explicit corrections, temporary exclusions, and actual consumption in both briefs
and conversation. Notes existing on disk is insufficient evidence of integration.
Live Gmail/native acceptance and optional tray persistence remain later work.

## Review focus

Check gate races, false success timestamps, retry starvation, account isolation,
real failure budgets, local configuration parity, temporary exclusion and authored
vault edits. Distinguish synthetic pipeline evidence from real model quality.
Review existing stopped rows conservatively; do not infer all historical failures
were harmless from the latest error. Current factual briefs do not yet consume
the Obsidian memory note; do not claim this checkpoint fixes that integration.
