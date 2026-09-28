import {WorkstreamDossier} from './WorkstreamDossier';
import {prioritizeSituation} from '../../services/situationPriority';
import {BriefingText} from './BriefingText';
import {RelationshipDossier} from './RelationshipDossier';
import {useMemo,useState,useRef,useEffect,type ReactNode} from 'react';
import type {SituationContext,ContextRef,Situation} from '../../services/situations';
import {SituationRelationshipWeb} from './SituationRelationshipWeb';
import {projectContextualActors} from '../../services/contextualActors';
import {NextStepStrip,jumpToNextStep} from './NextStepStrip';
import {contextDate} from '../../services/commsTime';

/** Map scope and inspector content can be owned by the workspace (session view state) or kept locally. */
export interface DocumentMapControl {
 workstream:string;actorId:string;tab:string|null;
 onWorkstream:(id:string)=>void;onActor:(id:string)=>void;onTab:(tab:string)=>void;
 /** Replaces the briefing or dossier in the inspector column (activity, source review, draft). */
 inspector?:ReactNode;
 /** Panel switcher shown at the top of the inspector column. */
 inspectorTabs?:ReactNode;
 /** Returns the inspector to the briefing, e.g. before jumping to the next step. */
 onBriefing?:()=>void;
}

export function DocumentSituationMap({context,title,situationId,briefing,emailStale,control}:{context:SituationContext;title:string;situationId:string;briefing?:Situation['briefing'];emailStale?:boolean;control?:DocumentMapControl}) {
 const [localWorkstream,setLocalWorkstream]=useState(''),[localActor,setLocalActor]=useState(''),[localTab,setLocalTab]=useState<string|null>(null);
 const workstream=control?control.workstream:localWorkstream,actorId=control?control.actorId:localActor;
 const setWorkstream=control?control.onWorkstream:setLocalWorkstream,setActorId=control?control.onActor:setLocalActor;
 const tab=control?control.tab:localTab,setTab=control?control.onTab:setLocalTab;
 const [page,setPage]=useState(0),[viewRevision,setViewRevision]=useState(0);
 const inspectorRef=useRef<HTMLElement>(null);
 useEffect(()=>{if(inspectorRef.current)inspectorRef.current.scrollTop=0},[actorId,workstream]);
 const priority=useMemo(()=>prioritizeSituation(context),[context]);
 const recommendation=priority.workstreams.find(w=>w.workstreamId===priority.recommendedWorkstreamId);
 const openQuestions=priority.questions.filter(q=>!workstream||q.workstreamId===workstream);
 const actors=useMemo(()=>projectContextualActors(situationId,context),[situationId,context]);
 const selected=actors.find(a=>a.id===actorId),stream=context.workstreams.find(w=>w.id===workstream);
 const streamPriority=stream?priority.workstreams.find(w=>w.workstreamId===stream.id):undefined;
 const filtered=actors.filter(a=>!workstream||a.workstream===workstream);
 const shown=stream?filtered.slice(page*8,page*8+8):filtered;
 const groups=stream?[...new Set(shown.map(a=>a.functionGroup))].map(name=>({id:name,title:name,actors:shown.filter(a=>a.functionGroup===name),total:filtered.filter(a=>a.functionGroup===name).length})):context.workstreams.map(w=>{const p=priority.workstreams.find(p=>p.workstreamId===w.id)!;return {id:w.id,title:w.title,priority:{level:p.level,reason:p.reason,recommended:priority.recommendedWorkstreamId===w.id},actors:actors.filter(a=>a.workstream===w.id).sort((a,b)=>Number(b.representatives.length>0)-Number(a.representatives.length>0)||Number(a.state!=='documented')-Number(b.state!=='documented')),total:actors.filter(a=>a.workstream===w.id).length}});
 const actorSources=new Set(selected?.refs.map(r=>r.sourceId));
 const facts=context.facts.filter(f=>selected?f.workstream===selected.workstream&&f.refs.some(r=>actorSources.has(r.sourceId)):!workstream||f.workstream===workstream);
 // A controlled owner clears the actor and dossier tab itself when the scope changes.
 function focus(id:string){setViewRevision(v=>v+1);setWorkstream(id);if(!control){setLocalActor('');setLocalTab(null)}setPage(0)}
 const refs=(items:ContextRef[])=><details className="document-evidence"><summary>Evidence · {items.length}</summary>{items.map((r,i)=>{const s=context.sources.find(s=>s.id===r.sourceId);return <div key={i}><strong>{s?.title??r.sourceId} · {r.locator}</strong><small>{s?.category}</small><code>{s?.path}</code></div>})}</details>;
 const jump=()=>{control?.onBriefing?.();jumpToNextStep(inspectorRef.current,'.briefing-next-step')};
 const strip=selected?null:stream&&streamPriority?<NextStepStrip action={streamPriority.action} scope={stream.title} text={streamPriority.questions.length?streamPriority.guidance:stream.nextStep} onJump={jump}/>:recommendation?<NextStepStrip action={recommendation.action} scope={recommendation.title} text={recommendation.guidance} onJump={jump}/>:<NextStepStrip action="NEXT" text={priority.message} onJump={jump}/>;
 const nodeLevel=(id:string)=>priority.workstreams.find(p=>p.workstreamId===id)?.level.replace(/-/g,' ')??'';
 return <div className="document-situation">
  <nav className="workstream-tabs" aria-label="Situation workstreams"><button className="workstream-parent-tab" aria-label="Whole situation" title={workstream?`Back to ${title}`:title} aria-pressed={!workstream} onClick={()=>focus('')}><span className="tab-label-stack"><span data-shown={!workstream||undefined}>Whole situation</span><span data-shown={!!workstream||undefined} aria-hidden="true">← Whole situation</span></span></button>{context.workstreams.map(w=><button key={w.id} aria-pressed={workstream===w.id} title={nodeLevel(w.id)?`${w.title} · ${nodeLevel(w.id)}`:w.title} onClick={()=>focus(w.id)}>{w.title}</button>)}</nav>
  {strip}
  <div className="contextual-focus situation-canvas"><article className="actor-map" aria-label={`${title} contextual relationship map`}><header><span className="map-anchor">Ω</span><div><h4>{stream?.title??'Workstreams & actors'}</h4><small>{stream?`${filtered.length} contextual actors`:'Select a workstream to reveal its full structure'}</small></div></header>
   <SituationRelationshipWeb key={`${workstream}:${page}:${viewRevision}`} title={stream?.title??title} groups={stream?groups:groups.slice(page*8,page*8+8)} relationships={context.relationships} selected={actorId} onSelect={setActorId} onGroup={stream?undefined:focus} personOnly={actors.filter(a=>!a.representatives.length&&context.entities.find(e=>e.id===a.entityIds[0])?.kind==='person').map(a=>a.id)}/>

   {!stream&&groups.length>8&&<footer className="actor-pagination"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous workstreams</button><small>{page*8+1}–{Math.min((page+1)*8,groups.length)} of {groups.length} workstreams</small><button disabled={(page+1)*8>=groups.length} onClick={()=>setPage(p=>p+1)}>More workstreams</button></footer>}
   {stream&&filtered.length>8&&<footer className="actor-pagination"><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Previous actors</button><small>{page*8+1}–{Math.min((page+1)*8,filtered.length)} of {filtered.length}</small><button disabled={(page+1)*8>=filtered.length} onClick={()=>setPage(p=>p+1)}>More actors</button></footer>}
  </article><article ref={inspectorRef} className="situation-briefing contextual-inspector" tabIndex={-1} aria-label={control?.inspector?'Situation inspector':selected?'Selected actor inspector':'Ongoing briefing'}>
   {control?.inspectorTabs}
   {control?.inspector?control.inspector:selected?<RelationshipDossier key={selected.id} context={context} actor={selected} onBack={()=>setActorId('')} situationId={situationId} tab={tab} onTab={setTab}/>:stream?<WorkstreamDossier key={stream.id} context={context} id={stream.id} actors={actors} situationId={situationId} onActor={setActorId} tab={tab} onTab={setTab}/>:<><small className="inspector-eyebrow">ONGOING BRIEFING</small>
   <section className="executive-briefing-section"><h5>CURRENT STATE</h5><BriefingText key={workstream+'state'} text={context.summary}/></section>

   <section className="executive-briefing-section"><h5>NEEDS CONFIRMATION</h5>{openQuestions.length?<><ul className="briefing-unknowns">{openQuestions.slice(0,3).map(q=><li key={q.id}>{q.label}</li>)}</ul>{openQuestions.length>3&&<details className="additional-questions"><summary>+ {openQuestions.length-3} additional open {openQuestions.length-3===1?'question':'questions'}</summary><ul>{openQuestions.slice(3).map(q=><li key={q.id}>{q.label}</li>)}</ul></details>}</>:<p>No open questions recorded for this scope. This does not establish that everything is resolved.</p>}</section>
   <section className="briefing-next-step" tabIndex={-1} data-recommended-workstream={!stream?recommendation?.workstreamId:undefined}><h5>USEFUL NEXT STEP</h5>{recommendation?<><div className="priority-action"><span className="briefing-action-label">{recommendation.action} · </span><button className="priority-workstream-link" aria-label={`Open recommended workstream: ${recommendation.title}`} onClick={()=>focus(recommendation.workstreamId)}>{recommendation.title}</button></div><p>{recommendation.guidance}</p><small>Reason: {recommendation.reason}</small></>:<p>{priority.message}</p>}</section>
   {emailStale&&!stream&&<small className="briefing-stale">Email analysis needs refresh; saved document context remains available.</small>}
   {refs(context.workstreams.flatMap(w=>w.refs).filter((r,i,a)=>a.findIndex(v=>v.sourceId===r.sourceId&&v.locator===r.locator)===i))}
   <details className="situation-extra"><summary>Source details</summary><p>Context dated {contextDate(context.asOf)}. Local document facts remain separate from generated email interpretation.</p><h5>Latest communication update</h5><p>{briefing?.whatChanged||'No new change is established by this saved context.'}</p><p>{context.coverage}</p><h5>Workstream priorities</h5><small>From the saved review policy and context dated {contextDate(priority.asOf)}. No deadlines or overdue payments are inferred.</small>{priority.workstreams.map(p=><div key={p.workstreamId}><strong>{p.title} · {p.level.replace(/-/g,' ')}</strong><p>{p.reason}</p><small>Saved status: {p.status.join(' · ')||'Not recorded'}.</small>{refs(p.refs)}</div>)}<details className="inspection-detail"><summary>Inspect</summary><p>Review policy version {priority.policyVersion} · context as of {priority.asOf}</p></details></details></>}
  {!control?.inspector&&!selected&&!stream&&<><details className="situation-extra"><summary>Facts &amp; open questions · {facts.length}</summary><div className="document-facts">{(['documented','operator context','needs confirmation'] as const).map(status=><section className="fact-category" key={status}><h5>{status==='documented'?'KNOWN · DOCUMENTED':status==='needs confirmation'?'OPEN QUESTIONS':'OPERATOR CONTEXT'}</h5>{facts.filter(f=>f.status===status).length?facts.filter(f=>f.status===status).map((f,i)=><article key={i}><h4>{f.label}</h4><p>{f.text}</p>{refs(f.refs)}</article>):<p>No entries recorded in this category.</p>}</section>)}</div></details>
  <details className="situation-extra"><summary>Local document library · {context.sources.length}</summary><p>{context.coverage}</p><p>Local foundation; not included in background model requests.</p>{context.sources.map(s=><div className="document-library-row" key={s.id}><strong>{s.title}</strong><small>{s.category}</small><code>{s.path}</code></div>)}</details>
  </>}
  </article></div>
 </div>;
}
