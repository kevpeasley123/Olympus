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

export function startDelegationRun(projectId: string, task: string): Promise<DelegationRun> {
  return invoke<DelegationRun>("start_delegation_run", {
    request: { projectId, task }
  });
}

export function resumeDelegationRun(runId: string): Promise<DelegationRun> {
  return invoke<DelegationRun>("resume_delegation_run", {
    request: { runId }
  });
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
