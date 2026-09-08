import {createRoot} from "react-dom/client";
import {useState} from "react";
import {ProjectsPanel} from "./components/panels/ProjectsPanel";
import {ChatPanel} from "./components/panels/ChatPanel";
import {seedState} from "./data/seed";
import "./styles.css";
let sent = "";
function Fixture() {
  const [selected,setSelected] = useState<string|null>(null);
  return <><output id="results" style={{position:"fixed",top:0,left:0,color:"white",zIndex:100,fontSize:11}}>Running…</output><div id="layout" style={{position:"fixed",inset:"35px 15px 15px",display:"grid",gridTemplateColumns:"minmax(0,1fr) 380px",gap:16}}><ProjectsPanel projects={seedState.projects} sessionBoundary={null} projectFilter={selected} onClearFilter={()=>setSelected(null)} onFocusProject={setSelected} onOpenNote={()=>{}} onSyncCanvas={async()=>({tone:"success",message:"Fixture only"})}/><div style={{display:"flex",alignItems:"flex-end",minHeight:0}}><ChatPanel messages={[]} onSendMessage={value=>{sent=value;}} onRecordObservation={async()=>({tone:"success",message:"Fixture only"})}/></div></div></>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
const wait = () => new Promise(resolve=>setTimeout(resolve,150));
const checks:string[]=[];
function check(value:unknown,label:string){if(!value)throw Error(label);checks.push(label);}
function click(text:string){const button=[...document.querySelectorAll("button")].find(b=>b.textContent?.includes(text));if(!button)throw Error(text);button.click();}
async function run(){
 await wait();await wait();
 check(document.querySelectorAll(".command-project-row").length===seedState.projects.length,"All projects summarized");
 check(!document.querySelector(".command-project-detail"),"No hidden reports mounted");
 click("MONITORING");await wait();check([...document.querySelectorAll(".command-operational-status")].every(n=>n.textContent==="MONITORING"),"Filter restricts rows");
 click("ALL");await wait();click("Open project");await wait();check(!!document.querySelector(".command-project-detail"),"Open mounts detail");
 click("All projects");await wait();check(!document.querySelector(".command-project-detail"),"Back restores overview");
 const input=document.querySelector<HTMLTextAreaElement>('[aria-label="Command to Olympus"]')!;
 Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!.call(input,"Keep my draft");input.dispatchEvent(new Event("input",{bubbles:true}));await wait();
 click("Review priorities");await wait();check(input.value==="Keep my draft","Context preserves draft");check(sent==="","Review does not send");check(!!document.querySelector(".console-project-context"),"Context is visible and removable");
 document.querySelector<HTMLButtonElement>('[aria-label="Send command"]')!.click();await wait();check(sent.includes("Keep my draft")&&sent.includes("Project board snapshot"),"Explicit send includes context");
 for(const width of [1440,1280,980]){document.getElementById("layout")!.style.width=`${width-30}px`;await wait();const scroll=document.querySelector<HTMLElement>(".command-board-scroll")!;check(scroll.scrollWidth<=scroll.clientWidth+1,`No board horizontal overflow at ${width}`);}
 document.getElementById("layout")!.style.width="";
 document.getElementById("results")!.textContent=`PASS ${checks.length}: ${checks.join(" · ")}`;
}
if(location.search.includes("run"))void run().catch(error=>{document.getElementById("results")!.textContent=`FAIL: ${String(error)}`;});
