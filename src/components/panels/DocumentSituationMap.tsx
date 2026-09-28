import {WorkstreamDossier} from './WorkstreamDossier';
import {prioritizeSituation} from '../../services/situationPriority';
import {BriefingText} from './BriefingText';
import {RelationshipDossier} from './RelationshipDossier';
import {useMemo,useState,useRef,useEffect} from 'react';
import type {SituationContext,ContextRef,Situation} from '../../services/situations';
import {SituationRelationshipWeb} from './SituationRelationshipWeb';
import {projectContextualActors} from '../../services/contextualActors';

export function DocumentSituationMap({context,title,situationId,briefing,emailStale}:{context:SituationContext;title:string;situationId:string;briefing?:Situation['briefing'];emailStale?:boolean}) {
 const [workstream,setWorkstream]=useState(''),[actorId,setActorId]=useState(''),[page,setPage]=useState(0),[viewRevision,setViewRevision]=useState(0);
 const inspectorRef=useRef<HTMLElement>(null);
 useEffect(()=>{if(inspectorRef.current)inspectorRef.current.scrollTop=0},[actorId,workstream]);
 const priority=useMemo(()=>prioritizeSituation(context),[context]);
 const recommendation=priority.workstreams.find(w=>w.workstreamId===priority.recommendedWorkstreamId);
 const openQuestions=priority.questions.filter(q=>!workstream||q.workstreamId===workstream);
 const actors=useMemo(()=>projectContextualActors(situationId,context),[situationId,context]);
 const selected=actors.find(a=>a.id===actorId),stream=context.workstreams.find(w=>w.id===workstream);
 const filtered=actors.filter(a=>!workstream||a.workstream===workstream);
 const shown=stream?filtered.slice(page*8,page*8+8):filtered;
 const groups=stream?[...new Set(shown.map(a=>a.functionGroup))].map(name=>({id:name,title:name,actors:shown.filter(a=>a.functionGroup===name),total:filtered.filter(a=>a.functionGroup===name).length})):context.workstreams.map(w=>({id:w.id,title:w.title,priority:{level:priority.workstreams.find(p=>p.workstreamId===w.id)!.level,reason:priority.workstreams.find(p=>p.workstreamId===w.id)!.reason,recommended:priority.recommendedWorkstreamId===w.id},actors:actors.filter(a=>a.workstream===w.id).sort((a,b)=>Number(b.representatives.length>0)-Number(a.representatives.length>0)||Number(a.state!=='documented')-Number(b.state!=='documented')),total:actors.filter(a=>a.workstream===w.id).length}));
 const actorSources=new Set(selected?.refs.map(r=>r.sourceId));
 const facts=context.facts.filter(f=>selected?f.workstream===selected.workstream&&f.refs.some(r=>actorSources.has(r.sourceId)):!workstream||f.workstream===workstream);
 function focus(id:string){setViewRevision(v=>v+1);setWorkstream(id);setActorId('');setPage(0)}
 const refs=(items:ContextRef[])=><details className="document-evidence"><summary>Evidence · {items.length}</summary>{items.map((r,i)=>{const s=context.sources.find(s=>s.id===r.sourceId);return <div key={i}><strong>{s?.title??r.sourceId} · {r.locator}</strong><small>{s?.category}</small><code>{s?.path}</code></div>})}</details>;
 return <div className="document-situation">
  <nav className="workstream-tabs" aria-label="Situation workstreams"><button aria-label="Whole situation" title={workstream?`Back to ${title}`:title} aria-pressed={!workstream} onClick={()=>focus('')}>{workstream?`← ${title}`:'Whole situation'}</button>{context.workstreams.map(w=><button key={w.id} aria-pressed={workstream===w.id} onClick={()=>focus(w.id)}>{w.title}</button>)}</nav>
  <div className="contextual-focus"><article className="actor-map" aria-label={`${title} contextual relationship map`}><header><span className="map-anchor">Ω</span><div><h4>{stream?.title??'Workstreams & actors'}</h4><small>{stream?`${filtered.length} contextual actors`:'Select a workstream to reveal its full structure'}</small></div></header>
   <SituationRelationshipWeb key={`${workstream}:${page}:${viewRevision}`} title={stream?.title??title} groups={stream?groups:groups.slice(page*8,page*8+8)} relationships={context.relationships} selected={actorId} onSelect={setActorId} onGroup={stream?undefined:focus} personOnly={actors.filter(a=>!a.representatives.length&&context.entities.find(e=>e.id===a.entityIds[0])?.kind==='person').map(a=>a.id)}/>

   {!stream&&groups.length>8&&<footer className="actor-pagination"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous workstreams</button><small>{page*8+1}–{Math.min((page+1)*8,groups.length)} of {groups.length} workstreams</small><button disabled={(page+1)*8>=groups.length} onClick={()=>setPage(p=>p+1)}>More workstreams</button></footer>}
   {stream&&filtered.length>8&&<footer className="actor-pagination"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous actors</button><small>{page*8+1}–{Math.min((page+1)*8,filtered.length)} of {filtered.length}</small><button disabled={(page+1)*8>=filtered.length} onClick={()=>setPage(p=>p+1)}>More actors</button></footer>}
  </article><article ref={inspectorRef} className="situation-briefing contextual-inspector" aria-label={selected?'Selected actor inspector':'Ongoing briefing'}>
   {selected?<RelationshipDossier key={selected.id} context={context} actor={selected} onBack={()=>setActorId('')} situationId={situationId}/>:stream?<WorkstreamDossier key={stream.id} context={context} id={stream.id} actors={actors} situationId={situationId} onActor={setActorId}/>:<><small>ONGOING BRIEFING</small>
   <section className="executive-briefing-section"><h5>CURRENT STATE</h5><BriefingText key={workstream+'state'} text={context.summary}/></section>

   <section className="executive-briefing-section"><h5>NEEDS CONFIRMATION</h5>{openQuestions.length?<><ul className="briefing-unknowns">{openQuestions.slice(0,3).map(q=><li key={q.id}>{q.label}</li>)}</ul>{openQuestions.length>3&&<details className="additional-questions"><summary>+ {openQuestions.length-3} additional open questions</summary><ul>{openQuestions.slice(3).map(q=><li key={q.id}>{q.label}</li>)}</ul></details>}</>:<p>No open questions recorded for this scope. This does not establish that everything is resolved.</p>}</section>
   <section className="briefing-next-step" data-recommended-workstream={!stream?recommendation?.workstreamId:undefined}><h5>USEFUL NEXT STEP</h5>{recommendation?<><div className="priority-action"><span className="briefing-action-label">{recommendation.action} · </span><button className="priority-workstream-link" aria-label={`Open recommended workstream: ${recommendation.title}`} onClick={()=>focus(recommendation.workstreamId)}>{recommendation.title}</button></div><p>{recommendation.guidance}</p><small>Reason: {recommendation.reason}</small></>:<p>{priority.message}</p>}</section>
   {emailStale&&!stream&&<small className="briefing-stale">Email analysis needs refresh; saved document context remains available.</small>}
   {refs(context.workstreams.flatMap(w=>w.refs).filter((r,i,a)=>a.findIndex(v=>v.sourceId===r.sourceId&&v.locator===r.locator)===i))}
   <details className="situation-extra"><summary>Source details</summary><p>Context dated {context.asOf}. Local document facts remain separate from generated email interpretation.</p><h5>Latest communication update</h5><p>{briefing?.whatChanged||'No new change is established by this saved context.'}</p><p>{context.coverage}</p><h5>Workstream priorities</h5><small>Review policy {priority.policyVersion} · saved context {priority.asOf}. No deadlines or overdue payments are inferred.</small>{priority.workstreams.map(p=><div key={p.workstreamId}><strong>{p.title} · {p.level.replace(/-/g,' ')}</strong><p>{p.reason}</p><small>Saved status: {p.status.join(' · ')||'Not recorded'}</small>{refs(p.refs)}</div>)}</details></>}
  {!selected&&!stream&&<><details className="situation-extra"><summary>Facts & open questions · {facts.length}</summary><div className="document-facts">{(['documented','operator context','needs confirmation'] as const).map(status=><section className="fact-category" key={status}><h5>{status==='documented'?'KNOWN · DOCUMENTED':status==='needs confirmation'?'OPEN QUESTIONS':'OPERATOR CONTEXT'}</h5>{facts.filter(f=>f.status===status).length?facts.filter(f=>f.status===status).map((f,i)=><article key={i}><h4>{f.label}</h4><p>{f.text}</p>{refs(f.refs)}</article>):<p>No entries recorded in this category.</p>}</section>)}</div></details>
  <details className="situation-extra"><summary>Local document library · {context.sources.length}</summary><p>{context.coverage}</p><p>Local foundation; not included in background model requests.</p>{context.sources.map(s=><div className="document-library-row" key={s.id}><strong>{s.title}</strong><small>{s.category}</small><code>{s.path}</code></div>)}</details>
  </>}
  </article></div>
 </div>;
}
