import type { TrackedProject } from "../types";
import type { ActionQueueTask } from "../hooks/useActionQueue";
import type { DelegationRun } from "./delegation";
import { attributeTasks } from "./taskAttribution";

export const operationalStatuses = ["NEEDS_YOU", "BLOCKED", "READY", "IN_PROGRESS", "WAITING", "UNKNOWN", "MONITORING", "COMPLETE"] as const;
export type OperationalStatus = typeof operationalStatuses[number];
export type NextMoveOwner = "OPERATOR" | "OLYMPUS" | "EXTERNAL" | "NONE";
export interface ProjectCommandState {
  project: TrackedProject;
  operationalStatus: OperationalStatus;
  currentState: string;
  nextMove: string | null;
  nextMoveOwner: NextMoveOwner | null;
  nextAction: string | null;
  blockers: string[] | null;
  operatorDecisions: { runId: string; text: string }[];
  olympusRecommendation: string;
  recommendationSource: "deterministic";
  openTaskCount: number | null;
  lastMeaningfulChange: { at: string; source: string } | null;
}
const activePhases = ["approved", "preparing", "planning", "editing", "testing", "reviewing"];
const time = (value: string) => Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0;

/** Read-only projection: no task text parsing, intent promotion, or approval writes. */
export function buildProjectCommandBoard(projects: TrackedProject[], tasks: ActionQueueTask[], runs: DelegationRun[], available = { tasks: true, runs: true }): ProjectCommandState[] {
  const attributed = attributeTasks(projects, tasks.filter(task => !task.completed)).perProject;
  return projects.map(project => {
    const projectRuns = available.runs ? runs.filter(run => run.projectId === project.id).sort((a,b) => time(b.updatedAt)-time(a.updatedAt)) : [];
    const decisions = projectRuns.filter(run => ["waiting", "awaiting_review"].includes(run.phase)).map(run => ({runId: run.id, text: run.phase === "waiting" ? `Review plan before resuming: ${run.task}` : `Review result and evidence: ${run.task}`}));
    const running = projectRuns.find(run => activePhases.includes(run.phase));
    const action = project.nextStep.trim() || null;
    let operationalStatus: OperationalStatus = "UNKNOWN";
    let currentState = project.lastCommitAt && project.lastCommit.trim() ? `Latest commit: ${project.lastCommit}. Execution unconfirmed.` : "No operational state or committed work is recorded.";
    let nextMove = action;
    let nextMoveOwner: NextMoveOwner | null = null;
    let olympusRecommendation = action ? "Review the recorded next action and confirm its owner and prerequisites." : "Record a concrete next move and its owner before starting new work.";
    if (!available.runs) currentState = "Execution and review records are unavailable; operational state cannot be confirmed.";
    else if (decisions.length) {
      operationalStatus = "NEEDS_YOU"; currentState = `${decisions.length} delegation checkpoint${decisions.length === 1 ? " requires" : "s require"} operator review.${running ? " Another delegated run is active." : ""}`;
      nextMove = decisions[0].text; nextMoveOwner = "OPERATOR";
      olympusRecommendation = "Inspect the recorded scope or result before deciding whether to approve or resume.";
    } else if (running) {
      operationalStatus = "IN_PROGRESS"; currentState = `Delegation ${running.phase}: ${running.milestone}`;
      nextMove = running.task; nextMoveOwner = "OLYMPUS";
      olympusRecommendation = "Follow the current run to its next checkpoint and review the resulting evidence.";
    } else if (project.statusSource === "declared" && project.status === "archived") {
      operationalStatus = "COMPLETE"; currentState = "Archived in the project note; this is not verification that every task was completed.";
      nextMove = null; nextMoveOwner = "NONE"; olympusRecommendation = "Keep archived unless the operator reopens the project.";
    } else if (project.statusSource === "declared" && project.status === "watching") {
      operationalStatus = "MONITORING"; currentState = "Declared watchlist. No active delegation or operator checkpoint is recorded.";
      nextMoveOwner = action ? null : "NONE"; olympusRecommendation = "Keep on the watchlist unless priorities change; review any recorded next action before activation.";
    }
    const latest = [project.lastCommitAt ? {at: project.lastCommitAt, source: "Git commit"} : null, ...projectRuns.map(run => ({at:run.updatedAt,source:"Delegation update"}))].filter((item): item is {at:string;source:string} => !!item && time(item.at)>0).sort((a,b)=>time(b.at)-time(a.at))[0] ?? null;
    return { project, operationalStatus, currentState, nextMove, nextMoveOwner, nextAction: action, blockers: null, operatorDecisions: decisions, olympusRecommendation, recommendationSource: "deterministic", openTaskCount: available.tasks ? (attributed.get(project.id)?.length ?? 0) : null, lastMeaningfulChange: latest };
  });
}
export function sortCommandProjects(rows: ProjectCommandState[], sort: "priority" | "recent" | "name") {
  return [...rows].sort((a,b) => (sort === "priority" ? operationalStatuses.indexOf(a.operationalStatus)-operationalStatuses.indexOf(b.operationalStatus) : 0) || (sort !== "name" ? time(b.lastMeaningfulChange?.at ?? "")-time(a.lastMeaningfulChange?.at ?? "") : 0) || a.project.name.localeCompare(b.project.name));
}
export function reviewProjectContext(rows: ProjectCommandState[]) {
  window.dispatchEvent(new CustomEvent("olympus:focus-console", { detail: {
    label: rows.length === 1 ? rows[0].project.name : "Project portfolio",
    prompt: "Review these project priorities with me and recommend the next move.",
    context: JSON.stringify(rows.map(row => ({project:row.project.name, classification:row.project.status, operationalStatus:row.operationalStatus, state:row.currentState, nextMove:row.nextMove, owner:row.nextMoveOwner ?? "UNKNOWN", recordedNextAction:row.nextAction, recommendation:row.olympusRecommendation, recommendationSource:row.recommendationSource, blockers:row.blockers, operatorCheckpoints:row.operatorDecisions, openTasks:row.openTaskCount})), null, 2)
  }}));
}
