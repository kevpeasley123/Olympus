// Browser-only fixture. No production entrypoint imports this module.
import { createRoot } from "react-dom/client";
import { useState } from "react";
import { mockIPC } from "@tauri-apps/api/mocks";
import { OrganizerPanel } from "./components/panels/organizer/OrganizerPanel";
import { refreshOrganizer } from "./hooks/useOrganizer";
import { refreshDelegationRuns } from "./hooks/useDelegationRuns";
import type { OrganizerTask, OrganizerDetail, TaskInput } from "./services/organizer";
import type { ApprovalProposal, DelegationRun } from "./services/delegation";
import "./styles.css";
import "./components/panels/projects.css";
let tasks: OrganizerTask[] = [], runs: DelegationRun[] = [];
let conflict = false, unavailable = false, starts = 0;
const date = "2026-10-10T12:00:00Z";
const state = (t: OrganizerTask) => t.state === "completed" ? "Completed" : t.intent === "proposed" ? "Proposed" : runs[0]?.phase === "complete" || runs[0]?.phase === "awaiting_review" ? "Result ready" : runs[0]?.phase === "waiting" ? "Needs you" : "Planned";
const proposal = (t: OrganizerTask): ApprovalProposal => ({ id: "proposal", sessionId: "fixture", expiresAt: Date.now() / 1000 + 600, baseBranch: "main", permitted: null, subject: { projectId: "p", projectName: "Olympus", repository: "C:/fixture", baseCommit: "abcdef123", driver: "Fixture", model: "No provider", stage: "plan", task: t.objective, criteria: t.criteria, scope: "Read-only fixture; no external calls", runId: "r", workspace: "C:/fixture/run", workspaceHash: "hash", plan: "" } });
mockIPC(async (command, args) => structuredClone(await respond(command, args)));
function respond(command: string, args: unknown) {
    if (command.startsWith("plugin:event|"))
        return 1;
    const request = (args as {
        request?: Record<string, any>;
    })?.request ?? {};
    const task = tasks.find(t => t.id === request.taskId) ?? tasks[0];
    if (command === "organizer_overview") {
        if (unavailable)
            throw { message: "Organizer unavailable: " + "Recover the desktop connection. ".repeat(20) };
        return tasks.map(task => ({ task, displayStatus: state(task), needsAttention: runs.length > 0 && task.state === "open" }));
    }
    if (command === "list_delegation_runs")
        return runs;
    if (command === "create_organizer_task") {
        const t = { ...request as unknown as TaskInput, id: `t${tasks.length}`, revision: 1, position: tasks.length, state: "open" as const, createdAt: date, updatedAt: date };
        tasks.push(t);
        return t;
    }
    if (command === "fetch_organizer_task")
        return { task, runs, resultHealth: { result: "Current workspace matches the recorded review" }, runIds: runs.map(r => r.id), displayStatus: state(task), sourceHealth: task.sources.map(() => "Available; original revision unknown"), events: [], results: runs.some(r => ["complete", "awaiting_review"].includes(r.phase)) ? [{ id: "result", taskId: task.id, runId: "r", summary: "Implementation and verification evidence preserved.", workspaceHash: "hash", manifest: { workspace: "C:/fixture/run", changedFiles: ["workflow.ts"], taskSnapshot: task }, reviewState: task.state === "completed" ? "accepted" : "pending", createdAt: date, acceptedAt: null }] : [] } satisfies OrganizerDetail;
    if (command === "update_organizer_task") {
        if (conflict) {
            conflict = false;
            task.revision++;
            throw { code: "conflict", message: "Newer revision; your draft was retained." };
        }
        if (request.expectedRevision !== task.revision)
            throw { message: "Stale revision" };
        if (Object.keys(request.patch).some(k => ["id", "revision", "state", "position", "createdAt", "updatedAt", "projectId"].includes(k)))
            throw { message: "Unexpected server-owned patch field" };
        Object.assign(task, request.patch, { revision: task.revision + 1 });
        return task;
    }
    if (command === "set_organizer_intent") {
        task.intent = "committed";
        task.revision++;
        return task;
    }
    if (command === "prepare_organizer_delegation")
        return proposal(task);
    if (command === "start_delegation_run") {
        starts++;
        if (starts > 1)
            throw Error("Duplicate start");
        runs = [{ id: "r", projectId: "p", projectName: "Olympus", task: task.objective, driver: "Fixture", model: "No provider", phase: "waiting", workspace: "C:/fixture/run", branch: "fixture", baseCommit: "abcdef", agentSessionId: "", processId: null, milestone: "Plan ready", checkpoint: "Review the plan", outcome: null, changedFiles: [], diffSummary: null, error: null, startedAt: date, updatedAt: date }];
        return runs[0];
    }
    if (command === "cancel_delegation_proposal" || command === "acknowledge_organizer_event")
        return;
    if (command === "delegation_review_fingerprint")
        return "hash";
    if (command === "accept_organizer_result") {
        if (runs[0]?.phase !== "complete")
            throw Error("Review required");
        task.state = "completed";
        task.revision++;
        return task;
    }
    if (command === "move_organizer_task") {
        tasks.reverse();
        return tasks;
    }
    throw Error(`Unimplemented fixture command: ${command}`);
}
Object.assign(window, { organizerFixture: { snapshot: () => ({ tasks, runs, starts }), conflict: () => { conflict = true; }, phase: async (phase: DelegationRun["phase"]) => { runs[0].phase = phase; await refreshDelegationRuns(); await refreshOrganizer(); }, unavailable: async () => { unavailable = true; await refreshOrganizer(); } } });
function Harness() { const [visible, setVisible] = useState(true); return <main style={{ maxWidth: 1200, margin: "30px auto", padding: 24, color: "#e4dfd3" }}><h1>Olympus · Project Organizer</h1><p>Isolated browser fixture · no external actions</p><button onClick={() => setVisible(!visible)}>Switch project view</button>{visible && <OrganizerPanel projectId="p" blocker={null}/>}</main>; }
createRoot(document.getElementById("root")!).render(<Harness />);
