import type {RunEvent, WorkflowNode} from './communicationIntelligence';

export const record = (value:unknown):Record<string,unknown> => value!==null && typeof value==='object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
export const strings = (value:unknown):string[] => Array.isArray(value)?value.filter((v):v is string=>typeof v==='string'):[];
export const text = (value:unknown, fallback='Not recorded'):string => typeof value==='string' && value.length>0?value:fallback;
export const number = (value:unknown):number|undefined => typeof value==='number'&&Number.isFinite(value)&&value>=0?value:undefined;
export function eventData(event:RunEvent):Record<string,unknown> {const raw=record(event.result);return record(raw.traceVersion===1?raw.data:event.result)}
export function eventOutput(event:RunEvent):unknown {const raw=record(event.result);return raw.traceVersion===1?raw.data:event.result}
export function skillKey(value:unknown):string|undefined {const s=record(value);return typeof s.id==='string'&&Number.isInteger(s.version)?`${s.id}@${s.version}`:undefined}
export function savedSkill(skills:unknown[],key:string):Record<string,unknown>|undefined {const matches=skills.filter(s=>skillKey(s)===key);return matches.length===1?record(matches[0]):undefined}
export function nodeBindings(node:WorkflowNode, bindings?:Record<string,string[]>):string[] {
 return [...new Set([...(node.kind.includes('@')?[node.kind]:[]),...strings(bindings?.[node.id])])];
}
export function nodeEvidence(node:string,events:RunEvent[],complete:boolean,runStatus:string){
 const own=events.filter(e=>e.node===node),lifecycle=own.filter(e=>['running','completed','failed','stopped'].includes(e.state));
 const last=lifecycle[lifecycle.length-1],start=lifecycle.filter(e=>e.state==='running').slice(-1)[0];
 const end=last&&last.state!=='running'?last:undefined;
 const begin=record(start?.result),finish=record(end?.result);
 const a=number(begin.elapsedMs),b=number(finish.elapsedMs);
 // A single explicit attempt with monotonic boundaries is required for duration.
 const attempt=number(begin.attempt);
 const timed=complete&&lifecycle.length===2&&lifecycle[0]===start&&lifecycle.filter(e=>e.state==='running').length===1&&begin.traceVersion===1&&finish.traceVersion===1&&attempt!==undefined&&Number.isInteger(attempt)&&attempt>0&&attempt===finish.attempt&&a!==undefined&&b!==undefined&&b>=a;
 const state=last?.state??'No recorded event';
 return {state:state==='running'&&runStatus!=='running'?`${state} at ${runStatus}`:state,start:start?.at,end:end?.at,durationMs:timed?b!-a!:undefined,attempt:begin.traceVersion===1?number(begin.attempt):undefined,events:own};
}
export function requestReceipts(events:RunEvent[]){
 const receipts=new Map<string,Record<string,unknown>>();
 for(const e of events){const data=eventData(e),r=record(data.request);if(typeof r.id==='string')receipts.set(r.id,r)}
 return [...receipts.values()];
}
export function eventSummary(event:RunEvent):string {
 const d=eventData(event);
 if(event.state==='pass_started')return `Pass ${text(String(d.pass??'?'))} · ${number(d.assessedThreads)??'unrecorded count of'} threads · request ${text(d.requestId)}`;
 if(event.state==='model_result'){const r=record(d.request);return `Pass ${d.pass??'?'} · ${text(r.status)} · actual model: ${text(r.actualModel,'unconfirmed')}`}
 if(event.state==='iteration')return `Pass ${d.pass??'?'} · thread ${text(d.threadId)} · ${text(d.stopReason).replace(/_/g,' ')}`;
 if(event.node==='feedback')return `${text(d.event??d.feedback)} · thread ${text(d.threadId)}`;
 if(d.error)return text(d.error);
 if(event.state==='catalog_snapshot')return `${Array.isArray(d.sources)?d.sources.length:'Unknown'} project records prepared`;
 if(d.selectedThreads!==undefined)return `${d.selectedThreads} threads selected`;
 if(d.assessedThreads!==undefined)return `${d.assessedThreads} threads assessed · ${d.passes??'?'} model passes`;
 if(d.cachedMessages!==undefined)return `${d.cachedMessages} cached messages · ${d.cachedThreads??'?'} threads`;
 return text(d.stopReason??d.policy??d.method,event.state.replace(/_/g,' '));
}

/** Edges express the saved dependencies, never inferred concurrency. */
export function diagram(nodes:WorkflowNode[]){
 const depth=new Map<string,number>();
 for(const n of nodes) depth.set(n.id,Math.min(12,Math.max(-1,...n.dependsOn.map(id=>depth.get(id)??-1))+1));
 const groups=new Map<number,WorkflowNode[]>();for(const n of nodes){const d=depth.get(n.id)!;groups.set(d,[...(groups.get(d)??[]),n])}
 const width=Math.max(320,...[...groups.values()].map(g=>g.length*290+30));
 const points=nodes.map(n=>{const group=groups.get(depth.get(n.id)!)!;return {node:n,x:width/2+(group.indexOf(n)-(group.length-1)/2)*290,y:depth.get(n.id)!*100+40}});
 return {points,width,height:(Math.max(0,...depth.values())+1)*100};
}
