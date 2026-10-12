// Synthetic IPC fixture, never imported by the production application.
import {mockIPC} from "@tauri-apps/api/mocks";
import {createRoot} from "react-dom/client";
import {useState} from "react";
import {ProjectsPanel} from "./components/panels/ProjectsPanel";
import {seedState} from "./data/seed";
import type {ProjectMember} from "./services/projectMembership";
import "./styles.css";
let members:ProjectMember[]=[{project:{...seedState.projects[0],id:"fixture",name:"Olympus"},visibility:"visible",revision:0,intake:{},sources:[]}];
let failSave=false,failRemove=false,failMembers=false,failScan=false;let remount:()=>void=()=>{};const calls:string[]=[];
mockIPC(async(command,args)=>{
 calls.push(command);const a=args as Record<string,any>;
 if(command.startsWith("plugin:event|"))return 1;
 if(["organizer_overview","list_delegation_runs","fetch_action_queue"].includes(command))return [];
 if(command==="project_members"){if(failMembers)throw Error("Membership fixture unavailable");return structuredClone(members)}
 if(command==="pick_project_folder")return "C:/Fixture/Folder project";
 if(command==="link_project"){
  const r=a.request;const existing=members.find(m=>m.sources.some(s=>s.location.replace(/\.git\/?$/,"")===r.location.replace(/\.git\/?$/,"")));
  if(existing)return structuredClone(existing);
  let m=members.find(m=>m.project.id===r.projectId);
  if(!m){m={project:{...seedState.projects[0],id:crypto.randomUUID(),name:r.name||r.location.split("/").pop(),vision:"",notePath:null,path:r.kind==="folder"?r.location:"",repoState:"no-repo",nextStep:"",warnings:[]},visibility:"visible",revision:0,intake:{},sources:[]};members.push(m)}
  if(r.kind!=="idea")m.sources.push({kind:r.kind,location:r.location});return structuredClone(m);
 }
 const m=members.find(m=>m.project.id===a.id)!;
 if(command==="inspect_project"){await new Promise(r=>setTimeout(r,100));m.intake.assessment={evidence:m.sources.length?[{source:m.sources[0].location,text:"# Example\nA useful project with documented goals.",fingerprint:"fixture-sha"}]:[],warnings:m.sources.length?[]:["No source documents yet."]};m.intake.inspectedAt=new Date().toISOString();m.revision++;return structuredClone(m)}
 if(command==="save_project_intake"){if(failSave){failSave=false;throw Error("Fixture save unavailable")};if(a.revision!==m.revision)throw Error("Project changed. Reload its current answers before saving.");Object.assign(m.intake,a.intake);m.revision++;return structuredClone(m)}
 if(command==="set_project_visibility"){if(failRemove)throw Error("Resolve this project's active work or review before removing it.");m.visibility=a.visibility;m.revision++;return structuredClone(m)}
 if(command==="confirm_project_brief")return false;
 throw Error(`Unexpected fixture command: ${command}`);
});
Object.assign(window,{projectFixture:{calls,failSave:()=>{failSave=true},blockRemoval:(value:boolean)=>{failRemove=value},failReads:()=>{failMembers=true;failScan=true},remount:()=>remount(),members:()=>structuredClone(members)}});
function Fixture(){const [projects,setProjects]=useState(members.map(m=>m.project)),[selected,setSelected]=useState<string|null>(null),[key,setKey]=useState(0);remount=()=>{setSelected(null);setKey(k=>k+1)};
 return <div style={{position:"fixed",inset:24,maxWidth:1020,display:"flex",minHeight:0}}><ProjectsPanel key={key} projects={projects} demoData={false} projectFilter={selected} onClearFilter={()=>setSelected(null)} onFocusProject={setSelected} onRescan={async()=>{if(failScan)throw Error("Scan fixture unavailable");setProjects(members.filter(m=>m.visibility==="visible").map(m=>({...m.project})))}} sessionBoundary={null} onOpenNote={()=>{}} onSyncCanvas={async()=>({tone:"success",message:"Fixture"})}/></div>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
