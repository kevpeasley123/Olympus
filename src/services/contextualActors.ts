import type {ContextRef, SituationContext} from './situations';

export interface ContextualActor {
 id:string;entityIds:string[];primary:string;representatives:string[];role:string;
 workstream:string;functionGroup:string;state:'documented'|'reported'|'unconfirmed';
 refs:ContextRef[];relationshipRefs:ContextRef[];
}
const uniqueRefs=(refs:ContextRef[])=>[...new Map(refs.map(r=>[`${r.sourceId}:${r.locator}`,r])).values()];
function functionGroup(role:string){
 for(const [pattern,label] of [[/mortgage broker/i,'Broker'],[/lender contact/i,'Lender contact'],[/lender|mortgagee/i,'Lender'],[/servicer|payment recipient/i,'Servicing / payment'],[/sewer|plumb/i,'Sewer / plumbing'],[/electric/i,'Electrical'],[/roof|skylight/i,'Roof'],[/termite|pest|exterminat/i,'Pest / termite'],[/general inspection|home inspector/i,'General inspection']] as const)if(pattern.test(role))return label;
 return role||'Role not established';
}
/** A conservative projection of cited engagement links, never identity resolution. */
export function projectContextualActors(situationId:string,context:SituationContext):ContextualActor[]{
 const entities=new Map(context.entities.map(e=>[e.id,e]));
 const sources=new Map(context.sources.map(s=>[s.id,s]));
 const affiliation=new Map<string,{org:string;refs:ContextRef[]}[]>();
 for(const r of context.relationships){
  const a=entities.get(r.from),b=entities.get(r.to);if(!a||!b)continue;
  const person=a.kind==='person'?a:b.kind==='person'?b:undefined;
  const org=a.kind==='organization'?a:b.kind==='organization'?b:undefined;
  if(!person||!org||person.workstream!==org.workstream)continue;
  const uncertain=/unconfirm|uncertain|possible|\bmay\b|\bmight\b|\bnot\b|no longer|former|described|handoff|inferred|generated|operator context/i;
  const cited=r.refs.length>0&&r.refs.every(ref=>{const s=sources.get(ref.sourceId);return s&&!/operator|generated|summary|inferred/i.test(s.category)});
  // Legacy packs contain descriptions rather than typed relationships. Only
  // explicit representation templates qualify; co-occurrence never qualifies.
  const explicit=/\brepresents\b|authorized representative|\bsign(?:s|ing|ed)? for\b|\bis (?:the )?(?:(?:proposal|originator) )?contact (?:for|on)\b|\bis (?:the )?inspector named\b|\bsigned .{0,80}(?:inspection report|agreement)\b|\bis named on .{0,80}service report\b/i.test(r.description);
  if(!cited||uncertain.test(r.description)||/unconfirm|uncertain|generated|inferred|operator context/i.test(person.status+' '+org.status)||!explicit)continue;
  const links=affiliation.get(person.id)??[];links.push({org:org.id,refs:r.refs});affiliation.set(person.id,links);
 }
 const represented=new Map<string,{person:string;refs:ContextRef[]}[]>();
 for(const [person,links] of affiliation){
  const orgs=new Set(links.map(l=>l.org));if(orgs.size!==1)continue;
  const org=links[0].org,group=represented.get(org)??[];group.push({person,refs:uniqueRefs(links.flatMap(l=>l.refs))});represented.set(org,group);
 }
 const consumed=new Set([...represented.values()].flatMap(g=>g.map(x=>x.person)));
 return context.entities.filter(e=>!consumed.has(e.id)).flatMap(e=>{
  const contacts=(represented.get(e.id)??[]).sort((a,b)=>a.person.localeCompare(b.person));
  const roles=new Map<string,typeof contacts>();
  for(const contact of contacts){const role=entities.get(contact.person)!.role.trim().toLowerCase();roles.set(role,[...(roles.get(role)??[]),contact]);}
  // Preserve separate explicitly recorded roles within one organization.
  const buckets=roles.size>1?[...roles.entries()]:[['',contacts]] as [string,typeof contacts][];
  return buckets.map(([roleKey,engagement])=>{
  const members=[e,...engagement.map(x=>entities.get(x.person)!)];
  const role=roleKey?entities.get(engagement[0].person)!.role:e.role;

  const state:ContextualActor['state']=e.kind==='unknown'||/unconfirm|uncertain|needs confirmation/i.test(e.status)?'unconfirmed':/operator|generated|inferred/i.test(e.status)?'reported':'documented';
  return {id:`${situationId}:${e.workstream}:${e.id}${roleKey?':role:'+encodeURIComponent(roleKey):''}`,entityIds:members.map(m=>m.id),primary:e.name,representatives:members.slice(1).map(m=>m.name),role:role||'Role not established',workstream:e.workstream,functionGroup:functionGroup(role),state,refs:uniqueRefs(members.flatMap(m=>m.refs).concat(engagement.flatMap(c=>c.refs))),relationshipRefs:uniqueRefs(engagement.flatMap(c=>c.refs))};
  });
 }).sort((a,b)=>a.functionGroup.localeCompare(b.functionGroup)||a.primary.localeCompare(b.primary)||a.id.localeCompare(b.id));
}
