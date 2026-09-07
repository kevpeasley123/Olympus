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

export interface ApprovalProposal {
  id: string;
  sessionId: string;
  expiresAt: number;
  subject: {
    projectId: string; projectName: string; repository: string; baseCommit: string;
    driver: string; model: string; stage: string; task: string; criteria: string[];
    scope: string; runId: string; workspace: string; workspaceHash: string; plan: string;
  };
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
