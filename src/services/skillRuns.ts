import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isTauriRuntime } from "./launcher";

/** A skill the runner can execute (`commands/skill_runner.rs`). Listing one grants no execution authority. */
/** An Olympian's profile (`commands/agent_profiles.rs`): a role with a charter, a tool ceiling and a turn ceiling. */
export interface Olympian { id: string; name: string; title: string; tools: string[]; maxTurns: number; canDelegate: boolean; runsOn: string }
export interface SkillEntry { id: string; title: string; agent: string; olympian: Olympian | null; /** Whether the run may hand parts to other Olympians. */ orchestrates: boolean; engines: string[]; /** Whether a run needs Kevin's own question. */ takesRequest: boolean; contract: { purpose: string; successCriteria: string; allowedCapabilities: string[]; loopBudget: number } }

export interface BriefItem { headline: string; why: string; actionNeeded: boolean; sources: { tool: string; reference: string }[] }
export interface BriefOutput { brief: string; coverage: string; items: BriefItem[] }
/** A part of a request the orchestrator handed to a specialist, as its own recorded run. */
export interface Handoff { agent: string; name: string; task: string; status: "completed" | "failed"; runId: string }
export interface AnswerOutput { answer: string; unknowns: string[]; sources: { tool: string; reference: string }[]; handoffs?: Handoff[] }

/** One line per hand-off: who took what, and whether it came back. */
export const describeHandoff = (handoff: Handoff) => `${handoff.name}${handoff.status === "failed" ? " did not finish" : " reported"}: ${handoff.task}`;
export type SkillOutput = BriefOutput | AnswerOutput;
export const isBrief = (output: SkillOutput): output is BriefOutput => "brief" in output;

/** What Olympus observed an engine do, from run outcomes (`agent_usage`). A floor, not the account's meter. */
export interface EngineUsage { engine: string; runs: number; failed: number; seconds: number; inputTokens: number; outputTokens: number; reportedCostUsd: number }

/** One line of observed usage, naming a cost only when the engine reported one. */
export function describeUsage(usage: EngineUsage, label: string): string {
  const runs = `${usage.runs} run${usage.runs === 1 ? "" : "s"}`;
  const failed = usage.failed ? `, ${usage.failed} stopped` : "";
  const cost = usage.reportedCostUsd > 0 ? `, $${usage.reportedCostUsd.toFixed(2)} at API rates as reported` : "";
  return `${label}: ${runs}${failed}${cost}`;
}

export interface SkillRun {
  id: string; skillId: string; skillVersion: number; engine: string; agent: string;
  status: "running" | "completed" | "failed";
  parentRun: string | null;
  request: string | null; model: string | null; output: SkillOutput | null; error: string | null; toolCalls: number;
  startedAt: string; finishedAt: string | null;
}

export interface SkillRunState { skills: SkillEntry[]; runs: SkillRun[]; usage: EngineUsage[]; error: string | null }

/** Newest first, one row per run id; an update replaces the row it describes. */
export function mergeSkillRuns(current: readonly SkillRun[], incoming: readonly SkillRun[]): SkillRun[] {
  const byId = new Map<string, SkillRun>();
  for (const run of current) byId.set(run.id, run);
  for (const run of incoming) byId.set(run.id, run);
  return [...byId.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id));
}

/** The latest run Kevin started himself; hand-offs belong to their parent. */
export const latestRun = (runs: readonly SkillRun[], skillId: string) => runs.find(run => run.skillId === skillId && !run.parentRun) ?? null;

/** One line on where a run stands, in Olympus's voice. */
export function describeRun(run: SkillRun | null): string {
  if (!run) return "Not run yet.";
  if (run.status === "running") return "Running.";
  if (run.status === "failed") return `Stopped. ${run.error ?? "No reason recorded."}`;
  const calls = `${run.toolCalls} tool call${run.toolCalls === 1 ? "" : "s"}`;
  return `Finished with ${calls}${run.model ? ` on ${run.model}` : ""}.`;
}

let state: SkillRunState = { skills: [], runs: [], usage: [], error: null };
const USAGE_DAYS = 7;
const loadUsage = () => void invoke<EngineUsage[]>("agent_usage", { days: USAGE_DAYS }).then(usage => set({ usage })).catch(() => undefined);
const listeners = new Set<() => void>();
let started = false;
const set = (next: Partial<SkillRunState>) => { state = { ...state, ...next }; listeners.forEach(listener => listener()); };

function start() {
  if (started || !isTauriRuntime()) return;
  started = true;
  void listen<SkillRun>("agent-run-updated", event => { set({ runs: mergeSkillRuns(state.runs, [event.payload]) }); loadUsage(); }).catch(() => undefined);
  loadUsage();
  void Promise.all([invoke<SkillEntry[]>("skill_catalog"), invoke<SkillRun[]>("list_skill_runs", { limit: 20 })])
    .then(([skills, runs]) => set({ skills, runs: mergeSkillRuns(state.runs, runs), error: null }))
    .catch(() => { started = false; });
}

export function subscribeSkillRuns(listener: () => void) { listeners.add(listener); start(); return () => { listeners.delete(listener); }; }
export const skillRunsSnapshot = () => state;

/** Starts a run on an explicitly named engine. A refusal is shown, never retried elsewhere. */
export async function startSkillRun(skillId: string, engine: string, request?: string) {
  try {
    const run = await invoke<SkillRun>("start_skill_run", { skillId, engine, request: request?.trim() || null });
    set({ runs: mergeSkillRuns(state.runs, [run]), error: null });
  } catch (error) {
    set({ error: typeof error === "string" ? error : "The run could not be started." });
  }
}
/** Browser fixtures only. */
export function seedSkillRuns(next: Partial<SkillRunState>) { set(next); }
