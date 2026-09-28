import type {PriorityLevel} from './situationPriority';
import type {ContextualActor} from './contextualActors';
import type {ContextRef} from './situations';
export interface GraphGroup {id:string;title:string;actors:ContextualActor[];total?:number;priority?:{level:PriorityLevel;reason:string;recommended:boolean}}
export interface GraphNode {id:string;kind:'anchor'|'group'|'actor';x:number;y:number;width:number;height:number;label:string;groupId?:string;actor?:ContextualActor;total?:number}
export interface GraphEdge {from:string;to:string;kind:'structure'|'relationship';description:string;uncertain?:boolean;refs?:ContextRef[]}
const slots=[[270,72],[730,72],[880,225],[880,425],[730,578],[270,578],[120,425],[120,225]];
/** Fixed orbital slots reserve full rectangular bounds. No physics or input mutation. */
export function layoutSituationGraph(title:string,groups:GraphGroup[],relationships:{from:string;to:string;description:string;refs:ContextRef[]}[]=[]){
 const nodes:GraphNode[]=[{id:'anchor',kind:'anchor',x:500,y:325,width:168,height:96,label:title}];
 const edges:GraphEdge[]=[];let slot=0;
 for(const group of groups){
  const first=slot;const members=group.actors;
  const count=Math.max(1,members.length);
  if(slot+count>8)throw new Error('Graph page exceeds eight orbital slots');
  const [sx,sy]=slots[first];
  const hub:GraphNode={id:'group:'+group.id,kind:'group',x:500+(sx-500)*.49,y:325+(sy-325)*.49,width:140,height:54,label:group.title,groupId:group.id,total:group.total??members.length};
  nodes.push(hub);edges.push({from:'anchor',to:hub.id,kind:'structure',description:'Situation workstream or role grouping'});
  for(const actor of members){const [x,y]=slots[slot++];nodes.push({id:actor.id,kind:'actor',x,y,width:222,height:132,label:actor.primary,actor});edges.push({from:hub.id,to:actor.id,kind:'structure',description:actor.role,uncertain:actor.state!=='documented',refs:actor.refs});}
  if(!members.length)slot++;
 }
 const entityNodes=new Map<string,string[]>();
 for(const node of nodes.filter(n=>n.actor))for(const id of node.actor!.entityIds)entityNodes.set(id,[...(entityNodes.get(id)??[]),node.id]);
 // Shared organization IDs cannot choose one engagement arbitrarily.
 const byEntity=new Map([...entityNodes].filter(([,ids])=>ids.length===1).map(([id,ids])=>[id,ids[0]]));
 const seen=new Set<string>();
 for(const relationship of relationships){const from=byEntity.get(relationship.from),to=byEntity.get(relationship.to);if(!from||!to||from===to)continue;const key=[from,to].sort().join('|')+'|'+relationship.description;if(seen.has(key))continue;seen.add(key);edges.push({from,to,kind:'relationship',description:relationship.description,refs:relationship.refs,uncertain:!relationship.refs.length||/may|uncertain|unconfirmed|operator|handoff|inferred/i.test(relationship.description)});}
 return {nodes,edges,width:1000,height:650};
}
/** Clip edges to rectangular boundaries, keeping lines out of node labels. */
export function edgeBoundary(a:GraphNode,b:GraphNode){const dx=b.x-a.x,dy=b.y-a.y;const ratio=Math.min(dx? a.width/2/Math.abs(dx):Infinity,dy?a.height/2/Math.abs(dy):Infinity);return {x:a.x+dx*ratio,y:a.y+dy*ratio};}

/** Overview workstreams are information nodes, with actors summarized inside. */
export function layoutSituationOverview(title:string,groups:GraphGroup[]){
 const nodes:GraphNode[]=[{id:'anchor',kind:'anchor',x:500,y:325,width:164,height:164,label:title}];
 const edges:GraphEdge[]=[];
 groups.slice(0,8).forEach((g,i)=>{const [x,y]=slots[i];nodes.push({id:'group:'+g.id,kind:'group',x,y,width:238,height:142,label:g.title,groupId:g.id,total:g.total??g.actors.length});edges.push({from:'anchor',to:'group:'+g.id,kind:'structure',description:'Situation contains '+g.title});});
 return {nodes,edges,width:1000,height:650};
}

export const MAP_ZOOM_LEVELS=[1,1.2,1.5,1.9,2.4] as const;
export function situationGraphBounds(nodes:GraphNode[],padding=24){
 const left=Math.min(...nodes.map(n=>n.x-n.width/2))-padding,top=Math.min(...nodes.map(n=>n.y-n.height/2))-padding;
 const right=Math.max(...nodes.map(n=>n.x+n.width/2))+padding,bottom=Math.max(...nodes.map(n=>n.y+n.height/2))+padding;
 return {x:left,y:top,width:right-left,height:bottom-top};
}
