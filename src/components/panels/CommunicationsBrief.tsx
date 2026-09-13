import {useEffect,useRef,useState} from 'react';
import {intelligenceClient,type IntelligenceClient,type IntelligenceRun,type BriefItem,type RunEvent} from '../../services/communicationIntelligence';
import type {CommunicationRow} from '../../services/communications';
export function CommunicationsBrief({days,onOpen,api=intelligenceClient}:{days:number;onOpen:(row:CommunicationRow)=>void;api?:IntelligenceClient}){
 const [runs,setRuns]=useState<IntelligenceRun[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [inspect,setInspect]=useState(''),[events,setEvents]=useState<RunEvent[]>([]);
 const generation=useRef(0);
 useEffect(()=>{const version=++generation.current;setRuns([]);setInspect('');setEvents([]);setError('');setBusy(false);
 const refresh=()=>api.list(days).then(r=>{if(generation.current===version)setRuns(r)}).catch(()=>{if(generation.current===version)setError('Analysis history unavailable. Retry when the local connection is ready.')});
 void refresh();const timer=setInterval(refresh,10000);return()=>{generation.current++;clearInterval(timer)};
 },[api,days]);
 const run=runs[0],inspected=runs.find(r=>r.id===inspect);
 async function analyze(){const version=generation.current;setBusy(true);setError('');try{await api.analyze(days);const next=await api.list(days);if(version===generation.current)setRuns(next)}catch{if(version===generation.current)setError('Analysis failed. No new brief was published; inspect the run or retry.')}finally{if(version===generation.current)setBusy(false)}}
 async function details(id:string){const version=generation.current;setInspect(id);setEvents([]);try{const result=await api.events(id);if(version===generation.current)setEvents(result)}catch{if(version===generation.current)setError('Run evidence could not be loaded.')}}
 async function feedback(item:BriefItem,event:'opened'|'false_response'|'false_deadline'|'project_dismissed'){
 if(!run)return;try{await api.feedback(run.id,item.threadId,event);setNotice(event==='opened'?'':'Correction recorded for evaluation; source mail and project state are unchanged.')}catch{setError('Evaluation event could not be saved.')}
 }
 function open(item:BriefItem){void feedback(item,'opened');const ref=item.recommendation.evidenceRefs.slice(-1)[0]!;onOpen({id:ref.messageId,threadId:item.threadId,fingerprint:ref.fingerprint,timestamp:ref.timestamp,sender:item.sender,subject:item.subject,preview:'',labels:[],candidates:[]})}
 return <section className="comms-brief" aria-label="Olympus Communications Brief">
  <header><div><small>OLYMPUS COMMUNICATIONS BRIEF</small><h3>{busy?'Reading the signals…':run?.status==='completed'&&!run.stale?run.items.length?`${run.items.length} threads deserve a closer look`:'No attention signals found in the selected candidates':'Bring the important threads into focus'}</h3></div><button className="ghost-action" disabled={busy} onClick={()=>void analyze()}>{busy?'Analyzing…':run?'Refresh intelligence':'Analyze communications'}</button></header>
  <p className="comms-scope">Manual, local analysis · up to 12 candidate threads, 4 messages each · no model calls. Possible findings need source review.</p>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {run?.stale&&<p className="comms-notice">This analysis is out of date. Refresh intelligence before relying on it.</p>}
  {run&&run.status!=='completed'&&<p role="status">Run {run.status}. {run.error} Retry creates a new run and preserves prior evidence.</p>}
  {!run&&!busy&&<p>Analyze the cached candidates to see possible response needs, deadlines, and project relationships.</p>}
  {run?.status==='completed'&&!run.stale&&<div className="comms-brief-items">
   {!run.items.length&&<p>No action was identified in the bounded candidate subset. This is not a whole-mailbox assessment.</p>}
   {run.items.map(item=><article key={item.threadId} className={`comms-brief-item priority-${item.recommendation.priority}`}>
    <span className="comms-recommendation">{item.recommendation.disposition.replace(/_/g,' ').toUpperCase()}</span>
    <div><h4>{item.sender.split('<')[0].trim()}</h4><strong>{item.subject||'(No subject)'}</strong><p>{item.summary.whatMatters}</p><p className="comms-next-move">{item.recommendation.guidance}</p><small>Evidence: {item.recommendation.evidenceRefs.length} cached messages · latest {new Date(item.recommendation.evidenceRefs.slice(-1)[0]!.timestamp).toLocaleDateString()}</small>
     <details><summary>Why this?</summary><p>{item.summary.whatHappened}</p><p>{item.summary.whatChanged}</p><p>{item.project.reason}</p>{item.project.suggestedProjects.map(p=><p key={p.source}>Suggested: {p.name} · {p.source} · fingerprint {p.fingerprint}</p>)}<p>{item.project.method?'All declared names and aliases checked · deterministic match':`${item.project.iterations?.length??0} historical project lookups · ${item.project.iterations?.slice(-1)[0]?.stopReason??'unavailable'}`}</p>{item.recommendation.evidenceRefs.map(e=><small key={e.messageId}>Gmail · message {e.messageId} · fingerprint {e.fingerprint}<br/></small>)}<div className="comms-feedback"><button onClick={()=>void feedback(item,'false_response')}>Response signal incorrect</button><button onClick={()=>void feedback(item,'false_deadline')}>Deadline signal incorrect</button><button onClick={()=>void feedback(item,'project_dismissed')}>Dismiss project suggestion</button></div></details>
    </div><button className="comms-text-action" onClick={()=>open(item)}>Review thread →</button>
   </article>)}
  </div>}
  {run&&<footer><small>{run.graph} · {run.status} · {run.durationMs??'—'} ms · {new Date(run.startedAt).toLocaleString()}</small><button className="comms-text-action" onClick={()=>void details(run.id)}>Inspect analysis</button></footer>}
  {runs.length>1&&<details><summary>Previous analyses</summary>{runs.slice(1).map(r=><button key={r.id} className="comms-text-action" onClick={()=>void details(r.id)}>{new Date(r.startedAt).toLocaleString()} · {r.status}</button>)}</details>}
  {inspected&&<section className="comms-run-details" aria-label="Communication analysis details"><header><h4>Run details · {inspected.graph}</h4><button className="comms-text-action" onClick={()=>setInspect('')}>Close run details</button></header><p>Local deterministic skills · model: none · external usage: none. Recommendations never execute.</p><p>{inspected.items.length} brief items · {inspected.durationMs??'—'} ms</p>
   {inspected.definition.map(n=><details key={n.id}><summary>{n.id} · {events.filter(e=>e.node===n.id).slice(-1)[0]?.state??'No recorded event'}</summary><p>{n.kind} · depends on {n.dependsOn.join(', ')||'manual trigger'} · {n.maxIterations>1?`historical lookup bound: ${n.maxIterations}`:'fixed step'}</p>{events.filter(e=>e.node===n.id).map((e,i)=><div key={i}><small>{e.at} · {e.state}</small><pre>{JSON.stringify(e.result,null,2)}</pre></div>)}</details>)}
   <details><summary>Versioned skill contracts</summary><pre>{JSON.stringify(inspected.skills,null,2)}</pre></details>
  </section>}
 </section>;
}
