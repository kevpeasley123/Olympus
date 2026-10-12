import { invoke } from "@tauri-apps/api/core";
import type { ActionQueueTask } from "../hooks/useActionQueue";
import type { SessionBoundary } from "../types";
import { listDelegationRuns } from "./delegation";
import { fetchProjects } from "./liveData";
import { composeOpeningBriefing } from "./openingBriefing";
import { buildProjectCommandBoard } from "./projectCommandBoard";

/** Compose from this request's results, never from an earlier React render. */
export async function generateSituationBriefing(root: string, boundary: SessionBoundary | null): Promise<string> {
  const [projects, tasks, runs] = await Promise.allSettled([
    fetchProjects(root, boundary?.previousSessionStartedAt ?? null),
    invoke<ActionQueueTask[]>("fetch_action_queue"),
    listDelegationRuns()
  ]);
  if (projects.status === "rejected") throw new Error("Couldn't refresh project records. Please try the briefing again.");
  const board = buildProjectCommandBoard(projects.value.projects,
    tasks.status === "fulfilled" ? tasks.value : [],
    runs.status === "fulfilled" ? runs.value : [],
    { tasks: tasks.status === "fulfilled", runs: runs.status === "fulfilled" });
  const gaps = [tasks.status === "rejected" ? "task records" : "", runs.status === "rejected" ? "running-work records" : "", projects.value.warnings.length ? "some project notes" : ""].filter(Boolean);
  return `Current situation. ${gaps.length ? `I couldn't refresh ${gaps.join(" and ")}, so this briefing is incomplete. ` : ""}${composeOpeningBriefing({projects:projects.value.projects,board,sessionBoundary:boundary,projectsError:null})}`;
}
