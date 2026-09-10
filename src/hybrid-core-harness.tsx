import {BackgroundLayer} from "./components/BackgroundLayer";
import {createIdleCoreCycle,OMEGA_IDLE,coreGlowEnvelope,heartbeatAge,MATERIAL_TUNING} from "./services/commandMaterialStudy";
import {createRoot} from "react-dom/client";
import {useEffect,useState} from "react";
import {mockIPC} from "@tauri-apps/api/mocks";
import {CommandInstrument} from "./components/panels/CommandInstrument";
import {commandLayout,nodeDepth,CONSTELLATION_DEPTH,HYBRID_OVERLAY_TRANSFORM} from "./services/hybridCore";
import {runProjectConstellationHarness} from "./services/projectConstellation.harness";
import {EMPTY_VAULT_GRAPH,type VaultGraphPayload} from "./services/vaultGraph";
import type {TrackedProject} from "./types";
import type {OlympusVisualState} from "./services/ambientMotion";
import "./styles.css";
let reduced=false, visibility="visible";
const motionListeners=new Set<()=>void>();
const nativeMatchMedia=window.matchMedia.bind(window);
window.matchMedia=((query:string)=>query==='(prefers-reduced-motion: reduce)'?{get matches(){return reduced},addEventListener:(_:string,fn:()=>void)=>motionListeners.add(fn),removeEventListener:(_:string,fn:()=>void)=>motionListeners.delete(fn)}:nativeMatchMedia(query)) as typeof window.matchMedia;
Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>visibility});
const names=["Olympus","Pokedex","Agentic AI","AI Learning","Fidelity","Obsidian","Health App","Fruit Organizer"];
const projects:TrackedProject[]=names.map((name,i)=>({id:`p${i}`,name,path:`C:/fixture/${i}`,status:i===0?"active":"watching",statusSource:"declared",promoted:null,branch:"main",lastCommit:"fixture",lastCommitAt:null,repoState:"git-active",recentCommits:[],sinceSessionCommits:[],linkedWorktrees:[],summary:"",vision:"",visionReviewedAt:null,nextStep:"",notePath:`project-${i}.md`,warnings:[]}));
const graph:VaultGraphPayload={...EMPTY_VAULT_GRAPH,nodes:projects.map(p=>({id:p.notePath!,title:p.name,folder:"Projects",isProject:true,degree:1,hop:0})),edges:[]};
for(let i=0;i<64;i++){const id=`note-${String(i).padStart(3,"0")}.md`;graph.nodes.push({id,title:id,folder:`Folder ${i%4}`,isProject:false,degree:2,hop:1});graph.edges.push({from:projects[i%8].notePath!,to:id});}
mockIPC(command=>{if(command==="fetch_vault_graph")return graph;if(command==="fetch_recent_vault_writes")return [];if(command==="fetch_operator_profile")return null;throw Error(`Unexpected fixture command: ${command}`);});

function Fixture(){const [environment,setEnvironment]=useState(new URLSearchParams(location.search).has("environment"));const [operation,setOperation]=useState(0);const [previewVoice,setPreviewVoice]=useState(0);const [state,setState]=useState<OlympusVisualState>("idle");const [action,setAction]=useState("Fixture data · no project writes");
useEffect(()=>{
  if(state!=="speaking"){setPreviewVoice(0);return;}
  const start=performance.now();
  const timer=window.setInterval(()=>{
    const t=(performance.now()-start)/1000;
    // Fixture-only syllables and phrase pauses. Live rendering uses supplied audio levels.
    setPreviewVoice(t%4.2>3.15?0:Math.max(0,Math.sin(t*13))*(.55+.35*Math.sin(t*2.3)**2));
  },50);
  return ()=>window.clearInterval(timer);
},[state]);
return <>{environment&&<BackgroundLayer/>}<style>{`.study-controls button{display:block;width:100%;margin-top:8px;padding:9px;background:#101d2b;border:1px solid #3a5266;color:#cedce7;text-align:left;font:11px monospace;cursor:pointer}.study-controls button:hover{border-color:#c58343}@media(max-width:800px){.study-controls{position:relative!important;left:auto!important;top:auto!important;width:auto!important;padding:20px}.study-main{padding-left:0!important;height:calc(100vw + 30px)!important}.study-main .command-instrument__dial{width:calc(100vw - 24px)!important;height:calc(100vw - 24px)!important}}`}</style><aside className="study-controls" style={{position:"fixed",left:24,top:24,width:220,zIndex:5}}><h2>OLYMPUS MATERIAL STUDY</h2><label>System state <select value={state} onChange={e=>setState(e.target.value as OlympusVisualState)}>{["idle","listening","thinking","speaking","executing","complete","error"].map(s=><option key={s}>{s}</option>)}</select></label><p>{action}</p><button onClick={()=>setEnvironment(value=>!value)}>{environment?"Hide environment":"Show Olympus environment"}</button>{state==="speaking"&&<small>Simulated speech amplitude · preview only</small>}{state==="executing"&&<div><small>Simulated execution · Olympus</small><button onClick={()=>setOperation(n=>n+1)}>Simulate completed operation</button><button onClick={()=>setState("complete")}>Simulate execution finished</button></div>}{state==="error"&&<div role="alert"><small>Simulated error · Olympus</small><p style={{color:"#dc976f",fontSize:12}}>The operation could not finish. Your project is preserved.</p><button onClick={()=>setState("executing")}>Retry simulated operation</button><button onClick={()=>setState("idle")}>Dismiss and return to idle</button></div>}<pre id="result" style={{whiteSpace:"pre-wrap",fontSize:11}}>Glass modules + living core</pre></aside><main className="study-main" style={{height:"100vh",paddingLeft:200}}><CommandInstrument projects={projects} tasks={[]} tasksLoading={false} tasksError={null} visualState={state} voiceLevel={previewVoice} execution={state==="executing"||state==="error"?{projectId:projects[0].id,operation}:undefined} onSelectProject={id=>setAction(`Selected ${id}`)} onOpenNote={id=>setAction(`Opened ${id}`)}/></main></>}
createRoot(document.getElementById("root")!).render(<Fixture/>);
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function run(){const checks:string[]=[];const assert=(ok:unknown,msg:string)=>{if(!ok)throw Error(msg);checks.push(msg);document.getElementById("result")!.textContent=checks.join("\n")};const ready=async()=>{for(let i=0;i<100;i++){if(document.querySelector('[data-scene-ready="true"]'))return;await wait(100);}throw Error("3D did not initialize");};
try{await wait(600);
const idleCycle=createIdleCoreCycle(()=>0);
assert(idleCycle(0,true).envelope===1,'Idle starts at baseline');
const primary=idleCycle(OMEGA_IDLE.heartbeatMinInterval+OMEGA_IDLE.primaryDuration*.4,true);
assert(Math.abs(primary.pulse-OMEGA_IDLE.primaryStrength)<.00001,'Idle primary pulse follows scheduled interval');
const secondary=idleCycle(OMEGA_IDLE.secondaryDelay+OMEGA_IDLE.secondaryDuration*.4-OMEGA_IDLE.primaryDuration*.4,true);
assert(Math.abs(secondary.pulse-OMEGA_IDLE.secondaryStrength)<.00001&&secondary.pulse<primary.pulse,'Idle secondary pulse is delayed and weaker');
assert(secondary.ripple>0&&secondary.rippleProgress<1,'One faint idle ripple follows primary pulse');
assert(idleCycle(10,false).envelope===1&&idleCycle(0,false).ripple===0,'Reduced motion suppresses idle breathing and ripple');
assert(idleCycle(3,true).pulse===0,'Idle heartbeat settles');
const lateCycle=createIdleCoreCycle(()=>1);
assert(lateCycle(OMEGA_IDLE.heartbeatMinInterval+.32,true).pulse===0,'Random interval varies heartbeat onset');
assert(coreGlowEnvelope(2.65,true)>1.12 && coreGlowEnvelope(0,true)===1,"5.3-second core breath");const baseline=(t:number)=>1+MATERIAL_TUNING.breathGain*(.5-.5*Math.cos(t*Math.PI*2/MATERIAL_TUNING.breathSeconds));assert(coreGlowEnvelope(12.025,true)-baseline(12.025)>.119,"Primary machine pulse");assert(coreGlowEnvelope(12.875,true)-baseline(12.875)>.054,"Weaker secondary machine pulse");assert(MATERIAL_TUNING.heartbeatIntervals.every(t=>t>=11&&t<=15)&&new Set(MATERIAL_TUNING.heartbeatIntervals).size>1,"Irregular 11–15 second heartbeat intervals");assert(heartbeatAge(25.9)<.001,"Second irregular event starts on schedule");assert(coreGlowEnvelope(12.1,false)===1,"Reduced motion freezes core envelope");await wait(600);const original=[...document.querySelectorAll('.project-ring__hit')].map(e=>e.getAttribute('d'));assert(runProjectConstellationHarness().passed,"Existing constellation invariants");const layout=commandLayout(projects,graph,1);assert(layout.constellation.nodes.every(n=>Number.isFinite(nodeDepth(n.id))&&Math.abs(nodeDepth(n.id))<=CONSTELLATION_DEPTH.range),"Bounded deterministic node depth");await ready();await wait(600);assert(JSON.stringify(original)===JSON.stringify([...document.querySelectorAll('.project-ring__hit')].map(e=>e.getAttribute('d'))),"Project hit geometry unchanged");assert(document.querySelectorAll('.hybrid-core canvas').length===1,"One WebGL canvas");const canvas=document.querySelector<HTMLCanvasElement>('.hybrid-core canvas')!;assert(canvas.dataset.nodes==='64',"All 64 real fixture nodes retained");assert(canvas.dataset.rings==='2',"Exactly two continuous rings");document.querySelector<SVGElement>('.project-ring__hit')!.dispatchEvent(new MouseEvent('click',{bubbles:true}));await wait(100);assert(document.body.textContent?.includes('Selected p'),"Existing project action preserved");assert(!document.querySelector('.omega-presence')&&!document.querySelector('[data-renderer="svg"]'),"No legacy Omega or SVG renderer");
// Read the composited canvas in-frame: opacity is a pixel property, not a material flag.
const alphaAt=await new Promise<number[]>(resolve=>requestAnimationFrame(()=>{
  const gl=canvas.getContext('webgl2')!,pixel=new Uint8Array(4);
  resolve([[.5,.68],[.38,.5],[.6,.4],[.02,.02]].map(([x,y])=>{
    gl.readPixels(Math.floor(canvas.width*x),Math.floor(canvas.height*y),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
    return pixel[3];
  }));
}));
assert(alphaAt.slice(0,3).every(alpha=>alpha===255),'Portal interior is fully opaque after compositing');
assert(alphaAt[3]===0,'Canvas outside the portal remains transparent');
// Sample the open twelve-o'clock project gap, where glass cannot mask a hard cutoff.
const portalGap=await new Promise<number[]>(resolve=>requestAnimationFrame(()=>{
  const gl=canvas.getContext('webgl2')!,pixel=new Uint8Array(4);
  const projection=new DOMMatrix(HYBRID_OVERLAY_TRANSFORM);
  resolve([150,162,172,182,190].map(radius=>{
    const y=.5+projection.d*radius/440;
    // The oblique view shifts the recessed metal lip across the nominal gap.
    // Take its clearest pixel across a small horizontal span, avoiding that lip.
    let alpha=255;
    for(let offset=-6;offset<=6;offset+=.5){
      gl.readPixels(Math.floor(canvas.width*(.5+offset/440)),Math.floor(canvas.height*y),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
      alpha=Math.min(alpha,pixel[3]);
    }
    return alpha;
  }));
}));
assert(portalGap[0]===255,'Main portal remains opaque up to the project opening');
assert(portalGap[1]>portalGap[2]&&portalGap[2]>portalGap[3]&&portalGap[3]>0&&portalGap[4]<4,
  `Portal fades gradually through the outer ring gap (${portalGap.join(', ')})`);
assert(canvas.dataset.voiceSignature==='false','Voice signature absent while idle');
const stateSelector=document.querySelector('select')!;
stateSelector.value='speaking';stateSelector.dispatchEvent(new Event('change',{bubbles:true}));
await wait(900);
assert(canvas.dataset.voiceSignature==='true','Voice signature appears while speaking');
let minVoice=1,maxVoice=0;
for(let i=0;i<12;i++){await wait(100);const energy=Number(canvas.dataset.voiceSignatureEnergy);minVoice=Math.min(minVoice,energy);maxVoice=Math.max(maxVoice,energy);}
assert(maxVoice-minVoice>.08,'Voice signature follows changing speech energy');
stateSelector.value='idle';stateSelector.dispatchEvent(new Event('change',{bubbles:true}));
await wait(100);
assert(canvas.dataset.voiceSignature==='true','Voice signature fades rather than snapping off');
await wait(2800);
assert(canvas.dataset.voiceSignature==='false','Voice signature settles to absent after speech');
const depths=layout.constellation.nodes.map(n=>nodeDepth(n.id));
assert(depths.filter(z=>z>CONSTELLATION_DEPTH.range*.5).length>=8 && depths.filter(z=>z>CONSTELLATION_DEPTH.range*.5).length<=12,'Eight to twelve foreground anchors in the 64-node fixture');
assert(depths.filter(z=>z< -CONSTELLATION_DEPTH.range*.5).length>=10 && depths.filter(z=>z< -CONSTELLATION_DEPTH.range*.5).length<=15,'Ten to fifteen deep anchors in the 64-node fixture');
assert(layout.constellation.nodes.every((n,i)=>nodeDepth(n.id)===depths[i]),'Depth assignments are stable across repeated evaluation');
const dial=canvas.closest('.command-instrument__dial')!;
const bounds=canvas.getBoundingClientRect();
dial.dispatchEvent(new PointerEvent('pointermove',{clientX:bounds.right,clientY:bounds.top,pointerType:'mouse',bubbles:true}));
await wait(900);
const parallax=JSON.parse(canvas.dataset.parallax ?? '[0,0]');
assert(parallax[0]>.8&&parallax[1]>.8,'Pointer drives bounded constellation parallax');
dial.dispatchEvent(new PointerEvent('pointerleave'));
await wait(900);
assert(JSON.parse(canvas.dataset.parallax ?? '[1,1]').every((v:number)=>Math.abs(v)<.12),'Pointer exit returns constellation to rest');
canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext();await wait(400);
assert(document.querySelector('[data-scene-ready="false"]')&&document.body.textContent?.includes('Graphics context lost'),"Context loss hides the complete scene without 2D fallback");
(document.querySelector('.hybrid-status button') as HTMLButtonElement).click();await ready();
assert(document.querySelectorAll('.hybrid-core canvas').length===1,"Retry recreates one healthy 3D scene");
reduced=true;motionListeners.forEach(fn=>fn());await wait(850);let frozen=document.querySelector<HTMLCanvasElement>('.hybrid-core canvas')!.dataset.frames;await wait(800);assert(document.querySelector<HTMLCanvasElement>('.hybrid-core canvas')!.dataset.frames===frozen,'Reduced motion stops GPU animation');reduced=false;motionListeners.forEach(fn=>fn());await wait(700);assert(document.querySelector<HTMLCanvasElement>('.hybrid-core canvas')!.dataset.frames!==frozen,'Motion resumes');visibility='hidden';document.dispatchEvent(new Event('visibilitychange'));await wait(850);frozen=document.querySelector<HTMLCanvasElement>('.hybrid-core canvas')!.dataset.frames;await wait(800);assert(document.querySelector<HTMLCanvasElement>('.hybrid-core canvas')!.dataset.frames===frozen,'Hidden view stops GPU rendering');visibility='visible';document.dispatchEvent(new Event('visibilitychange'));await wait(700);assert(document.querySelector<HTMLCanvasElement>('.hybrid-core canvas')!.dataset.frames!==frozen,'Visible view resumes');
const originalContext=HTMLCanvasElement.prototype.getContext;
const lossExtension=document.querySelector<HTMLCanvasElement>('.hybrid-core canvas')!.getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,...args:any[]){return args[0]==='webgl2'?null:(originalContext as any).apply(this,args)} as any;
lossExtension.loseContext();await wait(300);
(document.querySelector('.hybrid-status button') as HTMLButtonElement).click();await wait(500);
assert(!document.querySelector('[data-renderer="svg"]')&&document.body.textContent?.includes('WebGL 2 is unavailable'),'Missing WebGL offers retry without legacy artwork');
HTMLCanvasElement.prototype.getContext=originalContext;
(document.querySelector('.hybrid-status button') as HTMLButtonElement).click();await ready();
document.getElementById('result')!.textContent='PASS\n'+checks.join('\n');}catch(e){document.getElementById('result')!.textContent='FAIL '+String(e)+'\n'+checks.join('\n');}}
if(location.search.includes('run'))void run();
