import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isTauriRuntime } from "./launcher";

/** A skill the runner can execute (`commands/skill_runner.rs`). Listing one grants no execution authority. */
/** An Olympian's profile (`commands/agent_profiles.rs`): a role with a charter, a tool ceiling and a turn ceiling. */
export interface Olympian { id: string; name: string; title: string; tools: string[]; maxTurns: number; canDelegate: boolean; runsOn: string }
export interface SkillEntry { id: string; title: string; agent: string; olympian: Olympian | null; /** Whether the run may hand parts to other Olympians. */ orchestrates: boolean; engines: string[]; /** Whether a run needs Kevin's own question. */ takesRequest: boolean; contract: { purpose: string; successCriteria: string; allowedCapabilities: string[]; loopBudget: number } }

/** A citation. `verified` is false when the run never asked for or was shown what the reference names. */
export interface SourceRef { tool: string; reference: string; verified?: boolean }
export const describeSource = (source: SourceRef) => `${source.tool}: ${source.reference}${source.verified === false ? " (not confirmed against this run)" : ""}`;
export interface BriefItem { headline: string; why: string; actionNeeded: boolean; sources: SourceRef[] }
export interface BriefOutput { brief: string; coverage: string; items: BriefItem[] }
/** A part of a request the orchestrator handed to a specialist, as its own recorded run. */
export interface Handoff { agent: string; name: string; task: string; status: "completed" | "failed"; runId: string }
export interface AnswerOutput { answer: string; unknowns: string[]; sources: SourceRef[]; handoffs?: Handoff[] }

/** One line per hand-off: who took what, and whether it came back. */
export const describeHandoff = (handoff: Handoff) => `${handoff.name}${handoff.status === "failed" ? " did not finish" : " reported"}: ${handoff.task}`;
export interface Verdict { claim: string; verdict: "holds" | "partly_holds" | "does_not_hold" | "cannot_check"; basis: string; sources: SourceRef[] }
export interface VerdictOutput { summary: string; verdicts: Verdict[] }
export type SkillOutput = BriefOutput | AnswerOutput | VerdictOutput;
export const isVerdicts = (output: SkillOutput): output is VerdictOutput => "verdicts" in output;
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
    return true;
  } catch (error) {
    set({ error: typeof error === "string" ? error : "The run could not be started." });
    return false;
  }
}
/** `/ask <request>` (or `/zeus`): the explicit way to hand a request to Zeus. */
export function matchOperationRequest(text: string): string | null {
  const match = /^\/(?:ask|zeus)\s+([\s\S]+)$/i.exec(text.trim());
  return match && match[1].trim() ? match[1].trim() : null;
}

export interface ChatHandoff { skillId: "work-request" | "research-assignment" | "verification-assignment"; request: string; lead: string }
export interface EarlierTurn { role: string; content: string }
const CONTEXT_MARK = "\n\nEarlier in this conversation, for context:\n";
/** A run's request without the conversation context appended to it. */
export const requestHeadline = (request: string) => request.split(CONTEXT_MARK)[0];
const NAMED = /\b(?:have|ask|get|let|tell|send|bring in|loop in)\s+(athena|themis)\b|\b(?:hand|pass|give)\s+(?:this|that|it)\s+(?:over\s+)?to\s+(athena|themis)\b|^\s*@?(athena|themis)\s*[,:\u2014-]/gi;
const CHECK = /\b(?:have|get)\s+(?:it|this|that)\s+(?:double[- ]?checked|checked|verified)\b|\b(?:double[- ]?check|fact[- ]?check|verify)\s+(?:it|this|that)\b/i;
const withContext = (text: string, earlier: readonly EarlierTurn[]) => {
  const turns = earlier.slice(-2).map(turn => `${turn.role === "user" ? "Kevin" : "Olympus"}: ${turn.content.length > 2000 ? `${turn.content.slice(0, 2000)}…` : turn.content}`);
  return turns.length ? `${text}${CONTEXT_MARK}${turns.join("\n\n")}`.slice(0, 5900) : text;
};
/**
 * Whether a chat message asks for an Olympian, and which run that means.
 * Deliberately literal, because a hand-off costs engine runs: it matches a
 * message that addresses Athena or Themis, tells Olympus to use one, or asks
 * for something to be checked. Mentioning a name ("what does Themis do?") is
 * not asking for one. One named Olympian runs alone; both, or a check with
 * nothing yet to check, go to Zeus to orchestrate.
 */
export function matchChatHandoff(text: string, earlier: readonly EarlierTurn[] = []): ChatHandoff | null {
  const trimmed = text.trim();
  const explicit = matchOperationRequest(trimmed);
  if (explicit) return { skillId: "work-request", request: withContext(explicit, earlier), lead: "Zeus" };
  if (trimmed.startsWith("/")) return null;
  const named = new Set([...trimmed.matchAll(NAMED)].map(match => (match[1] ?? match[2] ?? match[3]).toLowerCase()));
  const request = withContext(trimmed, earlier);
  if (named.size > 1) return { skillId: "work-request", request, lead: "Zeus" };
  if (named.has("athena")) return { skillId: "research-assignment", request, lead: "Athena" };
  if (named.has("themis")) return { skillId: "verification-assignment", request, lead: "Themis" };
  if (!CHECK.test(trimmed)) return null;
  // "Double-check that" after an answer is a check of that answer. A question that ends
  // "have it checked" has no answer yet: Zeus gets one, then has it checked.
  const rest = trimmed.replace(CHECK, " ").split(/[^a-z']+/i).filter(Boolean);
  const followUp = rest.length <= 4 && earlier.some(turn => turn.role !== "user");
  return followUp ? { skillId: "verification-assignment", request, lead: "Themis" } : { skillId: "work-request", request, lead: "Zeus" };
}

/** Starts "Ask Olympus" and resolves with the run once it has finished or stopped. Rejects if it could not start. */
export async function runOperation(request: string | null, engine = "claude-code", skillId: ChatHandoff["skillId"] | "opening-brief" = "work-request"): Promise<SkillRun> {
  let started: SkillRun;
  try { started = await invoke<SkillRun>("start_skill_run", { skillId, engine, request }); }
  catch (error) {
    // One run per skill at a time. A run of this skill already in progress (started at app
    // open, or by a second click) is the one to wait for, not a reason to fail.
    const running = String(error).includes("already running") && skillId === "opening-brief"
      ? (await invoke<SkillRun[]>("list_skill_runs", { limit: 20 }).catch(() => [])).find(run => run.skillId === skillId && run.status === "running")
      : undefined;
    if (!running) throw error;
    started = running;
  }
  set({ runs: mergeSkillRuns(state.runs, [started]), error: null });
  return new Promise(resolve => {
    const settled = () => state.runs.find(run => run.id === started.id && run.status !== "running");
    // The update event is the normal path; the poll covers one that was missed.
    const poll = window.setInterval(() => void invoke<SkillRun[]>("list_skill_runs", { limit: 20 }).then(runs => set({ runs: mergeSkillRuns(state.runs, runs) })).catch(() => undefined), 4000);
    const check = () => { const run = settled(); if (run) { window.clearInterval(poll); unsubscribe(); resolve(run); } };
    const unsubscribe = subscribeSkillRuns(check);
    check();
  });
}

/** A finished operation as a chat reply: the answer, what stayed open, who checked it, and the sources. */
export function operationReply(run: SkillRun): string {
  if (run.status !== "completed" || !run.output || isBrief(run.output)) return `The operation stopped. ${run.error ?? "No reason was recorded."}`;
  const output = run.output;
  if (isVerdicts(output)) {
    const word = { holds: "Holds", partly_holds: "Partly holds", does_not_hold: "Does not hold", cannot_check: "Could not check" } as const;
    const lines = output.verdicts.map(verdict => `- ${word[verdict.verdict]}: ${verdict.claim} ${verdict.basis}`);
    const cited = output.verdicts.flatMap(verdict => verdict.sources).map(describeSource);
    return [output.summary, lines.join("\n"), cited.length ? `Sources: ${[...new Set(cited)].join("; ")}` : ""].filter(Boolean).join("\n\n");
  }
  const parts = [output.answer];
  if (output.unknowns.length) parts.push(`Not established: ${output.unknowns.join("; ")}`);
  if (output.handoffs?.length) parts.push(`Worked with: ${output.handoffs.map(handoff => `${handoff.name} (${handoff.status === "failed" ? "did not finish" : "reported"})`).join(", ")}`);
  if (output.sources.length) parts.push(`Sources: ${output.sources.map(describeSource).join("; ")}`);
  return parts.join("\n\n");
}

/** Browser fixtures only. */
export function seedSkillRuns(next: Partial<SkillRunState>) { set(next); }
