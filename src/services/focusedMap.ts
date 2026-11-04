import type {Observation,Situation,SituationContext} from './situations';
import {projectContextualActors,type ContextualActor} from './contextualActors';
import {dossierDetails} from './dossierDetails';
export type FocusedKind='situation'|'workstream'|'actor'|'person'|'document'|'thread';
export interface FocusedNode {
 key:string;kind:FocusedKind;title:string;subtitle:string;summary:string;parent:string|null;
 sourceIds:string[];threadIds:string[];contacts:string[];actor?:ContextualActor;
 document?:SituationContext['sources'][number];observation?:Observation;workstream?:string;
}
export interface FocusedMap {root:string;nodes:FocusedNode[];children:Record<string,string[]>;related:{from:string;to:string;description:string;certainty:string}[]}
const unique=(items:string[])=>[...new Set(items)];
/** An exact address or complete display-name mailbox, never a name/substring guess. */
function mailbox(value:string){
 if(/\b(possibly|unconfirmed|uncertain|maybe)\b/i.test(value))return null;
 const v=value.trim(),match=v.match(/^(?:[^<>]*<([^<>]+)>|([^<>\s]+))$/),email=match?.[1]??match?.[2];
 return email&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)?email.toLowerCase():null;
}
export function buildFocusedMap(situation:Situation,allObservations:readonly Observation[]):FocusedMap {
 const observations=allObservations.filter(o=>o.situationId===situation.id),context=situation.localContext;
 const root='situation:'+situation.id,nodes:FocusedNode[]=[],children:Record<string,string[]>={},related:FocusedMap['related']=[];
 const add=(node:FocusedNode)=>{nodes.push(node);children[node.key]=[];if(node.parent)children[node.parent]?.push(node.key)};
 const base={sourceIds:[] as string[],threadIds:[] as string[],contacts:[] as string[]};
 add({...base,key:root,kind:'situation',title:situation.title,subtitle:context?.phase??'Correspondence',summary:context?.summary??situation.briefing.whereThingsStand??'No saved summary yet.',parent:null,sourceIds:context?.sources.map(s=>s.id)??[],threadIds:unique(observations.map(o=>o.threadId))});
 const actors=context?projectContextualActors(situation.id,context):[];
 if(context){
  for(const stream of context.workstreams)add({...base,key:'workstream:'+stream.id,kind:'workstream',title:stream.title,subtitle:'Relationship group',summary:stream.summary,parent:root,workstream:stream.id,sourceIds:dossierDetails(context,stream.id).documents.map(d=>d.id)});
  for(const actor of actors){
   const contacts=unique(context.entities.filter(e=>actor.entityIds.includes(e.id)).flatMap(e=>e.contacts));
   const emails=new Set(contacts.flatMap(c=>mailbox(c)??[]));
   const threadIds=observations.filter(o=>o.people.some(p=>emails.has(mailbox(p.email)??''))).map(o=>o.threadId);
   const parent=children['workstream:'+actor.workstream]?'workstream:'+actor.workstream:root;
   add({key:'actor:'+actor.id,kind:'actor',title:actor.primary,subtitle:[...actor.representatives,actor.role].filter(Boolean).join(' · '),summary:context.entities.filter(e=>actor.entityIds.includes(e.id)).map(e=>e.notes).filter(Boolean).join('\n\n')||'No relationship summary recorded.',parent,actor,workstream:actor.workstream,contacts,sourceIds:dossierDetails(context,actor.workstream,actor).documents.map(d=>d.id),threadIds:unique(threadIds)});
  }
  for(const node of nodes.filter(n=>n.kind==='workstream'))node.threadIds=unique(nodes.filter(n=>n.parent===node.key).flatMap(n=>n.threadIds));
  for(const source of context.sources){
   const owners=nodes.filter(n=>n.kind==='actor'&&n.sourceIds.includes(source.id));
   const scopes=owners.length?owners:nodes.filter(n=>n.kind==='workstream'&&n.sourceIds.includes(source.id));
   const key='document:'+source.id;
   add({...base,key,kind:'document',title:source.title,subtitle:'Document',summary:source.document?.description??'Linked source document.',parent:scopes[0]?.key??root,document:source,sourceIds:[source.id]});
   for(const scope of scopes.slice(1))children[scope.key].push(key);
  }
  for(const relation of context.relationships){
   const from=actors.find(a=>a.entityIds.includes(relation.from)),to=actors.find(a=>a.entityIds.includes(relation.to));
   if(!from||!to||from.id===to.id)continue;
   const detail=dossierDetails(context,from.workstream,from).related.find(r=>r.from===relation.from&&r.to===relation.to&&r.description===relation.description);
   related.push({from:'actor:'+from.id,to:'actor:'+to.id,description:relation.description,certainty:detail?.certainty??'Unconfirmed'});
  }
 }
 // Unmatched correspondence remains reachable; it is not silently attributed to a similar name.
 const linkedEmails=new Set(nodes.filter(n=>n.kind==='actor').flatMap(n=>n.contacts.flatMap(c=>mailbox(c)??[])));
 const people=new Map<string,Observation['people'][number]>();
 for(const o of observations)for(const p of o.people){const email=mailbox(p.email);if(email&&!linkedEmails.has(email)&&!people.has(email))people.set(email,p)}
 for(const [email,person] of people){const threads=observations.filter(o=>o.people.some(p=>mailbox(p.email)===email));add({...base,key:'person:'+email,kind:'person',title:person.name||email,subtitle:person.role||'Correspondence contact',summary:'Contact recorded in linked correspondence. Role inferred from email.',parent:root,contacts:[email],threadIds:unique(threads.map(t=>t.threadId))})}
 for(const o of observations){
  const participants=nodes.filter(n=>(n.kind==='actor'||n.kind==='person')&&n.threadIds.includes(o.threadId));
  const parent=participants[0]?.key??root;
  add({...base,key:'thread:'+o.threadId,kind:'thread',title:o.subject||'(No subject)',subtitle:'Conversation',summary:o.summary,parent,threadIds:[o.threadId],observation:o});
  for(const participant of participants.slice(1))children[participant.key].push('thread:'+o.threadId);
  const endpoints=(email:string)=>participants.filter(n=>n.contacts.some(c=>mailbox(c)===mailbox(email)));
  for(const relation of o.relationships)for(const from of endpoints(relation.from))for(const to of endpoints(relation.to)){
   if(from.key!==to.key&&!related.some(r=>r.from===from.key&&r.to===to.key&&r.description===relation.description))related.push({from:from.key,to:to.key,description:relation.description,certainty:'Inferred from cached correspondence'});
  }
 }
 return {root,nodes,children,related};
}
export function branchPage(graph:FocusedMap,focusKey:string,page:number){
 const focus=graph.nodes.find(n=>n.key===focusKey)??graph.nodes[0];
 const keys=unique(graph.children[focus.key]??[]),total=keys.length;
 const safePage=Math.max(0,Math.min(Number.isFinite(page)?Math.floor(page):0,Math.max(0,Math.ceil(total/8)-1)));
 const byId=new Map(graph.nodes.map(n=>[n.key,n]));
 return {focus,page:safePage,total,nodes:keys.slice(safePage*8,safePage*8+8).flatMap(k=>byId.get(k)??[])};
}
export function searchFocusedMap(graph:FocusedMap,query:string){
 const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 if(!terms.length)return [];
 return graph.nodes.filter(n=>{const text=[n.title,n.subtitle,...n.contacts].join(' ').toLocaleLowerCase();return terms.every(t=>text.includes(t))});
}
