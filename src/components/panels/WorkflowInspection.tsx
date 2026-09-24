import {useEffect,useRef,useState} from 'react';
import type {IntelligenceClient,InspectionPage,RunEvent,WorkflowDescriptor,WorkflowNode} from '../../services/communicationIntelligence';
import {diagram,eventData,eventOutput,eventSummary,nodeBindings,nodeEvidence,number,record,requestReceipts,savedSkill,strings,text} from '../../services/workflowInspection';
import './workflowInspection.css';

const names:Record<string,string>={snapshot:'Snapshot',select:'Selection',assess:'Assessment',project:'Project relevance',synthesize:'Synthesis'};
const showTime=(value?:string|null)=>value?new Date(value).toLocaleString():'Not recorded';
function JsonDetail({title,value}:{title:string;value:unknown}){return <details className="workflow-receipt"><summary>{title}</summary><pre>{JSON.stringify(value??null,null,2)}</pre></details>}
function StringList({value}:{value:unknown}){const entries=strings(value);return entries.length?<ul>{entries.map(s=><li key={s}>{s.replace(/_/g,' ')}</li>)}</ul>:<p>Not recorded in this contract.</p>}
function EventEvidence({event}:{event:RunEvent}){
 const d=eventData(event),output=eventOutput(event),assessment=record(d.assessment);
 const refs=[d.evidenceRefs,assessment.evidenceRefs,d.nextEvidenceRefs].flatMap(v=>Array.isArray(v)?v.flat():[]).map(record);
 const unique=[...new Map(refs.filter(r=>typeof r.messageId==='string').map(r=>[`${r.messageId}:${r.fingerprint}`,r])).values()];
 const projects=Array.isArray(output)?output.map(record):[];
 return <div className="workflow-evidence">
  {typeof assessment.operatorImpact==='string'&&<p>{assessment.operatorImpact}</p>}
  {typeof d.stopReason==='string'&&<p>Recorded stop reason: {d.stopReason.replace(/_/g,' ')}</p>}
  {projects.map((p,i)=><p key={i}>{text(p.state)} · {text(p.reason)} {Array.isArray(p.suggestedProjects)&&p.suggestedProjects.map(v=>text(record(v).name)).join(', ')}</p>)}
  {Array.isArray(d.sources)&&d.sources.map((s,i)=>{const p=record(s);return <p key={i}>Project source: {text(p.name)} · {text(p.source)} · fingerprint <code>{text(p.fingerprint)}</code></p>})}
  {unique.length>0&&<><h4>Recorded source references</h4><p>These identify cached evidence used or prepared at this event. They are not a retained copy of the original message.</p><ul>{unique.map(r=><li key={`${r.messageId}:${r.fingerprint}`}>Thread <code>{text(r.threadId)}</code> · message <code>{text(r.messageId)}</code><br/>Fingerprint <code>{text(r.fingerprint)}</code></li>)}</ul></>}
 </div>;
}

export function WorkflowInspection({api,runId,onClose}:{api:IntelligenceClient;runId?:string;onClose:()=>void}){
 const [page,setPage]=useState<InspectionPage|null>(null),[catalog,setCatalog]=useState<WorkflowDescriptor|null>(null),[events,setEvents]=useState<RunEvent[]>([]);
 const [view,setView]=useState<'run'|'graph'|'skill'>(runId?'run':'graph'),[returnView,setReturnView]=useState<'run'|'graph'>('graph'),[skill,setSkill]=useState(''),[node,setNode]=useState('snapshot');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[selectedEvent,setSelectedEvent]=useState<number|undefined>();
 const generation=useRef(0),title=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{const origin=document.activeElement as HTMLElement|null;return()=>{if(origin?.isConnected)origin.focus()}},[]);
 useEffect(()=>{title.current?.focus()},[view,skill]);
 useEffect(()=>{const version=++generation.current;setPage(null);setEvents([]);setCatalog(null);setError('');setBusy(true);
  const request=runId?api.inspect(runId).then(p=>{if(generation.current===version){setPage(p);setEvents(p.events)}}):api.workflow().then(w=>{if(generation.current===version)setCatalog(w)});
  void request.catch(()=>{if(generation.current===version)setError('Inspection unavailable. Check the connected account and try again; no analysis was started.')}).finally(()=>{if(generation.current===version)setBusy(false)});
  return()=>{generation.current++};
 },[api,runId]);
 async function refresh(more=false){if(!runId)return;const version=++generation.current;setBusy(true);setError('');
  // Hide account-owned data until authorization succeeds again.
  const previous=events;setEvents([]);const prior=page;setPage(null);
  try{const p=await api.inspect(runId,more?prior?.next:0,more?prior?.through:undefined);if(generation.current===version){setPage(more&&prior?{...p,run:prior.run}:p);setEvents(more?[...previous,...p.events]:p.events)}}
  catch{if(generation.current===version)setError('Run evidence unavailable. It may belong to a disconnected account. No work was retried.')}
  finally{if(generation.current===version)setBusy(false)}
 }
 const run=page?.run,workflow=run?run.workflow:catalog;
 const label=(id:string)=>(run?.graph??workflow?.id)==='communication-intelligence/v4'&&id==='select'?'Select & prepare':names[id]??id.replace(/_/g,' ');
 const nodes:WorkflowNode[]=run?.definition??workflow?.definition??[],skills=run?.skills??workflow?.skills??[];
 const valid=Array.isArray(nodes)&&nodes.every(n=>n&&typeof n.id==='string'&&typeof n.kind==='string'&&Array.isArray(n.dependsOn)&&n.dependsOn.every(d=>typeof d==='string'))&&new Set(nodes.map(n=>n.id)).size===nodes.length&&Array.isArray(skills);
 const selected=valid?nodes.find(n=>n.id===node):undefined;
 const complete=!!page&&!page.hasMore;
 const evidence=nodeEvidence(node,events,complete,run?.status??''),receipts=requestReceipts(events);
 function openSkill(key:string){setReturnView(view==='run'?'run':'graph');setSkill(key);setView('skill')}
 const contract=savedSkill(valid?skills:[],skill);
 const bindings=selected?nodeBindings(selected,workflow?.nodeSkills):[];
 const graph=valid?diagram(nodes):{points:[],height:100,width:320};
 const links=[...new Set(valid?nodes.flatMap(n=>nodeBindings(n,workflow?.nodeSkills)):[])];
 const chosenEvent=events.find(e=>e.sequence===selectedEvent);
 return <section className="comms-run-details workflow-inspection" aria-label="Communication analysis details">
  <header className="workflow-heading"><div><small>OLYMPUS · WORKFLOW INSPECTION</small><h3 ref={title} tabIndex={-1}>{view==='skill'?skill:view==='graph'?'Communication Intelligence':`Run · ${run?.graph??'loading'}`}</h3></div><button className="comms-text-action" onClick={onClose}>{runId?'Close run details':'Close workflow details'}</button></header>
  <nav aria-label="Inspection navigation">{view==='skill'?<button onClick={()=>setView(returnView)}>← Back to {returnView==='run'?'this run':'workflow'}</button>:view==='graph'&&runId?<button onClick={()=>setView('run')}>← Back to this run</button>:view==='run'?<button onClick={()=>setView('graph')}>Workflow detail →</button>:null}</nav>
  {busy&&<p role="status">Reading saved evidence…</p>}{error&&<p role="alert">{error}</p>}
  {!valid&&<p role="alert">The saved definition cannot be displayed. It has not been replaced with a current definition.</p>}
  {valid&&(run||catalog)&&<>
   <p className="workflow-scope">{run?'Saved definitions for this run':'Compiled definition in this build'} · <code>{run?.graph??workflow?.id}</code></p>
   {view==='skill'?<>
    {!contract?<p role="alert">This run references {skill}, but its exact saved contract is missing or ambiguous. No current contract was substituted.</p>:<div className="workflow-skill">
     <p>{text(contract.purpose)}</p><dl><dt>Version</dt><dd>{String(contract.version)}</dd><dt>Availability</dt><dd>{run?'Recorded with this run; current availability is not asserted':'Compiled for this workflow; live evaluation is separate'}</dd><dt>Implementation</dt><dd>{text(contract.implementation)}</dd><dt>Used by</dt><dd><button onClick={()=>setView('graph')}>{run?.graph??workflow?.id}</button></dd></dl>
     <div className="workflow-contract-columns"><section><h4>Allowed capabilities</h4><StringList value={contract.allowedCapabilities}/></section><section><h4>May not</h4><StringList value={contract.prohibitedEffects}/></section></div>
     <h4>Evidence and success</h4><p>{text(contract.evidenceRequirements)}</p><p>{text(contract.successCriteria)}</p>
     <p>Recorded loop budget: {number(contract.loopBudget)??'unavailable'}. {contract.id==='communication-assess'&&contract.version===2?'The fixed runner owns the batch/pass budget and cached expansion. This is not an independent retrieval agent.':''}</p>
     <p>Evaluation: feedback belongs to run/thread findings; no skill quality score or lifetime invocation count is asserted.</p>
     <JsonDetail title="Input contract" value={contract.inputSchema}/><JsonDetail title="Output contract" value={contract.outputSchema}/>
    </div>}
   </>:<>
    {view==='graph'?<>
     <p>{workflow?.purpose??'Historical workflow structure and contracts as saved. Additional definition metadata was not recorded.'}</p>
     {workflow&&<><p><strong>Trigger:</strong> {workflow.trigger}</p><p><strong>Completion:</strong> {workflow.completion}</p><p><strong>Recovery:</strong> {workflow.recovery}</p><p>{workflow.execution}</p><p>{workflow.loop}</p><details><summary>Workflow authority</summary><h4>May</h4><StringList value={workflow.allowedCapabilities}/><h4>May not</h4><StringList value={workflow.prohibitedEffects}/></details></>}
     <h4>Capabilities used</h4><div className="workflow-links">{links.map(k=><button key={k} onClick={()=>openSkill(k)}>{k}</button>)}</div>
     {links.some(k=>!savedSkill(skills,k))&&<p className="workflow-caution">At least one referenced skill has no unique saved contract. Open its link to inspect the coverage gap.</p>}
    </>:<>
     <dl className="workflow-run-facts"><dt>Run identifier</dt><dd><code>{run?.id}</code></dd><dt>Recorded outcome</dt><dd>{run?.status} {run?.error&&`· ${run.error}`}</dd><dt>Selected scope</dt><dd>{run?.days} days of cached mail</dd><dt>Started</dt><dd>{showTime(run?.startedAt)}</dd><dt>{run?.status==='interrupted'?'Interruption recorded':'Finished'}</dt><dd>{showTime(run?.finishedAt)}</dd><dt>Recorded run duration</dt><dd>{run?.durationMs==null?'Not recorded':`${run.durationMs} ms`}</dd></dl>
     <p>Analysis completion does not establish task completion or operator approval. Source references identify collected evidence; current content availability has not been rechecked.</p>
     <div className="workflow-actions"><button disabled={busy} onClick={()=>void refresh()}>Refresh saved evidence</button><span>{events.length} events loaded{page?.hasMore?' · partial trace':' · through recorded sequence '+page?.through}</span>{page?.hasMore&&<button disabled={busy} onClick={()=>void refresh(true)}>Load more events</button>}</div>
     {run?.traceVersion!==1&&<p className="workflow-caution">Legacy trace: missing timing, attempts and contracts remain unknown. Declared branches do not establish parallel execution; v3 Project spans context preparation and assessment.</p>}
     {run?.status==='running'&&<p>Snapshot as of this read. Refresh to see later events; absence of a terminal event is not success.</p>}
     {run?.status==='interrupted'&&<p>Restart recovery marked this run interrupted. The interruption timestamp records detection, not the exact execution end. Missing terminal boundaries remain unknown.</p>}
    </>}
    <div className="workflow-layout"><section><h4>{view==='run'?'Saved structure · recorded states':'Workflow structure'}</h4>
     <div className="workflow-map" tabIndex={0} aria-label="Scrollable workflow structure"><svg width={graph.width} height={graph.height} viewBox={`0 0 ${graph.width} ${graph.height}`} role="group" aria-label="Workflow dependency graph">
      {graph.points.flatMap(p=>p.node.dependsOn.map(id=>{const from=graph.points.find(q=>q.node.id===id);return from?<path key={`${id}:${p.node.id}`} className="workflow-edge" d={`M${from.x},${from.y+30} V${p.y-48} H${p.x} V${p.y-30}`}/>:null}))}
      {graph.points.map(p=><foreignObject key={p.node.id} x={p.x-130} y={p.y-30} width={260} height={68}><button className="workflow-node" aria-pressed={node===p.node.id} onClick={()=>{setNode(p.node.id);setSelectedEvent(undefined)}}><strong>{label(p.node.id)}</strong><span>{view==='run'?nodeEvidence(p.node.id,events,complete,run?.status??'').state:p.node.kind}</span></button></foreignObject>)}
     </svg></div><p className="workflow-caption">Lines show saved dependencies. Select a node to inspect its contract and evidence.</p>
    </section><section className="workflow-node-inspector" aria-label="Selected workflow node">
     <h4>{selected?label(selected.id):'Select a node'}</h4>{selected&&<><p><code>{selected.kind}</code></p><p>Depends on: {selected.dependsOn.map(label).join(', ')||'workflow start'}.</p><div className="workflow-links">{bindings.map(k=><button key={k} onClick={()=>openSkill(k)}>Skill: {k}</button>)}</div>
      {view==='run'&&<><dl><dt>Last lifecycle record</dt><dd>{evidence.state}</dd><dt>Attempt</dt><dd>{evidence.attempt??'Not recorded'}</dd><dt>Node elapsed time</dt><dd>{evidence.durationMs===undefined?'Unavailable: requires complete, paired trace boundaries':`${evidence.durationMs} ms (elapsed, not CPU time)`}</dd><dt>Started / ended</dt><dd>{showTime(evidence.start)} / {showTime(evidence.end)}</dd></dl>
       {evidence.events.filter(e=>e.state==='iteration').map((e,i)=><article key={e.sequence??i} className="workflow-pass"><strong>{eventSummary(e)}</strong><EventEvidence event={e}/><JsonDetail title="Thread expansion evidence" value={eventOutput(e)}/></article>)}
       {evidence.events.filter(e=>!['iteration','pass_started','model_result'].includes(e.state)).map((e,i)=><div key={e.sequence??i}><p>{eventSummary(e)}</p><EventEvidence event={e}/><JsonDetail title={`${e.state} · ${showTime(e.at)}`} value={eventOutput(e)}/></div>)}
      </>}
     </>}
    </section></div>
    {view==='run'&&<>
     <h4>Recorded execution</h4><p>Chronological event order. Passes are batch model requests; thread expansion is not a transport retry.</p>
     <ol className="workflow-timeline">{events.map((e,i)=><li key={e.sequence??i} data-selected={e.sequence===selectedEvent||undefined}><button onClick={()=>{if(nodes.some(n=>n.id===e.node))setNode(e.node);setSelectedEvent(e.sequence)}}><small>#{e.sequence??'?'} · {showTime(e.at)}</small><strong>{label(e.node)} · {e.state.replace(/_/g,' ')}</strong><span>{eventSummary(e)}</span></button></li>)}</ol>
     {chosenEvent&&<article key={chosenEvent.sequence}><EventEvidence event={chosenEvent}/><JsonDetail title={`Selected event #${chosenEvent.sequence} · recorded evidence`} value={eventOutput(chosenEvent)}/></article>}
     <h4>Model request receipts</h4>{receipts.length?receipts.map(r=><article className="workflow-request" key={String(r.id)}><strong>{text(r.id)}</strong><p>Requested: {text(r.requestedModel)} · actual: {text(r.actualModel,'unconfirmed')} · requested effort: {text(r.reasoningEffort)}</p><p>Status: {text(r.status)} · latency: {number(r.latencyMs)===undefined?'unavailable':`${r.latencyMs} ms`}{r.errorCode?` · ${r.errorCode}`:''}</p><JsonDetail title="Reported usage and request metadata" value={r}/></article>):<p>No linked request receipt in the loaded events. This does not prove that no model was called.</p>}
     {!!run?.usage?.length&&<JsonDetail title="Saved run-level request receipts" value={run.usage}/>}
     <h4>Operator feedback</h4><p>{events.filter(e=>e.node==='feedback').length} feedback events in loaded history. Repeated events are not unique ratings; opening a source is not a usefulness judgment.</p>
     {events.filter(e=>e.node==='feedback').map((e,i)=><JsonDetail key={e.sequence??i} title={showTime(e.at)} value={eventOutput(e)}/>)}
     <JsonDetail title="Saved definition and skill contracts" value={{workflow:run?.workflow,definition:run?.definition,skills:run?.skills,fingerprint:run?.definitionFingerprint,buildVersion:run?.buildVersion}}/>
    </>}
   </>}
  </>}
 </section>;
}
