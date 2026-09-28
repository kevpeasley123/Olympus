import { invoke } from "@tauri-apps/api/core";

export type DelegationPhase =
  | "proposed"
  | "approved"
  | "preparing"
  | "planning"
  | "editing"
  | "testing"
  | "reviewing"
  | "waiting"
  | "awaiting_review"
  | "complete"
  | "failed"
  | "cancelled";

export interface DelegationRun {
  id: string;
  projectId: string;
  projectName: string;
  task: string;
  driver: string;
  model: string;
  phase: DelegationPhase;
  workspace: string;
  branch: string;
  baseCommit: string;
  agentSessionId: string;
  processId: number | null;
  milestone: string;
  checkpoint: string | null;
  outcome: string | null;
  changedFiles: string[];
  diffSummary: string | null;
  error: string | null;
  startedAt: string;
  updatedAt: string;
}

export function listDelegationRuns(): Promise<DelegationRun[]> {
  return invoke<DelegationRun[]>("list_delegation_runs");
}

/**
 * What an approval scope allows, derived in Rust from the same constants the
 * launch uses. Display only: the approval binds `subject.scope`.
 */
export interface PermittedActions {
  tools: string[];
  commands: string[];
  edits: boolean;
  budgetUsd: string;
  launchLimitMinutes: number;
  excluded: string[];
}

export interface ApprovalProposal {
  id: string;
  sessionId: string;
  /** Unix seconds. */
  expiresAt: number;
  subject: {
    projectId: string; projectName: string; repository: string; baseCommit: string;
    driver: string; model: string; stage: string; task: string; criteria: string[];
    scope: string; runId: string; workspace: string; workspaceHash: string; plan: string;
  };
  /** Null when this build does not recognise the scope; show `subject.scope` raw. */
  permitted: PermittedActions | null;
  baseBranch: string | null;
}

export interface CheckEvidence {
  id: string;
  checkName: string;
  exitCode: number | null;
  output: string;
  /** Empty when the workspace changed while the check ran. */
  workspaceHash: string;
  startedAt?: string;
  finishedAt?: string;
}
export interface CheckOption { id: string; label: string; unavailable: string | null }
export interface ReviewDetails {
  criteria: string[];
  plan: string;
  /** Newest first. */
  checks: CheckEvidence[];
  approvals: string[];
  availableChecks: CheckOption[];
  reviewedAt: string | null;
}

/** Read-only: the recorded contract, plan and evidence. Creates no proposal. */
export function fetchDelegationReview(runId: string): Promise<ReviewDetails> {
  return invoke<ReviewDetails>("fetch_delegation_review", { request: { runId } });
}
export function fetchReviewFingerprint(runId: string): Promise<string> {
  return invoke<string>("delegation_review_fingerprint", { request: { runId } });
}
export function runDelegationCheck(runId: string, checkId: string): Promise<CheckEvidence> {
  return invoke<CheckEvidence>("run_delegation_check", { request: { runId, checkId } });
}
export function completeDelegationReview(request: {
  runId: string; workspaceHash: string; unresolvedIssues: string;
  evidence: { criterion: string; note: string; checkId: string | null }[];
}): Promise<DelegationRun> {
  return invoke<DelegationRun>("complete_delegation_review", { request });
}
export function prepareDelegationRun(projectId: string, task: string, criteria: string[]): Promise<ApprovalProposal> {
  return invoke("prepare_delegation_run", { request: { projectId, task, criteria } });
}
export function prepareDelegationResume(runId: string): Promise<ApprovalProposal> {
  return invoke("prepare_delegation_resume", { request: { runId } });
}
export function cancelDelegationProposal(proposalId: string): Promise<void> {
  return invoke("cancel_delegation_proposal", { proposalId });
}
export function startDelegationRun(proposalId: string): Promise<DelegationRun> {
  return invoke("start_delegation_run", { request: { proposalId } });
}
export function resumeDelegationRun(proposalId: string): Promise<DelegationRun> {
  return invoke("resume_delegation_run", { request: { proposalId } });
}

export function cancelDelegationRun(runId: string): Promise<DelegationRun> {
  return invoke<DelegationRun>("cancel_delegation_run", {
    request: { runId }
  });
}

export function fetchDelegationDiff(runId: string): Promise<string> {
  return invoke<string>("fetch_delegation_diff", {
    request: { runId }
  });
}
