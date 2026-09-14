import type {SituationContext} from './situations';
import type {ContextualActor} from './contextualActors';
/** Scope by saved references, never infer file ownership or dates from filenames. */
export function dossierDetails(context:SituationContext,workstream:string,actor?:ContextualActor){
 const refs=actor?actor.refs:[...context.workstreams.filter(w=>w.id===workstream).flatMap(w=>w.refs),...context.entities.filter(e=>e.workstream===workstream).flatMap(e=>e.refs),...context.facts.filter(f=>f.workstream===workstream).flatMap(f=>f.refs)];
 const ids=new Set(refs.map(r=>r.sourceId));
 const documents=context.sources.filter(s=>ids.has(s.id)).map(s=>({...s,type:s.path.split('.').pop()?.toUpperCase().match(/^[A-Z0-9]{1,8}$/)?.[0]??'File',origin:s.document?.origin??(/operator.*summary|generated|ChatGPT/i.test(s.category)?'generated':'local')}));
 const memberIds=new Set(actor?.entityIds??context.entities.filter(e=>e.workstream===workstream).map(e=>e.id));
 const related=context.relationships.filter(r=>memberIds.has(r.from)||memberIds.has(r.to)).map(r=>({ ...r,people:[r.from,r.to].flatMap(id=>context.entities.filter(e=>e.id===id)),certainty:/unconfirm|uncertain|may|might|possible|suggest/i.test(r.description)?'Unconfirmed':!r.refs.length||r.refs.some(ref=>/operator|generated|summary|inferred/i.test(context.sources.find(s=>s.id===ref.sourceId)?.category??'inferred'))?'Reported':'Documented'}));
 const timeline=(context.milestones??[]).filter(e=>e.workstream===workstream&&(!actor||e.entityIds.some(id=>memberIds.has(id)))&&/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&!Number.isNaN(Date.parse(e.date))&&new Date(e.date).toISOString().slice(0,10)===e.date&&e.refs.some(r=>context.sources.some(s=>s.id===r.sourceId))).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 return {documents,related,timeline};
}
