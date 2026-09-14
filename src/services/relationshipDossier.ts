import type {SituationContext} from './situations';
import type {ContextualActor} from './contextualActors';

/** Presentation only. No status promotion, model calls, or canonical mutations. */
export function relationshipDossier(context:SituationContext,actor:ContextualActor){
 const members=actor.entityIds.flatMap(id=>context.entities.filter(e=>e.id===id));
 const stream=context.workstreams.find(w=>w.id===actor.workstream);
 const role=actor.role.toLowerCase();
 const type=/inspect/.test(role)?'inspector':/contractor|remodel|renovat/.test(role)?'contractor':/lender|mortgage|loan|servicer/.test(role)?'lender':/insurance|policy|insurer/.test(role)?'insurer':/utility|water service|electric service|gas service/.test(role)?'utility':/hoa|community|association/.test(role)?'hoa':'other';
 const labels={contractor:['How we met','Business together','Current progress'],inspector:['How we engaged them','Inspection / work performed','Current status'],lender:['How we connected','Loan / business relationship','Current status'],insurer:['How we connected','Policy relationship','Current status'],utility:['How we connected','Service relationship','Current status'],hoa:['How we connected','Property relationship','Current status'],other:['How we met','Business together','Current status']}[type];
 const sourceIds=new Set(actor.refs.map(r=>r.sourceId));
 const records=context.facts.filter(f=>f.workstream===actor.workstream&&f.refs.some(r=>sourceIds.has(r.sourceId)));
 // A shared source is supporting workstream context, not actor attribution.
 // Only facts explicitly naming a canonical member enter the primary dossier.
 const names=members.map(m=>m.name.toLowerCase()).filter(n=>n.length>3);
 const attributed=records.filter(f=>names.some(n=>(f.label+' '+f.text).toLowerCase().includes(n)));
 const notes=[...new Set(members.map(m=>m.notes.trim()).filter(Boolean))];
 const originPattern=/\b(introduced by|referred by|first contacted|earliest documented interaction|relationship began)\b/i;
 const origins=[...new Set([...notes,...attributed.map(f=>f.text)].filter(n=>originPattern.test(n)))];
 const compact=(value:string,fallback:string)=>value.length<=230?value:fallback;
 const status=[...new Set(members.map(m=>m.status.trim()).filter(Boolean))].join(' · ');
 const business:{label:string;text:string;basis:string}[]=attributed.filter(f=>!originPattern.test(f.text)).slice(0,3).map(f=>({label:f.label,text:compact(f.text,'Detailed terms are available in Documents & records.'),basis:f.status}));
 if(!business.length){for(const note of notes.filter(n=>!originPattern.test(n)).slice(0,2))business.push({label:business.length?'Engagement detail':'Recorded engagement',text:compact(note,'Engagement details are available in Documents & records.'),basis:'saved context'});}
 return {type,labels,members,stream,records,notes,contacts:[...new Set(members.flatMap(m=>m.contacts).filter(Boolean))],
  profile:`${actor.role||'Role not established'}${stream?` for ${stream.title.toLowerCase()}`:''}.`,
  origin:origins.length?compact(origins.join(' '),'Relationship history is recorded in Documents & records.'): 'How the relationship was originally established is not recorded.',
  business,status:compact(/^(documented|documented relationship)$/i.test(status)?'Relationship documented; current work or service status is not recorded.':status||'Current status is not recorded.','See the saved status descriptions in Source details.'),
  nextStep:stream?.nextStep?.trim()||'Confirm the current relationship status before deciding whether action is needed.',
  nextStepScope:stream?.nextStep?.trim()?`${stream.title} recommendation`:'Suggested verification',
  relationships:context.relationships.filter(r=>actor.entityIds.includes(r.from)||actor.entityIds.includes(r.to))};
}
