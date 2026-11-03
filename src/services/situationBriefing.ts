import { invoke } from "@tauri-apps/api/core";
import type { ActionQueueTask } from "../hooks/useActionQueue";
import type { SessionBoundary } from "../types";
import { listDelegationRuns } from "./delegation";
import { fetchProjects } from "./liveData";
import { prepareFactualBrief, boundedBriefRead, type PreparedBrief } from "./briefingDelivery";
import { buildProjectCommandBoard } from "./projectCommandBoard";

/** Compose from this request's results, never from an earlier React render. */
export async function prepareSituationBriefing(root: string, boundary: SessionBoundary | null): Promise<PreparedBrief> {
  const collect=()=>Promise.allSettled([
    boundedBriefRead(fetchProjects(root, boundary?.previousSessionStartedAt ?? null)),
    boundedBriefRead(invoke<ActionQueueTask[]>("fetch_action_queue")),
    boundedBriefRead(listDelegationRuns())
  ]);
  const results=await collect();
  const [projects,tasks,runs]=results;
  const sourceRevision=(values:typeof results)=>JSON.stringify(values.map(r=>r.status==='fulfilled'?[r.status,r.value]:[r.status]));
  const expected=sourceRevision(results);
  const projectList=projects.status==='fulfilled'?projects.value.projects:[];
  const board = buildProjectCommandBoard(projectList,
    tasks.status === "fulfilled" ? tasks.value : [],
    runs.status === "fulfilled" ? runs.value : [],
    { tasks: tasks.status === "fulfilled", runs: runs.status === "fulfilled" });
  const gaps = [tasks.status === "rejected" ? "task records" : "", runs.status === "rejected" ? "running-work records" : "", projects.status==='fulfilled'&&projects.value.warnings.length ? "some project notes" : ""].filter(Boolean);
  const briefing = await prepareFactualBrief({projects:projectList,board,projectsError:projects.status==='rejected'?'unavailable':null},'requested',Date.now(),undefined,async()=>sourceRevision(await collect())===expected);
  if(gaps.length) briefing.text=`${briefing.text} I couldn't refresh ${gaps.join(" and ")}, so this briefing is incomplete.`;
  return briefing;
}

/** Read-only text adapter; delivery receipts are owned by the displaying caller. */
export async function generateSituationBriefing(root:string,boundary:SessionBoundary|null):Promise<string> {
  return (await prepareSituationBriefing(root,boundary)).text??'No briefing available.';
}
