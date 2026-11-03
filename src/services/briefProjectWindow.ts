import {invoke} from "@tauri-apps/api/core";
import type {RecentCommit,TrackedProject} from "../types";

export interface DisplayCursor {source:string;at:number;oids:string[]}
export interface DisplayPlan {preparedAt:number;items:{id:string;revision:string}[];cursors:DisplayCursor[]}
export interface ProjectWindow {projects:TrackedProject[]; gaps:string[]}

function initialBoundary(root:string,now:number) {
  const key="olympus.briefInitialBoundary:"+root;
  const first=Number(localStorage.getItem(key));
  if(first>0 && first<=now)return first;
  const initial=now-7*86_400_000;
  localStorage.setItem(key,String(initial));
  return initial;
}

export async function readProjectWindow(root:string,projects:TrackedProject[],now:number):Promise<ProjectWindow> {
  const since=new Date(initialBoundary(root,now)).toISOString();
  const eligible=projects.filter(p=>p.path && ["active","watching"].includes(p.status));
  const changes=new Map<string,RecentCommit[]>();
  const gaps=new Set<string>();
  let next=0;
  async function collect(){
    while(next<eligible.length){
      const project=eligible[next++];
      let timer:ReturnType<typeof setTimeout>|undefined;
      try {
        const result=await Promise.race([
          invoke<RecentCommit[]>("brief_project_changes",{projectId:project.id,since}),
          new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error("Project activity timed out")),3000);}),
        ]);
        changes.set(project.id,result.filter(c=>Date.parse(c.at)<=now));
      } catch { gaps.add(project.name); }
      finally {clearTimeout(timer);}
    }
  }
  await Promise.all(Array.from({length:Math.min(4,eligible.length)},collect));
  return {projects:projects.map(p=>({...p,sinceSessionCommits:changes.get(p.id)??[]})),gaps:[...gaps].sort()};
}

export function displayedCursors(projects:TrackedProject[],ids:Set<string>):DisplayCursor[]{
  return projects.flatMap(project=>{
    if(!ids.has("project:"+project.id+":progress"))return [];
    const commits=project.sinceSessionCommits.filter(c=>!/^Merge\b/.test(c.subject));
    const at=commits.reduce((latest,c)=>Math.max(latest,Date.parse(c.at)),0);
    if(!at)return [];
    return [{source:project.path,at,oids:[...new Set(commits.filter(c=>Date.parse(c.at)===at && c.oid).map(c=>c.oid!))]}];
  });
}
