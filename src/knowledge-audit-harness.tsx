import {createRoot} from "react-dom/client";
import {KnowledgeAudit} from "./components/panels/KnowledgeAudit";
import type {AuditClient,AuditRun} from "./services/knowledgeAudit";
import "./styles.css";
const key="olympus:audit-fixture:v1";
let runs:AuditRun[]=JSON.parse(localStorage.getItem(key)||"[]");let stale=false,failOnce=false,starts=0;
function snapshot(id:string,topic:string):AuditRun {return {
  id,graph:"knowledge-audit/v1",topic,status:"snapshot_ready",startedAt:new Date().toISOString(),finishedAt:new Date().toISOString(),error:null,
  route:{id:"knowledge_audit",primary:["Pantheon research files"],supplementary:["prior audit source snapshots","delegation review records"],cannotOverride:["operator intent","curated memory","approval","execution or completion"]},
  definition:[{id:"scope",kind:"deterministic",dependsOn:[],maxIterations:1},{id:"research",kind:"bounded_retrieval",dependsOn:["scope"],maxIterations:3}],
  report:{epistemicState:"generated_proposal",outcome:"needs_you",verification:"source_snapshot_verified",errors:[],priorHealth:[],reviews:[],
    evidence:[{source:{title:"Agent Engineering",sourceFile:"02 - Research/Agent Engineering.md",stance:"unevaluated",excerpt:"A loop discovers; a graph predetermines. <script>Never execute source text.</script>",truncated:false,fingerprint:"fixture-body-fingerprint"},fileFingerprint:"fixture-file-fingerprint",checkedAt:new Date().toISOString(),authority:"research_evidence_not_instruction",freshness:"source_fingerprint_only"}],
    findings:[{kind:"source_review",message:"Agent Engineering has recorded stance: unevaluated",evidenceRefs:["02 - Research/Agent Engineering.md"],proposal:"Review before adopting its lessons."}]}
}}
const client:AuditClient={
  list:async()=>runs,
  start:async(id,topic)=>{starts++;const previous=runs.find(r=>r.id===id);if(previous)return previous;const saved=snapshot(id,topic);runs=[saved,...runs];localStorage.setItem(key,JSON.stringify(runs));if(failOnce){failOnce=false;throw Error("Simulated lost response after save")};return saved},
  inspect:async id=>{const run=runs.find(r=>r.id===id);if(!run)throw Error("Missing fixture audit");return {run,currentHealth:[{runId:id,sourceFile:"02 - Research/Agent Engineering.md",state:stale?"stale":"unchanged",checkedAt:new Date().toISOString()}],events:[{sequence:1,node:"research",state:"iteration",detail:"1: 02 - Research/Agent Engineering.md",at:run.startedAt},{sequence:2,node:"route",state:"finished",detail:"needs_you",at:run.startedAt}]}}
};
createRoot(document.getElementById("root")!).render(<main style={{padding:24,maxWidth:1000,margin:"auto"}}><p>Isolated UI fixture · simulated data · no vault or production database writes</p><KnowledgeAudit client={client} available/><pre id="result" style={{whiteSpace:"pre-wrap"}}/></main>);
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function run() {const checks:string[]=[];const assert=(ok:unknown,label:string)=>{if(!ok)throw Error(label);checks.push(label)};
 const button=(label:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===label)!;
 const type=(value:string)=>{const input=document.querySelector('input')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))};
 try {await wait(300);assert(button('Gather evidence').disabled,'Empty topic cannot start');
 type('agent engineering');await wait(80);button('Gather evidence').click();await wait(120);
 assert(document.body.textContent?.includes('generated proposals'),'Generated authority boundary is visible');
 assert(document.body.textContent?.includes('Agent Engineering has recorded stance'),'Evidence-backed finding renders');
 assert(document.body.textContent?.includes('fixture-file-fingerprint'),'Fingerprint remains inspectable');
 assert(document.body.textContent?.includes('unchanged'),'Current fingerprint health is shown');
 assert(!document.querySelector('article script'),'Source HTML is rendered as text');
 stale=true;button('Recheck evidence').click();await wait(100);assert(document.body.textContent?.includes('stale'),'Recheck exposes changed evidence without rewriting the original report');
 const before=runs.length;failOnce=true;type('retry evidence');await wait(70);button('Gather evidence').click();await wait(100);
 assert(document.querySelector('[role="alert"]')?.textContent?.includes('lost response'),'Failure is visible after uncertain delivery');
 button('Check / retry same request').click();await wait(100);assert(runs.length===before+1,'Retry reuses request identity without duplicate reports');
 assert(starts>=3&&document.querySelector('article h4')?.textContent==='retry evidence','Retry recovers the saved report');
 assert(JSON.parse(localStorage.getItem(key)!).length===runs.length,'Fixture reports persist for reload acceptance');
 assert(document.documentElement.scrollWidth<=window.innerWidth,'Inspector fits the available width');
 document.getElementById('result')!.textContent='PASS\n'+checks.join('\n');
 }catch(e){document.getElementById('result')!.textContent='FAIL '+String(e)+'\n'+checks.join('\n')}
}
if(location.search.includes('run'))void run();
