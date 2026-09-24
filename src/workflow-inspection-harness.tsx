import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {WorkflowInspection} from './components/panels/WorkflowInspection';
import {inspectionFixture,workflowFixture} from './services/workflowInspectionFixture';
import type {IntelligenceClient} from './services/communicationIntelligence';
import './styles.css';
let writes=0,catalogReads=0,denied=false;
const api:IntelligenceClient={
 workflow:async()=>{catalogReads++;return structuredClone(workflowFixture)},
 inspect:async(id,after=0,through)=>{if(denied)throw Error('account changed');if(id==='delayed')await new Promise(r=>setTimeout(r,500));const {run,events}=inspectionFixture(id);const end=through??events.length;const page=events.filter(e=>e.sequence!>after&&e.sequence!<=end).slice(0,100);return {run,events:page,through:end,next:page[page.length-1]?.sequence??after,hasMore:page[page.length-1]?.sequence!==end}},
 list:async()=>[],events:async()=>[],analyze:async()=>{writes++;throw Error('Inspection cannot analyze')},feedback:async()=>{writes++},
};
function Harness(){
 const [scenario,setScenario]=useState(new URLSearchParams(location.search).get('scenario')??'completed'),[open,setOpen]=useState(true),[narrow,setNarrow]=useState(false);
 return <main className="inspection-fixture" style={{maxWidth:narrow?360:1080,margin:'20px auto',padding:16,fontFamily:'Inter, sans-serif'}}>
  <style>{`.inspection-fixture>button{background:#141d29;color:#d5dce6;border:1px solid #39414c;border-radius:6px;padding:8px;margin:8px 6px 0 0}`}</style>
  <h1 style={{fontSize:20}}>Workflow inspection · synthetic study</h1><p>No real mail or model calls.</p>
  <label>Fixture <select aria-label="Inspection fixture" value={scenario} onChange={e=>{denied=false;setScenario(e.target.value);setOpen(true)}}>{['completed','empty','failed','interrupted','running','legacy','missing-contract','paged','compiled','delayed'].map(s=><option key={s}>{s}</option>)}</select></label>
  <button onClick={()=>setNarrow(!narrow)}>Toggle narrow</button><button onClick={()=>{denied=false;setOpen(true)}}>Open inspection</button><button onClick={()=>{denied=true}}>Simulate account denial</button>
  {open&&<WorkflowInspection key={scenario} api={api} runId={scenario==='compiled'?undefined:scenario} onClose={()=>setOpen(false)}/>}
  <pre id="result" style={{whiteSpace:'pre-wrap'}}/>
 </main>;
}
createRoot(document.getElementById('root')!).render(<Harness/>);
const wait=(ms=120)=>new Promise(r=>setTimeout(r,ms));
async function checks(){const results:string[]=[];const check=(v:unknown,s:string)=>{if(!v)throw Error(s);results.push(s)};
 const click=(label:string)=>{const b=[...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===label);if(!b)throw Error('Missing '+label);b.click()};
 const body=()=>document.querySelector('.workflow-inspection')?.textContent??'';
 const fixture=async(s:string)=>{const el=document.querySelector<HTMLSelectElement>('[aria-label="Inspection fixture"]')!;el.value=s;el.dispatchEvent(new Event('change',{bubbles:true}));await wait()};
 try{await wait(400);
  check(document.querySelectorAll('.workflow-node').length===5,'Five nodes linked from saved run');
  check([...document.querySelectorAll('.workflow-inspection *')].every(el=>getComputedStyle(el).animationName==='none'),'Inspection has no continuous animation, including reduced-motion use');
  click('Workflow detail →');await wait();check(body().includes('communication-assess@2')&&body().includes('project-relevance@2'),'Graph exposes both real skill bindings');
  click('communication-assess@2');await wait();check(body().includes('runner owns')&&document.activeElement?.tagName==='H3','Skill shows authority and receives focus');
  click('← Back to workflow');await wait();click('← Back to this run');await wait();
  const assess=[...document.querySelectorAll<HTMLButtonElement>('.workflow-node')].find(b=>b.textContent?.startsWith('Assessment'))!;assess.click();await wait();
  check(body().includes('70 ms (elapsed, not CPU time)'),'Assessment timing comes from paired trace');
  check(document.querySelectorAll('.workflow-request').length===2,'Start/result records deduplicate into two receipts');
  check(body().includes('thread t1')&&body().includes('Pass 2'),'Thread loops and passes are inspectable');
  document.querySelector<HTMLButtonElement>('.workflow-timeline li:nth-child(7) button')!.click();await wait();
  check(body().includes('Recorded source references'),'Timeline selection exposes source evidence');
  await fixture('delayed');await fixture('legacy');await wait(500);check(body().includes('Run · communication-intelligence/v2')&&!body().includes('delayed'),'Late reply cannot replace a different selected run');check(catalogReads===0,'History never fetches compiled catalog');check(body().includes('Legacy trace'),'Legacy uncertainty visible');
  click('Workflow detail →');await wait();click('communication-assess@1');await wait();check(body().includes('Historical deterministic assessment'),'Exact historical contract retained');
  await fixture('missing-contract');click('Workflow detail →');await wait();click('communication-assess@1');await wait();check(body().includes('No current contract was substituted'),'Missing contract remains unavailable');
  await fixture('failed');check(body().includes('assessment_contract_rejected')&&[...document.querySelectorAll('.workflow-node')].some(n=>n.textContent?.includes('stopped')),'Failed run preserves downstream stop');
  await fixture('interrupted');check(body().includes('running at interrupted')&&body().includes('No recorded event'),'Interruption never becomes completion');
  await fixture('running');check(body().includes('Snapshot as of this read'),'Running view explains snapshot coverage');
  await fixture('empty');check(document.querySelectorAll('.workflow-request').length===0,'Empty selection has no request receipts');
  await fixture('paged');check(body().includes('100 events loaded · partial trace'),'Pagination labels incomplete trace');click('Load more events');await wait();check(body().includes('127 events loaded')&&body().includes('110 feedback events'),'Pagination retains all evidence with denominator');
  click('Simulate account denial');click('Refresh saved evidence');await wait();check(!body().includes('request-1')&&!document.querySelector('.workflow-map')&&body().includes('unavailable'),'Denied read clears account-owned evidence');
  await fixture('compiled');check(body().includes('Compiled definition in this build'),'Current workflow distinct from run snapshot');
  check(writes===0,'All inspection paths performed zero analysis or feedback writes');
  await fixture('completed');click('Close run details');await wait();const opener=[...document.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='Open inspection')!;opener.focus();opener.click();await wait();click('Close run details');await wait();check(document.activeElement===opener,'Close returns focus to entry');opener.click();await wait();
  document.getElementById('result')!.textContent=results.map(s=>'PASS '+s).join('\n')+`\n${results.length} browser checks passed`;
 }catch(e){document.getElementById('result')!.textContent=results.map(s=>'PASS '+s).join('\n')+'\nFAIL '+String(e)}
}
if(location.search.includes('check'))void checks();

