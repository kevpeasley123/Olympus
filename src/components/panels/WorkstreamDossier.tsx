import type {SituationContext} from '../../services/situations';
import type {ContextualActor} from '../../services/contextualActors';
import {prioritizeSituation} from '../../services/situationPriority';
import {BriefingText} from './BriefingText';
import {DossierTabs} from './DossierTabs';
export function WorkstreamDossier({context,id,actors,onActor,situationId}:{context:SituationContext;id:string;actors:ContextualActor[];onActor:(id:string)=>void;situationId:string}){
 const stream=context.workstreams.find(w=>w.id===id)!,priority=prioritizeSituation(context).workstreams.find(w=>w.workstreamId===id)!;
 const scoped=actors.filter(a=>a.workstream===id),facts=context.facts.filter(f=>f.workstream===id);
 return <div className="workstream-dossier"><header className="dossier-identity"><small>WORKSTREAM</small><h4>{stream.title}</h4><small>{context.phase} · {scoped.length} contextual {scoped.length===1?'actor':'actors'}</small></header><DossierTabs key={id} context={context} workstream={id} situationId={situationId} provenance={<><p>Saved context · {context.asOf}. {context.coverage}</p><p>{priority.reason}</p><small>Saved status: {priority.status.join(' · ')||'Not recorded'}</small></>} documentContext={<>{facts.map((f,i)=><div key={i}><h5>{f.label}</h5><small>{f.status}</small><p>{f.text}</p></div>)}</>}>
 <section><h5>Current state</h5><BriefingText text={stream.summary}/></section>
 <section><h5>{scoped.length===1?'Key relationship':'People & companies'}</h5>{scoped.slice(0,3).map(actor=><button className="dossier-actor-link" key={actor.id} onClick={()=>onActor(actor.id)}><strong>{actor.primary}</strong><small>{[...actor.representatives,actor.role].join(' · ')}</small></button>)}{scoped.length>3&&<small>All {scoped.length} actors are available on the map.</small>}</section>
 {priority.questions.length>0&&<section><h5>Needs confirmation</h5><ul>{priority.questions.slice(0,3).map(q=><li key={q.id}>{q.label}</li>)}</ul>{priority.questions.length>3&&<small>More open records are in Documents.</small>}</section>}{!priority.questions.length&&<p>No open questions recorded for this scope. This does not establish that everything is resolved.</p>}
 <section className="briefing-next-step"><h5>Useful next step</h5><span className="briefing-action-label">{priority.action} · {stream.title}</span><BriefingText text={priority.questions.length?priority.guidance:stream.nextStep}/>{!!priority.questions.length&&<small>Reason: {priority.reason}</small>}</section>
 </DossierTabs></div>;
}
