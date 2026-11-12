import type { AgentEvent } from "./agentEvents";
import { groupAgentRuns } from "./agentEvents";
import type { AnswerOutput, SkillEntry, SkillRun } from "./skillRuns";
import { isBrief } from "./skillRuns";

/**
 * The Activity Deck's whole model, derived from recorded state and nothing
 * else: skill runs (`agent_runs`), the agent event stream (`agent_events`) and
 * the plan event an orchestrated run records. Nothing here estimates. Progress
 * exists only as counted stages of an accepted plan; an activity line is the
 * latest recorded step, reworded; a state with no evidence is not shown.
 */
export type DeckStatus = "running" | "coordinating" | "queued" | "blocked" | "completed" | "failed";
export interface DeckStep { id: number; text: string; at: string }
export interface DeckAgent {
  agent: string;
  status: DeckStatus;
  /** One line on what this Olympian is doing or did, from the latest recorded step. */
  activity: string;
  runId: string | null;
  /** The task it was given, in the words of whoever gave it. */
  assignment: string | null;
  recent: DeckStep[];
  finding: string | null;
  error: string | null;
}
export interface DeckOperation {
  id: string;
  title: string;
  status: "running" | "completed" | "failed";
  line: string;
  /** Counted stages of an accepted plan. Null when the run has no stages to count. */
  progress: { done: number; total: number } | null;
  startedAt: string;
  finishedAt: string | null;
  /** The skill run behind it, when there is one; other work is known only by its events. */
  run: SkillRun | null;
  /** Other operations in progress at the same time. */
  alsoRunning: number;
}
export interface Deck { operation: DeckOperation | null; agents: DeckAgent[] }

/** The role each Olympian fills, as the deck names it. Mirrors `commands/agent_profiles.rs`. */
export const DECK_ROLES: Readonly<Record<string, { name: string; role: string }>> = {
  olympus: { name: "Zeus", role: "Orchestration" },
  research: { name: "Athena", role: "Research & Analysis" },
  verification: { name: "Themis", role: "Verification" },
  "coding-delegate": { name: "Hephaestus", role: "Systems Engineering" },
  dionysus: { name: "Dionysus", role: "Creative Strategy" },
};
export const deckName = (agent: string) => DECK_ROLES[agent]?.name ?? agent;

const noteName = (path: string) => path.split(/[\\/]/).pop()?.replace(/\.md$/i, "") ?? path;
const clip = (text: string, limit: number) => text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;

/** A recorded step in plain words. Unknown steps keep the backend's own summary. */
export function describeStep(event: AgentEvent): string {
  const tool = event.tool?.replace(/^mcp__olympus__/, "") ?? "";
  if (event.kind === "tool_failed") return event.summary;
  switch (tool) {
    case "search_mail": return "Searching recent mail";
    case "read_mail_thread": return "Reading a mail thread";
    case "recall_memory": return "Checking learned memory";
    case "search_vault": return "Searching the vault";
    case "read_vault_note": return event.path ? `Reading ${clip(noteName(event.path), 46)}` : "Reading a vault note";
    case "list_projects": return "Reviewing the project list";
  }
  switch (event.kind) {
    case "run_started": return event.summary;
    case "thinking": return "Thinking it through";
    case "message": return event.summary.endsWith("reported back") ? event.summary : "Writing up";
    case "file_read": return event.path ? `Reading ${clip(noteName(event.path), 46)}` : event.summary;
    case "plan": case "subagent_started": case "result": case "error": return event.summary;
    default: return event.summary;
  }
}

interface PlannedPart { agent: string; name: string; task: string }
function plannedParts(events: readonly AgentEvent[]): PlannedPart[] | null {
  const plan = [...events].reverse().find(event => event.kind === "plan");
  if (!plan) return null;
  try {
    const parts: unknown = JSON.parse(plan.detail ?? "[]");
    return Array.isArray(parts) ? parts.filter((part): part is PlannedPart => typeof part?.agent === "string" && typeof part?.task === "string") : [];
  } catch { return []; }
}

const finding = (run: SkillRun): string | null => {
  const output = run.output as (AnswerOutput & { summary?: string }) | null;
  if (!output) return null;
  if (isBrief(output)) return output.brief;
  return output.summary ?? output.answer ?? null;
};
const steps = (events: readonly AgentEvent[]): DeckStep[] =>
  events.filter(event => event.kind !== "thinking").slice(-5).map(event => ({ id: event.id, text: describeStep(event), at: event.createdAt }));
const lastStep = (events: readonly AgentEvent[], fallback: string) => events.length ? describeStep(events[events.length - 1]) : fallback;

function operationTitle(run: SkillRun, skills: readonly SkillEntry[]): string {
  const title = skills.find(skill => skill.id === run.skillId)?.title ?? run.skillId;
  return run.request ? clip(run.request.replace(/\s+/g, " "), 90) : title;
}

function fromSkillRun(root: SkillRun, runs: readonly SkillRun[], events: readonly AgentEvent[], skills: readonly SkillEntry[]): { operation: Omit<DeckOperation, "alsoRunning">; agents: DeckAgent[] } {
  const own = events.filter(event => event.runId === root.id);
  const children = runs.filter(run => run.parentRun === root.id).sort((a, b) => a.id.localeCompare(b.id));
  const plan = plannedParts(own);
  const running = root.status === "running";
  const working = children.find(child => child.status === "running");
  const settled = children.filter(child => child.status !== "running").length;

  const agents: DeckAgent[] = [];
  const lead = deckName(root.agent);
  const leadLine = !running ? (root.status === "completed" ? "Delivered the answer" : "Stopped before an answer")
    : working ? `Waiting on ${deckName(working.agent)}`
    : plan === null ? lastStep(own, "Starting")
    : plan.length && settled >= plan.length ? "Writing the answer from the reports"
    : lastStep(own, "Starting");
  agents.push({
    agent: root.agent, runId: root.id, assignment: root.request,
    status: !running ? (root.status === "completed" ? "completed" : "failed") : working ? "coordinating" : "running",
    activity: leadLine, recent: steps(own), finding: root.status === "completed" ? finding(root) : null, error: root.error,
  });
  for (const child of children) {
    const theirs = events.filter(event => event.runId === child.id);
    const task = plan?.[children.indexOf(child)]?.task ?? null;
    agents.push({
      agent: child.agent, runId: child.id, assignment: task,
      status: child.status === "running" ? "running" : child.status,
      activity: child.status === "running" ? lastStep(theirs, `Took a hand-off from ${lead}`) : child.status === "completed" ? `Reported back to ${lead}` : "Did not finish",
      recent: steps(theirs), finding: child.status === "completed" ? finding(child) : null, error: child.error,
    });
  }
  // Planned but not yet started: only while the run that planned them is still going.
  if (running) for (const part of (plan ?? []).slice(children.length)) {
    agents.push({ agent: part.agent, runId: null, assignment: part.task, status: "queued", activity: `Queued behind ${children.length ? deckName(children[children.length - 1].agent) : lead}`, recent: [], finding: null, error: null });
  }

  // Stages are countable only once a plan with hand-offs is accepted: the plan, each hand-off, the answer.
  const total = plan && plan.length ? plan.length + 2 : 0;
  const done = total ? (running ? 1 + settled : total) : 0;
  const line = running ? (working ? `${deckName(working.agent)} is working` : plan === null ? `${lead} is planning` : plan.length ? (settled >= plan.length ? `${lead} is writing the answer` : `${lead} is coordinating`) : `${lead} is answering`)
    : root.status === "completed" ? "Completed" : `Stopped. ${clip(root.error ?? "No reason recorded.", 120)}`;
  return {
    operation: { id: root.id, title: operationTitle(root, skills), status: root.status, line, progress: total && root.status !== "failed" ? { done, total } : null, startedAt: root.startedAt, finishedAt: root.finishedAt, run: root },
    agents,
  };
}

/**
 * The deck for now. The operation shown is the newest one in progress, or else
 * the most recent finished one, kept so its result stays one click away. Work
 * that reached the event stream without a skill run (a briefing job, a coding
 * delegation) appears from its events alone.
 */
export function buildDeck(runs: readonly SkillRun[], events: readonly AgentEvent[], skills: readonly SkillEntry[] = []): Deck {
  const roots = runs.filter(run => !run.parentRun);
  const skillRunIds = new Set(runs.map(run => run.id));
  const loose = groupAgentRuns(events).filter(group => !skillRunIds.has(group.runId));

  type Candidate = { startedAt: string; active: boolean; build: () => { operation: Omit<DeckOperation, "alsoRunning">; agents: DeckAgent[] } };
  const candidates: Candidate[] = [
    ...roots.map(root => ({ startedAt: root.startedAt, active: root.status === "running", build: () => fromSkillRun(root, runs, events, skills) })),
    ...loose.map(group => {
      const first = group.events[0], last = group.events[group.events.length - 1];
      const failed = !group.active && last.kind === "error";
      const status = group.active ? "running" as const : failed ? "failed" as const : "completed" as const;
      return { startedAt: first.createdAt, active: group.active, build: () => ({
        operation: { id: group.runId, title: clip(first.summary, 90), status, line: group.active ? `${deckName(group.agent)} is working` : failed ? clip(last.summary, 120) : "Completed", progress: null, startedAt: first.createdAt, finishedAt: group.active ? null : last.createdAt, run: null },
        agents: [{ agent: group.agent, runId: group.runId, assignment: first.summary, status, activity: group.active ? lastStep(group.events, "Working") : failed ? "Did not finish" : "Finished", recent: steps(group.events), finding: null, error: failed ? last.summary : null }],
      }) };
    }),
  ];
  if (!candidates.length) return { operation: null, agents: [] };
  const newest = (a: Candidate, b: Candidate) => b.startedAt.localeCompare(a.startedAt);
  const active = candidates.filter(candidate => candidate.active).sort(newest);
  const chosen = active[0] ?? [...candidates].sort(newest)[0];
  const built = chosen.build();
  const agents = [...built.agents];
  // Concurrent operations: their agents are working too, and are shown as such.
  for (const other of active.slice(1)) for (const agent of other.build().agents) {
    if ((agent.status === "running" || agent.status === "coordinating") && !agents.some(shown => shown.agent === agent.agent)) agents.push(agent);
  }
  return { operation: { ...built.operation, alsoRunning: Math.max(0, active.length - 1) }, agents };
}

export const STATUS_LABEL: Readonly<Record<DeckStatus, string>> = { running: "Running", coordinating: "Coordinating", queued: "Queued", blocked: "Blocked", completed: "Completed", failed: "Failed" };
export const isLive = (status: DeckStatus) => status === "running" || status === "coordinating" || status === "queued" || status === "blocked";

export interface DeckStage { label: string; state: "done" | "active" | "pending" | "failed" }
/**
 * The operation as a short checklist, for the mission brief. Only an accepted
 * plan with hand-offs has stages; anything else is one line and gets none.
 */
export function deckStages(deck: Deck): DeckStage[] {
  const operation = deck.operation;
  if (!operation?.progress || !operation.run) return [];
  const [lead, ...others] = deck.agents.filter(agent => agent.runId === operation.id || agent.runId?.startsWith(`${operation.id}-`) || agent.runId === null);
  if (!lead) return [];
  const over = operation.status !== "running";
  const stage = (status: DeckStatus): DeckStage["state"] => status === "completed" ? "done" : status === "failed" ? "failed" : status === "queued" ? "pending" : "active";
  const settled = others.every(agent => agent.status === "completed" || agent.status === "failed");
  return [
    { label: `${deckName(lead.agent)} planned the work`, state: "done" },
    ...others.map(agent => ({ label: `${deckName(agent.agent)}: ${DECK_ROLES[agent.agent]?.role.toLowerCase() ?? "assignment"}`, state: stage(agent.status) })),
    { label: `${deckName(lead.agent)} writes the answer`, state: over ? (operation.status === "completed" ? "done" as const : "failed" as const) : settled ? "active" as const : "pending" as const },
  ];
}
