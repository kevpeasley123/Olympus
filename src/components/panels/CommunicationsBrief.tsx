import {useEffect,useRef,useState} from 'react';
import {intelligenceClient,type IntelligenceClient,type IntelligenceRun,type BriefItem} from '../../services/communicationIntelligence';
import {WorkflowInspection} from './WorkflowInspection';
import type {CommunicationRow} from '../../services/communications';
export function CommunicationsBrief({days,onOpen,api=intelligenceClient}:{days:number;onOpen:(row:CommunicationRow)=>void;api?:IntelligenceClient}){
 const [runs,setRuns]=useState<IntelligenceRun[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [inspect,setInspect]=useState<{id?:string}|null>(null);
 const generation=useRef(0);
 useEffect(()=>{const version=++generation.current;setRuns([]);setInspect(null);setError('');setBusy(false);
 const refresh=()=>api.list(days).then(r=>{if(generation.current===version)setRuns(r)}).catch(()=>{if(generation.current===version){setRuns([]);setInspect(null);setError('Analysis history unavailable. Retry when the local connection is ready.')}});
 void refresh();const timer=setInterval(refresh,10000);return()=>{generation.current++;clearInterval(timer)};
 },[api,days]);
 const run=runs[0];
 const needs=run?.items.filter(i=>['needs_you','yes'].includes(i.triage.attention)).length??0;
 const background=run?.items.filter(i=>i.triage.attention==='background')??[];
 const foreground=run?.items.filter(i=>i.triage.attention!=='background')??[];
 async function analyze(){const version=generation.current;setBusy(true);setError('');try{await api.analyze(days);const next=await api.list(days);if(version===generation.current)setRuns(next)}catch{if(version===generation.current)setError('Analysis failed. No new brief was published; inspect the run or retry.')}finally{if(version===generation.current)setBusy(false)}}
 function details(id:string){setInspect({id})}
 async function feedback(item:BriefItem,event:'opened'|'false_response'|'false_deadline'|'project_dismissed'|'useful'|'incorrect'|'missed_needs_me'){
 if(!run)return;try{await api.feedback(run.id,item.threadId,event);setNotice(event==='opened'?'':'Feedback saved for evaluation; it does not automatically retrain Olympus or change your mail.')}catch{setError('Evaluation event could not be saved.')}
 }
 function open(item:BriefItem){void feedback(item,'opened');const ref=item.recommendation.evidenceRefs.slice(-1)[0]!;onOpen({id:ref.messageId,threadId:item.threadId,fingerprint:ref.fingerprint,timestamp:ref.timestamp,sender:item.sender,subject:item.subject,preview:'',labels:[],candidates:[]})}
 function renderItem(item:BriefItem){return <article key={item.threadId} className={`comms-brief-item priority-${item.recommendation.priority}`}>
    <span className="comms-recommendation">{item.recommendation.disposition.replace(/_/g,' ').toUpperCase()}</span>
    <div><h4>{item.sender.split('<')[0].trim()}</h4><strong>{item.subject||'(No subject)'}</strong><p>{item.summary.whatHappened} {item.summary.whatChanged}</p><p>{item.summary.whatMatters}</p><p className="comms-next-move"><strong>Next move: </strong>{item.recommendation.guidance}</p><small>Evidence: {item.recommendation.evidenceRefs.length} cached messages · latest {new Date(item.recommendation.evidenceRefs.slice(-1)[0]!.timestamp).toLocaleDateString()}</small>
     <details><summary>Why this?</summary>{item.assessment?.evidenceState==='insufficient'&&<p className="comms-notice">Context incomplete: {item.assessment.missingContextReason} · {item.stopReason?.replace(/_/g,' ')}</p>}<p>{item.project.reason}</p>{item.project.suggestedProjects.map(p=><p key={p.source}>Suggested: {p.name} · {p.source} · fingerprint {p.fingerprint}</p>)}<p>{item.project.method?'All declared names and aliases checked · deterministic match':`${item.project.iterations?.length??0} historical project lookups · ${item.project.iterations?.slice(-1)[0]?.stopReason??'unavailable'}`}</p>{item.recommendation.evidenceRefs.map(e=><small key={e.messageId}>Gmail · message {e.messageId} · fingerprint {e.fingerprint}<br/></small>)}<div className="comms-feedback"><button onClick={()=>void feedback(item,'useful')}>Useful</button><button onClick={()=>void feedback(item,'incorrect')}>Interpretation incorrect</button><button onClick={()=>void feedback(item,'missed_needs_me')}>This needs me</button><button onClick={()=>void feedback(item,'false_response')}>Response signal incorrect</button><button onClick={()=>void feedback(item,'false_deadline')}>Deadline signal incorrect</button><button onClick={()=>void feedback(item,'project_dismissed')}>Dismiss project suggestion</button></div></details>
    </div><button className="comms-text-action" onClick={()=>open(item)}>Review thread →</button>
   </article>;}
 return <section className="comms-brief" aria-label="Olympus Communications Brief">
  <header><div><small>OLYMPUS COMMUNICATIONS BRIEF</small><h3>{busy?'Reading the signals…':run?.status==='completed'&&!run.stale?run.items.length?`${needs} ${needs===1?'thing needs':'things need'} you`:'No threads in the selected scope':'Bring the important threads into focus'}</h3></div><button className="ghost-action" disabled={busy||run?.status==='running'} onClick={()=>void analyze()}>{busy?'Analyzing…':run?'Refresh intelligence':'Analyze communications'}</button></header>
  <p className="comms-scope">Analyze sends selected cached excerpts and matching project metadata to OpenAI · Sol. Up to 6 threads, 4 messages each, 3 context passes. No mail is sent or changed.</p>
  <button className="comms-text-action" onClick={()=>setInspect({})}>About this workflow</button>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {run?.stale&&<p className="comms-notice">This analysis is out of date. Refresh intelligence before relying on it.</p>}
  {run&&run.status!=='completed'&&<p role="status">Run {run.status}. {run.error} Retry creates a new run and preserves prior evidence.</p>}
  {!run&&!busy&&<p>Read a concise interpretation of selected recent threads: what changed, what needs you, and what can wait.</p>}
  {run?.status==='completed'&&!run.stale&&<div className="comms-brief-items">
   {!run.items.length&&<p>No action was identified in the bounded candidate subset. This is not a whole-mailbox assessment.</p>}
   {foreground.map(renderItem)}
   {background.length>0&&<details className="comms-background"><summary>Background · {background.length} {background.length===1?'thread':'threads'}</summary>{background.map(renderItem)}</details>}
   <p className="comms-scope">{run.items.length} selected threads assessed. Background findings apply only to inspected evidence; other mail has not been cleared.</p>
  </div>}
  {run&&<footer><small>{run.graph} · {run.status} · {run.durationMs??'—'} ms · {new Date(run.startedAt).toLocaleString()}</small><button className="comms-text-action" onClick={()=>void details(run.id)}>Inspect analysis</button></footer>}
  {runs.length>1&&<details><summary>Previous analyses</summary>{runs.slice(1).map(r=><button key={r.id} className="comms-text-action" onClick={()=>void details(r.id)}>{new Date(r.startedAt).toLocaleString()} · {r.status}</button>)}</details>}
  {inspect&&<WorkflowInspection key={inspect.id??'compiled-workflow'} api={api} runId={inspect.id} onClose={()=>setInspect(null)}/>}
 </section>;
}
