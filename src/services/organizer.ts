import { invoke } from "@tauri-apps/api/core";
import type { ApprovalProposal, DelegationRun } from "./delegation";
export interface OrganizerStep {
    id: string;
    text: string;
    done: boolean;
}
export interface OrganizerSource {
    kind: "vault" | "url";
    reference: string;
    capturedText: string | null;
    sha256: string | null;
    line: number | null;
}
export interface TaskInput {
    projectId: string;
    title: string;
    objective: string;
    criteria: string[];
    steps: OrganizerStep[];
    priority: "high" | "normal" | "low";
    priorityReason: string;
    dueDate: string | null;
    sources: OrganizerSource[];
    intent: "proposed" | "committed";
}
export interface OrganizerTask extends TaskInput {
    id: string;
    revision: number;
    position: number;
    state: "open" | "completed" | "cancelled";
    createdAt: string;
    updatedAt: string;
}
export interface OrganizerResult {
    id: string;
    runId: string;
    taskId: string;
    summary: string;
    workspaceHash: string;
    manifest: unknown;
    reviewState: "pending" | "accepted" | "superseded";
    createdAt: string;
    acceptedAt: string | null;
}
export interface OrganizerEvent {
    sequence: number;
    kind: string;
    payload: unknown;
    createdAt: string;
    acknowledged: boolean;
}
export interface OrganizerDetail {
    task: OrganizerTask;
    results: OrganizerResult[];
    events: OrganizerEvent[];
    runIds: string[];
    runs: DelegationRun[];
    displayStatus: string;
    sourceHealth: string[];
    resultHealth: Record<string, string>;
}
export interface OrganizerOverview {
    task: OrganizerTask;
    displayStatus: string;
    needsAttention: boolean;
}
export interface OrganizerFailure {
    code: string;
    message: string;
    currentTask?: OrganizerTask | null;
}
export const organizerMessage = (error: unknown): string => typeof error === "object" && error !== null && "message" in error ? String(error.message) : String(error);
export const listOrganizer = () => invoke<OrganizerOverview[]>("organizer_overview");
export const createTask = (request: TaskInput) => invoke<OrganizerTask>("create_organizer_task", { request });
export const fetchTask = (taskId: string) => invoke<OrganizerDetail>("fetch_organizer_task", { request: { taskId } });
export const updateTask = (task: OrganizerTask, patch: Omit<TaskInput, "projectId">) => invoke<OrganizerTask>("update_organizer_task", { request: { taskId: task.id, expectedRevision: task.revision, patch } });
export const adoptTask = (task: OrganizerTask) => invoke<OrganizerTask>("set_organizer_intent", { request: { taskId: task.id, expectedRevision: task.revision, intent: "committed" } });
export const moveTask = (task: OrganizerTask, beforeTaskId: string | null) => invoke<OrganizerTask[]>("move_organizer_task", { request: { taskId: task.id, expectedRevision: task.revision, beforeTaskId } });
export const prepareTask = (task: OrganizerTask) => invoke<ApprovalProposal>("prepare_organizer_delegation", { request: { taskId: task.id, expectedRevision: task.revision } });
export const acceptResult = (task: OrganizerTask, result: OrganizerResult, workspaceHash: string) => invoke<OrganizerTask>("accept_organizer_result", { request: { taskId: task.id, expectedRevision: task.revision, resultId: result.id, workspaceHash } });
export const finishTask = (task: OrganizerTask, action: "cancel" | "complete_manual", reason: string) => invoke<OrganizerTask>("finish_organizer_task", { request: { taskId: task.id, expectedRevision: task.revision, action, reason } });
export const acknowledgeEvent = (eventId: number) => invoke<void>("acknowledge_organizer_event", { request: { eventId } });
export function nextOrganizerTask(rows: OrganizerOverview[], projectId: string): OrganizerOverview | undefined {
    const rank = { high: 0, normal: 1, low: 2 };
    return rows.filter(r => r.task.projectId === projectId && r.task.state === "open" && r.task.intent === "committed").sort((a, b) => rank[a.task.priority] - rank[b.task.priority] || a.task.position - b.task.position || a.task.id.localeCompare(b.task.id))[0];
}
export function canPrepareTask(task: OrganizerTask, runs: DelegationRun[], blocker: string | null): boolean {
    return !blocker && task.state === "open" && task.intent === "committed" && !runs.some(r => r.projectId === task.projectId && !["complete", "failed", "cancelled"].includes(r.phase));
}
/** Strip server-owned metadata before sending strict mutation DTOs. */
export function taskInputOf(task: TaskInput): TaskInput {
    const { projectId, title, objective, criteria, steps, priority, priorityReason, dueDate, sources, intent } = task;
    return { projectId, title, objective, criteria, steps, priority, priorityReason, dueDate, sources, intent };
}
