import type { TrackedProject } from "../types";
import type { ActionQueueTask } from "../hooks/useActionQueue";
import type { DelegationRun } from "./delegation";
import { attributeTasks } from "./taskAttribution";
import { projectAttention, type AttentionItem } from "./projectBriefing";
import { formatWhen } from "./time";

export const operationalStatuses = ["NEEDS_YOU", "BLOCKED", "READY", "IN_PROGRESS", "WAITING", "UNKNOWN", "MONITORING", "COMPLETE"] as const;
export type OperationalStatus = typeof operationalStatuses[number];
export type NextMoveOwner = "OPERATOR" | "OLYMPUS" | "EXTERNAL" | "NONE";

/**
 * Display names. `COMPLETE` stays the data value (voice navigation and the
 * console context use it) but it means a declared archive, not finished work,
 * so it reads ARCHIVED everywhere it is shown (review D6).
 */
export const operationalStatusLabels: Record<OperationalStatus, string> = {
  NEEDS_YOU: "NEEDS YOU", BLOCKED: "BLOCKED", READY: "READY", IN_PROGRESS: "IN PROGRESS",
  WAITING: "WAITING", UNKNOWN: "UNKNOWN", MONITORING: "MONITORING", COMPLETE: "ARCHIVED"
};
export const ownerLabels: Record<NextMoveOwner | "UNKNOWN", string> = {
  OPERATOR: "You", OLYMPUS: "Olympus", EXTERNAL: "External", NONE: "None", UNKNOWN: "Unknown"
};

/** Rows that carry an operator checkpoint stay at the top whatever the sort. */
export const isPinnedStatus = (status: OperationalStatus) => status === "NEEDS_YOU" || status === "BLOCKED";

export interface OperatorDecision { runId: string; text: string; phase: "waiting" | "awaiting_review"; since: string }

export interface ProjectCommandState {
  project: TrackedProject;
  operationalStatus: OperationalStatus;
  currentState: string;
  nextMove: string | null;
  nextMoveOwner: NextMoveOwner | null;
  nextAction: string | null;
  blockers: string[] | null;
  operatorDecisions: OperatorDecision[];
  olympusRecommendation: string;
  /** True when the advice is the same for every row in this state; rows omit it. */
  recommendationGeneric: boolean;
  recommendationSource: "deterministic";
  /** Source-labelled observations. They never change the status above. */
  attention: AttentionItem[];
  /** A run the backend would count as open for this project, if any. */
  openRun: DelegationRun | null;
  openTaskCount: number | null;
  lastMeaningfulChange: { at: string; source: string } | null;
}
const activePhases = ["approved", "preparing", "planning", "editing", "testing", "reviewing"];
/** `active_run_for_project` in delegation.rs: any of these refuses a new run. */
const openPhases = [...activePhases, "waiting", "awaiting_review"];
const time = (value: string) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;

/** Read-only projection: no task text parsing, intent promotion, or approval writes. */
export function buildProjectCommandBoard(projects: TrackedProject[], tasks: ActionQueueTask[], runs: DelegationRun[], available = { tasks: true, runs: true }, now: Date = new Date()): ProjectCommandState[] {
  const attributed = attributeTasks(projects, tasks.filter(task => !task.completed)).perProject;
  return projects.map(project => {
    const projectRuns = available.runs ? runs.filter(run => run.projectId === project.id).sort((a,b) => time(b.updatedAt)-time(a.updatedAt)) : [];
    const decisions: OperatorDecision[] = projectRuns.filter(run => run.phase === "waiting" || run.phase === "awaiting_review").map(run => ({
      runId: run.id, phase: run.phase as OperatorDecision["phase"], since: run.updatedAt,
      text: run.phase === "waiting" ? `Review plan before resuming: ${run.task}` : `Review result and evidence: ${run.task}`
    }));
    const running = projectRuns.find(run => activePhases.includes(run.phase));
    const action = project.nextStep.trim() || null;
    let operationalStatus: OperationalStatus = "UNKNOWN";
    let currentState = project.lastCommitAt && project.lastCommit.trim() ? `Latest commit: ${project.lastCommit}. Execution unconfirmed.` : "No operational state or committed work is recorded.";
    let nextMove = action;
    let nextMoveOwner: NextMoveOwner | null = null;
    let recommendationGeneric = true;
    let olympusRecommendation = action ? "Review the recorded next action and confirm its owner and prerequisites." : "Record a concrete next move and its owner before starting new work.";
    if (!available.runs) currentState = "Execution and review records are unavailable; operational state cannot be confirmed.";
    else if (decisions.length) {
      const first = decisions[0];
      operationalStatus = "NEEDS_YOU"; currentState = `${decisions.length} delegation checkpoint${decisions.length === 1 ? " requires" : "s require"} operator review.${running ? " Another delegated run is active." : ""}`;
      nextMove = first.text; nextMoveOwner = "OPERATOR"; recommendationGeneric = false;
      olympusRecommendation = first.phase === "waiting"
        ? `Plan recorded ${formatWhen(first.since, { now })}; read it before approving implementation.`
        : `Result preserved ${formatWhen(first.since, { now })}; run the applicable checks, then record your review.`;
    } else if (running) {
      operationalStatus = "IN_PROGRESS"; currentState = `Delegation ${running.phase}: ${running.milestone}`;
      nextMove = running.task; nextMoveOwner = "OLYMPUS"; recommendationGeneric = false;
      olympusRecommendation = `Run ${running.phase}, last update ${formatWhen(running.updatedAt, { now })}; review its evidence at the next checkpoint.`;
    } else if (project.statusSource === "declared" && project.status === "archived") {
      operationalStatus = "COMPLETE"; currentState = "Archived in the project note; this is not verification that every task was completed.";
      nextMove = null; nextMoveOwner = "NONE"; olympusRecommendation = "Keep archived unless the operator reopens the project.";
    } else if (project.statusSource === "declared" && project.status === "watching") {
      operationalStatus = "MONITORING"; currentState = "Declared watchlist. No active delegation or operator checkpoint is recorded.";
      nextMoveOwner = action ? null : "NONE"; olympusRecommendation = "Keep on the watchlist unless priorities change; review any recorded next action before activation.";
    }
    const latest = [project.lastCommitAt ? {at: project.lastCommitAt, source: "Git commit"} : null, ...projectRuns.map(run => ({at:run.updatedAt,source:"Delegation update"}))].filter((item): item is {at:string;source:string} => !!item && time(item.at)>0).sort((a,b)=>time(b.at)-time(a.at))[0] ?? null;
    return {
      project, operationalStatus, currentState, nextMove, nextMoveOwner, nextAction: action, blockers: null, operatorDecisions: decisions,
      olympusRecommendation, recommendationGeneric, recommendationSource: "deterministic",
      attention: projectAttention(project, projectRuns, now),
      openRun: projectRuns.find(run => openPhases.includes(run.phase)) ?? null,
      openTaskCount: available.tasks ? (attributed.get(project.id)?.length ?? 0) : null, lastMeaningfulChange: latest
    };
  });
}
export function sortCommandProjects(rows: ProjectCommandState[], sort: "priority" | "recent" | "name") {
  const pinned = (row: ProjectCommandState) => isPinnedStatus(row.operationalStatus) ? 1 : 0;
  return [...rows].sort((a,b) => pinned(b)-pinned(a) || (sort === "priority" ? operationalStatuses.indexOf(a.operationalStatus)-operationalStatuses.indexOf(b.operationalStatus) : 0) || (sort !== "name" ? time(b.lastMeaningfulChange?.at ?? "")-time(a.lastMeaningfulChange?.at ?? "") : 0) || a.project.name.localeCompare(b.project.name));
}

/**
 * Why Prepare would be refused, stated before the operator writes a task
 * (review U11). Guidance only: `prepare_delegation_run` revalidates all of it.
 * `runs` is null when execution records are unavailable, in which case the
 * backend is left to decide.
 */
export function prepareBlocker(project: TrackedProject, runs: DelegationRun[] | null, desktop: boolean): string | null {
  if (!desktop) return "Delegation runs only in the desktop app.";
  if (!project.path) return "No folder under the projects root, so there is no repository to delegate in.";
  const open = runs?.filter(run => run.projectId === project.id && openPhases.includes(run.phase))
    .sort((a,b) => time(b.updatedAt)-time(a.updatedAt))[0];
  if (open?.phase === "waiting") return "A plan is waiting on this project. Review it below, or stop that run, before preparing another.";
  if (open?.phase === "awaiting_review") return "A result is awaiting your review below. Complete or stop that run before preparing another.";
  if (open) return "A run is in progress on this project. Follow it below; one run per project.";
  if (project.repoState === "folder-only" || project.repoState === "no-repo") return "This folder is not a Git repository, so there is no base commit to delegate from.";
  if (project.repoState === "git-pending") {
    return project.lastCommitAt
      ? "The primary checkout has uncommitted changes. Commit or stash them first."
      : "The repository has no commits yet. Commit first so a run has a base.";
  }
  return null;
}

/** The task a new proposal starts from. Watching or archived projects start blank: their next step is a decision, not a coding task. */
export function initialTask(project: TrackedProject): string {
  return project.status === "active" ? project.nextStep.trim() : "";
}

export function reviewProjectContext(rows: ProjectCommandState[]) {
  window.dispatchEvent(new CustomEvent("olympus:focus-console", { detail: {
    kind: "project-snapshot",
    label: rows.length === 1 ? rows[0].project.name : "Project portfolio",
    prompt: "Review these project priorities with me and recommend the next move.",
    context: JSON.stringify(rows.map(row => ({project:row.project.name, classification:row.project.status, operationalStatus:operationalStatusLabels[row.operationalStatus], state:row.currentState, nextMove:row.nextMove, owner:row.nextMoveOwner ?? "UNKNOWN", recordedNextAction:row.nextAction, recommendation:row.olympusRecommendation, recommendationSource:row.recommendationSource, blockers:row.blockers, attentionObservations:row.attention.map(item => `${item.text} (${item.source})`), operatorCheckpoints:row.operatorDecisions.map(({runId,text}) => ({runId,text})), openTasks:row.openTaskCount})), null, 2)
  }}));
}
