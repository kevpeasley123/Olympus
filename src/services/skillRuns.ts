import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isTauriRuntime } from "./launcher";

/** A skill the runner can execute (`commands/skill_runner.rs`). Listing one grants no execution authority. */
export interface SkillEntry { id: string; title: string; agent: string; engines: string[]; contract: { purpose: string; successCriteria: string; allowedCapabilities: string[]; loopBudget: number } }

export interface BriefItem { headline: string; why: string; actionNeeded: boolean; sources: { tool: string; reference: string }[] }
export interface BriefOutput { brief: string; coverage: string; items: BriefItem[] }

export interface SkillRun {
  id: string; skillId: string; skillVersion: number; engine: string; agent: string;
  status: "running" | "completed" | "failed";
  model: string | null; output: BriefOutput | null; error: string | null; toolCalls: number;
  startedAt: string; finishedAt: string | null;
}

export interface SkillRunState { skills: SkillEntry[]; runs: SkillRun[]; error: string | null }

/** Newest first, one row per run id; an update replaces the row it describes. */
export function mergeSkillRuns(current: readonly SkillRun[], incoming: readonly SkillRun[]): SkillRun[] {
  const byId = new Map<string, SkillRun>();
  for (const run of current) byId.set(run.id, run);
  for (const run of incoming) byId.set(run.id, run);
  return [...byId.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id));
}

export const latestRun = (runs: readonly SkillRun[], skillId: string) => runs.find(run => run.skillId === skillId) ?? null;

/** One line on where a run stands, in Olympus's voice. */
export function describeRun(run: SkillRun | null): string {
  if (!run) return "Not run yet.";
  if (run.status === "running") return "Running.";
  if (run.status === "failed") return `Stopped. ${run.error ?? "No reason recorded."}`;
  const calls = `${run.toolCalls} tool call${run.toolCalls === 1 ? "" : "s"}`;
  return `Finished with ${calls}${run.model ? ` on ${run.model}` : ""}.`;
}

let state: SkillRunState = { skills: [], runs: [], error: null };
const listeners = new Set<() => void>();
let started = false;
const set = (next: Partial<SkillRunState>) => { state = { ...state, ...next }; listeners.forEach(listener => listener()); };

function start() {
  if (started || !isTauriRuntime()) return;
  started = true;
  void listen<SkillRun>("agent-run-updated", event => set({ runs: mergeSkillRuns(state.runs, [event.payload]) })).catch(() => undefined);
  void Promise.all([invoke<SkillEntry[]>("skill_catalog"), invoke<SkillRun[]>("list_skill_runs", { limit: 20 })])
    .then(([skills, runs]) => set({ skills, runs: mergeSkillRuns(state.runs, runs), error: null }))
    .catch(() => { started = false; });
}

export function subscribeSkillRuns(listener: () => void) { listeners.add(listener); start(); return () => { listeners.delete(listener); }; }
export const skillRunsSnapshot = () => state;

/** Starts a run on an explicitly named engine. A refusal is shown, never retried elsewhere. */
export async function startSkillRun(skillId: string, engine: string) {
  try {
    const run = await invoke<SkillRun>("start_skill_run", { skillId, engine });
    set({ runs: mergeSkillRuns(state.runs, [run]), error: null });
  } catch (error) {
    set({ error: typeof error === "string" ? error : "The run could not be started." });
  }
}
/** Browser fixtures only. */
export function seedSkillRuns(next: Partial<SkillRunState>) { set(next); }
