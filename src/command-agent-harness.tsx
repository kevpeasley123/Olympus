import {createRoot} from "react-dom/client";
import {useState} from "react";
import {mockIPC} from "@tauri-apps/api/mocks";
import {BookOpen,Network,Layers,MessageSquare} from "lucide-react";
import {BackgroundLayer} from "./components/BackgroundLayer";
import {CommandInstrument} from "./components/panels/CommandInstrument";
import {CommandAgentCatalog} from "./components/panels/CommandAgentCatalog";
import {ChatPanel} from "./components/panels/ChatPanel";
import {HeaderBar} from "./components/panels/HeaderBar";
import {ResearchVerification} from "./components/panels/ResearchVerification";
import type {CommandCatalog,CommandCatalogClient} from "./services/commandAgents";
import type {ResearchClient,ResearchRun,AgentCatalog} from "./services/researchVerification";
import type {TrackedProject,ConversationMessage} from "./types";
import {EMPTY_VAULT_GRAPH,type VaultGraphPayload} from "./services/vaultGraph";
import {runProjectRingHarness} from "./services/projectRing.harness";
import {runGlyphStateHarness} from "./services/glyphState.harness";
import {runAmbientMotionHarness} from "./services/ambientMotion.harness";
import catalogFixture from "./services/commandAgentsFixture.json";
import inspectionFixture from "./services/researchVerificationFixture.json";
import "./styles.css";

let scenario="empty",reads=0,mutations=0,reduced=false;
const listeners=new Set<()=>void>();const originalMatchMedia=window.matchMedia.bind(window);
window.matchMedia=((query:string)=>query==='(prefers-reduced-motion: reduce)'?{get matches(){return reduced},addEventListener:(_:string,f:()=>void)=>listeners.add(f),removeEventListener:(_:string,f:()=>void)=>listeners.delete(f),addListener:(f:()=>void)=>listeners.add(f),removeListener:(f:()=>void)=>listeners.delete(f)}:originalMatchMedia(query)) as typeof window.matchMedia;
const projects:TrackedProject[]=["Olympus","Pokedex","Agentic AI","AI Learning","Fidelity","Obsidian","Health App","Fruit Organizer"].map((name,i)=>({id:`p${i}`,name,path:`C:/fixture/${i}`,status:i===0?"active":"watching",statusSource:"declared",promoted:null,branch:"main",lastCommit:"fixture",lastCommitAt:null,repoState:"git-active",recentCommits:[],sinceSessionCommits:[],linkedWorktrees:[],summary:"",vision:"",visionReviewedAt:null,nextStep:"",notePath:`project-${i}.md`,warnings:[]}));
const graph:VaultGraphPayload={...EMPTY_VAULT_GRAPH,nodes:projects.map(p=>({id:p.notePath!,title:p.name,folder:"Projects",isProject:true,degree:1,hop:0})),edges:[]};
for(let i=0;i<32;i++){const id=`note-${i}.md`;graph.nodes.push({id,title:`Synthetic note ${i}`,folder:"Research",isProject:false,degree:1,hop:1});graph.edges.push({from:projects[i%projects.length].notePath!,to:id});}
mockIPC(command=>{if(command==="fetch_vault_graph")return graph;if(command==="fetch_recent_vault_writes")return [];if(command==="fetch_operator_profile")return null;if(command==="model_routes")return {routes:[{capability:"PRIMARY",provider:"openai",model:"fixture-only",label:"Sol",effort:"medium"}],realtime:"fixture",transcription:"fixture",coding:"fixture"};throw Error(`Unexpected fixture IPC: ${command}`)});
const client:CommandCatalogClient={read:async()=>{
  reads++;if(scenario==="error")throw Error("Synthetic runtime unavailable");
  const fixture=catalogFixture as unknown as {empty:CommandCatalog;history:CommandCatalog};
  const value=structuredClone(scenario==="history"?fixture.history:fixture.empty);
  if(scenario==="unavailable")value.agents.filter(a=>a.kind==="agent").forEach(a=>{a.status="UNAVAILABLE";a.tone="unavailable";a.availability="Synthetic missing credentials"});
  if(scenario==="six")for(let i=0;i<4;i++)value.agents.push({...structuredClone(value.agents[0]),id:`fixture-${i}`,name:`Fixture executor ${i+1}`,description:"Synthetic executable role for layout testing only."});
  return value;
}};
const readOnlyResearch:ResearchClient={
  catalog:async()=>structuredClone(inspectionFixture.catalog) as unknown as AgentCatalog,
  list:async()=>[{id:"parent",question:"Synthetic question",status:"completed",startedAt:inspectionFixture.run.startedAt,agentIds:["research","verification"]}],
  inspect:async id=>({...structuredClone(inspectionFixture.run),id}) as unknown as ResearchRun,
  start:async()=>{mutations++;throw Error("Inspection must never start")},cancel:async()=>{mutations++;throw Error("Inspection must never cancel")},
};
const messages:ConversationMessage[]=Array.from({length:14},(_,i)=>({id:`m${i}`,role:i%2?"assistant":"user",timestamp:"12:04",content:i%2?"This is synthetic conversation evidence for the Command layout. The real catalog is read-only. ".repeat(3):"Show the available operational roles."}));
function Harness(){const [key,setKey]=useState(0),[selected,setSelected]=useState("olympus"),[destination,setDestination]=useState<null|{runId?:string;projects?:boolean}>(null);
  return <><BackgroundLayer/><main className="app-shell mode-command"><div className="panel-slot panel-slot-header"><HeaderBar mode="command" onSelectMode={()=>{}} projects={projects}/></div>
    <div className="dashboard-body"><section className="main-grid">
      <aside className="tools-rail dashboard-column panel-shell surface-chrome" aria-label="Global icon rail">{[Layers,MessageSquare,BookOpen,Network].map((Icon,i)=><span key={i} style={{padding:"12px 8px",color:"#a9b7c5"}}><Icon size={17}/></span>)}</aside>
      <CommandAgentCatalog key={key} client={client} available selectedId={selected} onSelect={setSelected} onResearch={runId=>setDestination({runId})} onProjects={()=>setDestination({projects:true})}/>
      <section className="center-stack dashboard-column"><div className="panel-slot panel-slot-instrument"><CommandInstrument projects={projects} tasks={[]} tasksLoading={false} tasksError={null} onSelectProject={()=>{}} onOpenNote={()=>{}}/></div></section>
      <section className="right-stack dashboard-column"><div className="panel-slot panel-slot-chat"><ChatPanel messages={messages} onSendMessage={()=>{mutations++}} onRecordObservation={async()=>{mutations++;return {tone:"error",message:"Fixture only"}}}/></div></section>
    </section></div>
    <div className="command-fixture-controls"><span>SYNTHETIC · no live observations</span><label>Fixture <select aria-label="Agent catalog fixture" defaultValue="empty" onChange={e=>{scenario=e.target.value;setKey(n=>n+1)}}>{["empty","history","unavailable","six","error"].map(s=><option key={s}>{s}</option>)}</select></label><button onClick={()=>{reduced=!reduced;listeners.forEach(f=>f())}}>Toggle reduced motion</button><details><summary>Test results</summary><pre id="result">Manual visual study</pre></details></div>
    {destination&&<section className="command-fixture-inspector" aria-label="Existing inspection destination">{destination.projects?<><button onClick={()=>setDestination(null)}>Return to Command catalog</button><p>Project delegation destination · fixture only</p></>:<ResearchVerification client={readOnlyResearch} available requestedRunId={destination.runId} inspectionOnly onReturn={()=>setDestination(null)}/>}</section>}
  </main><style>{`.command-fixture-controls{position:fixed;left:18px;bottom:3px;right:18px;display:flex;align-items:center;gap:14px;font:9px monospace;z-index:30;color:#acbacb}.command-fixture-controls button,.command-fixture-controls select{font:9px monospace;background:#10202d;color:#bdcbd8;border:1px solid #64798c55;padding:2px 5px}.command-fixture-controls details{margin-left:auto}.command-fixture-controls pre{position:absolute;bottom:20px;right:0;max-height:55vh;max-width:80vw;overflow:auto;white-space:pre-wrap;background:#07121e;padding:14px;border:1px solid #526479}.command-fixture-inspector{position:fixed;inset:90px 20px 35px;overflow:auto;z-index:40;background:#0a1522;border:1px solid #64798c;padding:15px}`}</style></>;
}
createRoot(document.getElementById("root")!).render(<Harness/>);
const wait=(ms=180)=>new Promise(r=>setTimeout(r,ms));
async function checks(){const results:string[]=[];const check=(condition:unknown,label:string)=>{if(!condition)throw Error(label);results.push(label)};
 const query=<T extends HTMLElement>(selector:string)=>document.querySelector<T>(selector)!;
 const click=(text:string)=>{const button=[...document.querySelectorAll<HTMLButtonElement>("button")].find(b=>b.textContent?.includes(text));if(!button)throw Error("Missing "+text);button.click()};
 const fixture=async(value:string)=>{const input=query<HTMLSelectElement>('[aria-label="Agent catalog fixture"]');input.value=value;input.dispatchEvent(new Event("change",{bubbles:true}));await wait()};
 const detail=()=>query('.agent-selected-detail').textContent??"";
 const layout=()=>{
   const catalog=query('.command-agent-catalog').getBoundingClientRect(),dial=query('.command-instrument__dial').getBoundingClientRect(),right=query('.right-stack').getBoundingClientRect(),chat=query('.command-console').getBoundingClientRect(),rail=query('.tools-rail').getBoundingClientRect();
   check(rail.right<=catalog.left&&catalog.right<=dial.left+2&&dial.right<=right.left+2,"Rail → catalog → unchanged instrument → reserved chat do not overlap");
   check(chat.left>=right.left-1&&chat.right<=right.right+1&&chat.top>=right.top-1&&chat.bottom<=right.bottom+1,"Chat stays within its reserved column");
   const center=query('.center-stack').getBoundingClientRect();check(Math.abs((dial.left+dial.right)/2-(center.left+center.right)/2)<8,"Instrument remains centered in the middle zone");
 };
 try{await wait(800);for(let i=0;i<80&&!document.querySelector('[data-scene-ready="true"]');i++)await wait(100);
  check(document.querySelector('[data-scene-ready="true"]'),"Existing hybrid instrument initializes");
  check(query('.command-agent-catalog').textContent?.includes("1 orchestrator · 3 agents"),"Count excludes the separate orchestrator");
  check(document.querySelectorAll('.agent-role-row').length===4,"Only Olympus and three real role fixtures appear");
  check(!query('.command-agent-catalog').textContent?.match(/Research Analyst|Project Architect|Daily Briefing|Obsidian Curator|Strategy General|Project Soldier/),"No documentary candidates enter the operational HUD");
  check(detail().includes("Main orchestrator")&&!detail().includes("Full system"),"Olympus has bounded real orchestration authority");
  layout();const baseline=query('.command-instrument__dial').getBoundingClientRect();
  click("Research Agent");await wait();check(detail().includes("Research Retrieval")&&detail().includes("Evidence Synthesis")&&detail().includes("No recorded executions yet"),"Research shows real skills, scope, version and empty history");
  click("Verification Agent");await wait();check(detail().includes("Claim Verification")&&detail().includes("Research Agent"),"Verification has its separate skill and declared peer");
  click("Coding Delegate");await wait();check(detail().includes("Legacy / unversioned")&&detail().includes("UNPROVEN")&&detail().includes("No completed Olympus delegation runs"),"Coding stays unversioned and unproven");
  await fixture("unavailable");click("Research Agent");await wait();check(detail().includes("UNAVAILABLE")&&detail().includes("Synthetic missing credentials"),"Missing dependencies cannot display ready");
  await fixture("history");check(detail().includes("2 executions")&&document.querySelectorAll('.agent-recent-runs button').length===2,"Persisted child execution count and saved history are displayed");
  query<HTMLButtonElement>('.agent-recent-runs button').click();await wait();check(query('.command-fixture-inspector').textContent?.includes("research-verification/v1 · parent"),"Recent execution opens its parent run in existing inspector");
  check(!document.querySelector('.command-fixture-inspector form')&&!query('.command-fixture-inspector').textContent?.includes("Cancel this run"),"Deep-linked inspection exposes no execution controls");click("Return to Command catalog");await wait();
  click("Research Verification v1");await wait();check(query('.command-fixture-inspector').textContent?.includes("Research Verification · inspection"),"Declared graph opens the existing read-only workflow surface");click("Return to Command catalog");await wait();
  await fixture("six");check(document.querySelectorAll('.agent-role-row').length===8&&query('.agent-catalog-list').scrollHeight>query('.agent-catalog-list').clientHeight,"Future executable fixtures scroll vertically without fixed slots");
  await fixture("error");check(!document.querySelector('.agent-status')&&query('.command-agent-catalog').textContent?.includes("Catalog unavailable"),"Read failure removes stale ready claims");
  await fixture("empty");click("Olympus Core");await wait();
  query<HTMLTextAreaElement>('[aria-label="Command to Olympus"]').focus();await wait(500);check(query('.command-console').dataset.mode==="engaged","Compact console opens upward");layout();
  query<HTMLButtonElement>('[aria-label="Open conversation history"]').click();await wait(500);check(query('.command-console').dataset.mode==="transcript","Full history expansion uses the right reserve");layout();
  check(Math.abs(query('.command-instrument__dial').getBoundingClientRect().width-baseline.width)<1,"Chat expansion does not resize instrument geometry");
  query<HTMLTextAreaElement>('[aria-label="Command to Olympus"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await wait();query<HTMLTextAreaElement>('[aria-label="Command to Olympus"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await wait();
  check(query('.command-console').dataset.mode==="dormant","Collapsed console returns to bottom-right compact state");
  click("Toggle reduced motion");await wait(900);const canvas=query<HTMLCanvasElement>('.hybrid-core canvas'),frames=canvas.dataset.frames;await wait(700);check(canvas.dataset.frames===frames,"Reduced motion freezes the existing GPU instrument");
  check([...document.querySelectorAll('.command-agent-catalog *')].every(el=>getComputedStyle(el).animationName==="none"),"Catalog introduces no ambient animation");
  check(runProjectRingHarness().passed,"Existing project-ring geometry and label checks pass");
  check(runGlyphStateHarness().passed,"Existing glyph-state checks pass");
  check(runAmbientMotionHarness().passed,"Existing ambient-motion checks pass");
  check(mutations===0&&reads>0,"Catalog selection, refresh and cross-links perform reads only");check(document.documentElement.scrollWidth<=innerWidth+2,"Desktop composition has no horizontal overflow");
  query('#result').textContent=results.map(r=>'PASS '+r).join('\n')+`\n${results.length} Command/catalog checks passed`;
 }catch(e){query('#result').textContent=results.map(r=>'PASS '+r).join('\n')+'\nFAIL '+String(e)}
}
if(location.search.includes('check'))void checks();
