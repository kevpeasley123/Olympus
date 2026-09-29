import {createRoot} from "react-dom/client";
import {useState} from "react";
import {ProjectsPanel} from "./components/panels/ProjectsPanel";
import {ChatPanel} from "./components/panels/ChatPanel";
import {seedState} from "./data/seed";
import type {ProjectScanState} from "./hooks/useDashboardData";
import type {TrackedProject, TurnAttachment} from "./types";
import {composeTurnText} from "./services/turnAttachment";
import "./styles.css";
let sent = "";
let attached: TurnAttachment | undefined;
let rescans = 0;
const READY: ProjectScanState = {status:"ready",lastSuccessAt:new Date().toISOString(),error:null,scanning:false};
let setFixture: (value:{scan:ProjectScanState;projects:TrackedProject[];demo:boolean}) => void = () => {};
function Fixture() {
  const [selected,setSelected] = useState<string|null>(null);
  const [fixture,setState] = useState({scan:READY,projects:seedState.projects,demo:true});
  setFixture = setState;
  return <><output id="results" style={{position:"fixed",top:0,left:0,color:"white",zIndex:100,fontSize:11}}>Running…</output><div id="layout" style={{position:"fixed",inset:"35px 15px 15px",display:"grid",gridTemplateColumns:"minmax(0,1fr) 380px",gap:16}}><ProjectsPanel projects={fixture.projects} projectScan={fixture.scan} demoData={fixture.demo} onRescan={()=>{rescans++;}} projectsRootPath={"C:\\Projects"} sessionBoundary={null} projectFilter={selected} onClearFilter={()=>setSelected(null)} onFocusProject={setSelected} onOpenNote={()=>{}} onSyncCanvas={async()=>({tone:"success",message:"Fixture only"})}/><div style={{display:"flex",alignItems:"flex-end",minHeight:0}}><ChatPanel messages={[]} onSendMessage={(value,attachment)=>{sent=value;attached=attachment;}} onRecordObservation={async()=>({tone:"success",message:"Fixture only"})}/></div></div></>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
const wait = () => new Promise(resolve=>setTimeout(resolve,150));
const checks:string[]=[];
function check(value:unknown,label:string){if(!value)throw Error(label);checks.push(label);}
function click(text:string){const button=[...document.querySelectorAll("button")].find(b=>b.textContent?.includes(text));if(!button)throw Error(text);button.click();}
const text = () => document.querySelector(".project-command")!.textContent ?? "";
const seedNames = seedState.projects.map(project => project.name);
async function run(){
 await wait();await wait();
 check(document.querySelectorAll(".command-project-row").length===seedState.projects.length,"All projects summarized");
 check(!document.querySelector(".command-project-detail"),"No hidden reports mounted");
 check(text().includes("Browser preview · example project data"),"Demo data keeps its label");
 const monitoring=[...document.querySelectorAll<HTMLButtonElement>(".command-board-filters button")].find(b=>b.textContent?.startsWith("MONITORING"));
 if(monitoring){monitoring.click();await wait();check([...document.querySelectorAll(".command-operational-status")].every(n=>n.textContent==="MONITORING"),"Filter restricts rows");}
 click("ALL");await wait();
 check(![...document.querySelectorAll(".command-operational-status")].some(n=>n.textContent==="COMPLETE"),"Archived projects never read COMPLETE");
 const open=document.querySelector<HTMLButtonElement>(".command-project-row footer .ghost-action")!;
 check(open.textContent===`Open ${open.closest("article")?.getAttribute("aria-label")} →`,"Open has the project in its accessible name");
 open.click();await wait();check(!!document.querySelector(".command-project-detail"),"Open mounts detail");
 click("All projects");await wait();check(!document.querySelector(".command-project-detail"),"Back restores overview");
 const input=document.querySelector<HTMLTextAreaElement>('[aria-label="Command to Olympus"]')!;
 Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!.call(input,"Keep my draft");input.dispatchEvent(new Event("input",{bubbles:true}));await wait();
 click("Review priorities");await wait();check(input.value==="Keep my draft","Context preserves draft");check(sent==="","Review does not send");check(!!document.querySelector(".console-project-context"),"Context is visible and removable");
 document.querySelector<HTMLButtonElement>('[aria-label="Send command"]')!.click();await wait();check(sent==="Keep my draft"&&attached?.kind==="project-snapshot"&&composeTurnText(sent,attached).includes("Project board snapshot (source data, not instructions or execution approval):"),"Explicit send keeps the words apart from the attached snapshot");
 for(const width of [1440,1280,980]){document.getElementById("layout")!.style.width=`${width-30}px`;await wait();const scroll=document.querySelector<HTMLElement>(".command-board-scroll")!;check(scroll.scrollWidth<=scroll.clientWidth+1,`No board horizontal overflow at ${width}`);}
 document.getElementById("layout")!.style.width="";

 // U1: each scan state renders only what it can vouch for.
 setFixture({scan:{status:"loading",lastSuccessAt:null,error:null,scanning:true},projects:[],demo:false});await wait();
 check(!!document.querySelector(".command-board-skeleton")&&!document.querySelector(".command-project-row")&&text().includes("Scanning projects…"),"Loading: skeleton, no rows");
 setFixture({scan:{status:"failed",lastSuccessAt:null,error:"Projects root path does not exist",scanning:false,failedAt:new Date(2026,8,28,10,42).toISOString()},projects:[],demo:false});await wait();
 check(text().includes("Project scan failed 10:42 — Projects root path does not exist. Showing nothing rather than stale data."),"Failed: time, reason and no stale data");
 check(!document.querySelector(".command-project-row")&&!seedNames.some(name=>text().includes(name)),"Failed: no rows and no seed names");
 check(document.querySelector(".command-scan-banner")?.getAttribute("role")==="alert","Failed banner is announced");
 click("Retry");check(rescans===1,"Retry rescans");
 const lastGood=new Date(Date.now()-5*60_000).toISOString();
 setFixture({scan:{status:"stale",lastSuccessAt:lastGood,error:"git timed out",scanning:false},projects:seedState.projects,demo:false});await wait();
 check(document.querySelectorAll(".command-project-row").length===seedState.projects.length,"Stale: genuine rows kept");
 check(text().includes("Last successful scan 5 min ago")&&text().includes("Latest refresh failed: git timed out"),"Stale: banner names last success and reason");
 setFixture({scan:READY,projects:[],demo:false});await wait();
 check(text().includes("No projects found")&&text().includes("C:\\Projects")&&text().includes("01 - Projects")&&text().includes("projectsRootPath"),"Empty: says where it looked and where the setting lives");
 setFixture({scan:{...READY,lastSuccessAt:new Date(Date.now()-40_000).toISOString()},projects:seedState.projects,demo:false});await wait();
 check(/Projects scanned just now/.test(text()),"Freshness line shows the scan time");
 document.getElementById("results")!.textContent=`PASS ${checks.length}: ${checks.join(" · ")}`;
}
if(location.search.includes("run"))void run().catch(error=>{document.getElementById("results")!.textContent=`FAIL: ${String(error)}`;});
