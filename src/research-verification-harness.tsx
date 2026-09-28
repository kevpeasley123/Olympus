import {useState} from "react";
import {createRoot} from "react-dom/client";
import {ResearchVerification} from "./components/panels/ResearchVerification";
import fixture from "./services/researchVerificationFixture.json";
import type {AgentCatalog,ResearchRun,ResearchClient,RunSummary} from "./services/researchVerification";
import "./styles.css";
const saved=fixture as unknown as {catalog:AgentCatalog;run:ResearchRun};
let starts=0,cancels=0,unavailable=false,cancelled=false;const opened:{sourceFile:string;excerpt?:string;fingerprint?:string;title?:string}[]=[];
function runFor(id:string):ResearchRun {
  const run=structuredClone(saved.run);run.id=id;
  if(id==="failed"){run.status="failed";run.error="invalid_research_schema";run.brief=null;run.agents=run.agents.slice(0,1);run.agents[0].status="failed";run.agents[0].output="invalid structured result" as unknown as ResearchRun["agents"][number]["output"];run.agents[0].request!.actualModel=null;run.messages=[];}
  if(id==="interrupted"){run.status="interrupted";run.error="Application restarted; end time unknown";run.finishedAt=null;run.brief=null;}
  if(id==="insufficient"){run.status="insufficient";run.brief!.insufficient=run.brief!.supported.map(item=>({...item,verification:{...item.verification,status:"INSUFFICIENT",evidence:[]}}));run.brief!.supported=[];}
  if(id==="running"||id.startsWith("new-")){run.status=cancelled?"cancelled":"running";run.brief=null;run.finishedAt=null;run.agents=run.agents.slice(0,1);run.agents[0].status=run.status;run.agents[0].finishedAt=null;run.agents[0].output=null;run.messages=[];}
  return run;
}
const ids=["completed","insufficient","failed","interrupted","delayed"];
const client:ResearchClient={
  catalog:async()=>{const c=structuredClone(saved.catalog);c.executable.forEach(a=>{a.version=2});c.availability.readyToAttempt=!unavailable;c.availability.reason=unavailable?"OpenAI credentials unavailable":null;return c},
  list:async()=>ids.map(id=>({id,question:`Synthetic ${id}`,status:runFor(id).status,startedAt:saved.run.startedAt,agentIds:["research","verification"]} as RunSummary)),
  inspect:async id=>{if(id==="delayed")await new Promise(r=>setTimeout(r,600));return runFor(id)},
  start:async(id,question)=>{starts++;cancelled=false;ids.push(`new-${id}`);const run=runFor(`new-${id}`);run.question=question;return run},
  cancel:async()=>{cancels++;cancelled=true},
};
function Harness(){const [key,setKey]=useState(0);const [available,setAvailable]=useState(true);
  return <main style={{maxWidth:1000,margin:"20px auto",padding:16}}><h1 style={{fontSize:20}}>Research pair · synthetic inspection study</h1><p>The saved fixture was exported from deterministic Rust tests. No API or real vault access.</p>
    <button onClick={()=>{unavailable=!unavailable;setKey(key+1)}}>Toggle unavailable</button><button onClick={()=>setAvailable(!available)}>Toggle browser-only</button>
    <ResearchVerification key={key} client={client} available={available} onOpenEntry={target=>opened.push(target)} hasEntry={sourceFile=>sourceFile!=="02 - Research/3.md"}/><pre id="result" style={{whiteSpace:"pre-wrap"}}/>
  </main>;
}
createRoot(document.getElementById("root")!).render(<Harness/>);
const wait=(ms=150)=>new Promise(r=>setTimeout(r,ms));
async function checks(){const results:string[]=[];const check=(condition:unknown,name:string)=>{if(!condition)throw Error(name);results.push(name)};
 const text=()=>document.querySelector(".research-verification")?.textContent??"";
 const click=(label:string)=>{const b=[...document.querySelectorAll<HTMLButtonElement>("button")].find(b=>b.textContent===label);if(!b)throw Error("Missing "+label);b.click()};
 const select=async(id:string)=>{const el=document.querySelector<HTMLSelectElement>('[aria-label="Saved research runs"]')!;el.value=id;el.dispatchEvent(new Event("change",{bubbles:true}));await wait()};
 try{await wait(450);check(starts===0,"Mount reads catalog/history without running agents");
  click("Agent catalog");await wait();check(text().includes("Executable roles")&&text().includes("Documented candidates")&&text().includes("Orchestrator"),"Catalog separates executors, candidates and orchestrator");
  check(text().includes("Unproven / potentially dormant"),"Coding Delegate remains unproven, not deprecated");
  click("Research Agent @2");await wait();check(text().includes("Current compiled definition")&&text().includes("source_write")&&document.activeElement?.tagName==="H4","Current agent exposes version and prohibited effects");
  click("Synthetic completed · Completed");await wait();check(document.querySelectorAll(".rv-executions>li").length===4,"Actual runner fixture shows four distinct executions");
  check(text().includes("EvidencePacket")&&text().includes("ClarificationRequest")&&text().includes("ClarificationResponse")&&text().includes("VerificationResult"),"All four typed message kinds inspectable");
  check(text().includes("Clarification requested: Additional agent research evidence?"),"Reason for clarification retained in original verifier output");
  check(document.querySelector('[aria-label="supported claims"]')?.textContent?.includes("Verification can detect"),"Deterministic supported brief displayed separately");
  click("Research Agent @1");await wait();check(text().includes("Saved definition snapshot")&&document.activeElement?.textContent?.includes("Research Agent @1 · Saved"),"Historical definition is not replaced by current catalog version");
  click("Back to workflow inspection");await wait();
  check(text().includes("fixture-model")&&text().includes("unreported (not zero)"),"Returned model and unknown usage are explicit");
  check(document.querySelectorAll('[id^="rv-source-"]').length===4,"All four saved source excerpts linked");
  const facts=document.querySelector('[aria-label="Research run inspection"] .inspector-facts')?.textContent??"";
  check(facts.includes("Completed")&&!/\d{4}-\d{2}-\d{2}T/.test(facts),"Run facts use human status and time, not raw ISO");
  const cite=[...document.querySelectorAll<HTMLButtonElement>('[aria-label="supported claims"] .inspector-cite')][0];
  check(cite?.textContent==="Agent research 0 · excerpt","Citation names its source title and excerpt");
  const target=document.getElementById(cite?"rv-source-530796df556448b86d9c7b278fb7621f0f0cbada9912c96afd9c3f7d7d4bc2f0":"") as HTMLDetailsElement|null;
  check(target&&!target.open,"Cited excerpt starts closed");
  cite.click();await wait();
  check(target!.open&&document.activeElement===target!.querySelector("summary"),"Citation opens its excerpt and moves focus there");
  const openEntry=[...target!.querySelectorAll<HTMLButtonElement>("button")].find(b=>b.textContent==="Open entry");openEntry?.click();
  check(opened.length===1&&opened[0].sourceFile==="02 - Research/0.md"&&opened[0].excerpt!.length>0&&opened[0].fingerprint==="c137982d51e893ea885a6f45f5ff1c12ad1e3aa95912d779369b2821b7e87374","Open entry passes the source file, saved excerpt and fingerprint");
  check(document.getElementById("rv-source-d8cbe161eb220739677b995d9481568f50ea8104c11849156d4ed2d222fbb206")?.textContent?.includes("Not in the library now"),"A source missing from the library says so");
  check(document.querySelector(".inspector-internals")!==null&&!(document.querySelector(".inspector-internals") as HTMLDetailsElement).open,"Receipts and JSON sit under a closed Internals");
  await select("delayed");await select("failed");await wait(650);check(document.querySelector('[aria-label="Research run inspection"]')?.textContent?.includes("failed · research-verification/v1")&&document.querySelector('[aria-label="Research run inspection"] .inspector-facts')?.textContent?.includes("Failed"),"Late history response cannot overwrite selected run");
  check(text().includes('"invalid structured result"')&&text().includes("Returned: unreported"),"Invalid output remains inspectable without crashing or inventing model provenance");
  check(text().includes("No brief generated"),"Agent failure never displays a successful brief");
  await select("insufficient");check(document.querySelector('[aria-label="supported claims"]')?.textContent?.includes("Supported · 0"),"Unsupported claims excluded from supported answer");
  await select("interrupted");check(text().includes("No execution end time recorded"),"Interruption preserves unknown end time");
  click("Toggle unavailable");await wait();check(text().includes("OpenAI credentials unavailable"),"Missing dependency blocks starting");
  await select("completed");check(text().includes("Agent executions · 4"),"Saved history remains readable when agents unavailable");
  click("Toggle browser-only");await wait();check(text().includes("no vault or run database connection"),"Browser-only preview reports unavailable runtime");
  click("Toggle browser-only");click("Toggle unavailable");await wait();
  const input=document.querySelector<HTMLInputElement>('.research-verification input')!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,"Agent research test");input.dispatchEvent(new Event("input",{bubbles:true}));await wait();
  click("Research and verify");await wait();check(starts===1&&text().includes("Cancel this run"),"Explicit start exposes cancellation for actual running state");
  click("Cancel this run");await wait(700);check(cancels===1&&text().includes("Cancelled")&&text().includes("No brief generated"),"Cancellation remains a stopped run without success brief");
  await select("completed");check(document.documentElement.scrollWidth<=innerWidth+2,"Inspection fits viewport without horizontal overflow");
  document.getElementById("result")!.textContent=results.map(r=>"PASS "+r).join("\n")+`\n${results.length} browser checks passed`;
 }catch(e){document.getElementById("result")!.textContent=results.map(r=>"PASS "+r).join("\n")+"\nFAIL "+String(e)}
}
if(location.search.includes("check"))void checks();
