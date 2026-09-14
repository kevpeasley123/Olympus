import type {ContextRef,SituationContext} from './situations';

export type PriorityLevel='needs-attention'|'review-soon'|'stable'|'unassessed';
export interface PriorityQuestion {id:string;workstreamId:string;label:string;text:string;refs:ContextRef[];signal:'payment-coordination'|'source-conflict'|'open-question'}
export interface WorkstreamPriority {
 workstreamId:string;title:string;status:string[];level:PriorityLevel;reason:string;
 questions:PriorityQuestion[];refs:ContextRef[];action:'VERIFY'|'REVIEW';guidance:string;
}
export interface SituationPriority {
 policyVersion:1;asOf:string;workstreams:WorkstreamPriority[];questions:PriorityQuestion[];
 outcome:'recommended'|'tied'|'none';recommendedWorkstreamId?:string;message:string;
}
const uniqueRefs=(refs:ContextRef[])=>[...new Map(refs.map(r=>[`${r.sourceId}:${r.locator}`,r])).values()];
/** Review policy over saved open records, not a claim of live urgency or an inference loop. */
export function prioritizeSituation(context:SituationContext):SituationPriority{
 const sources=new Set(context.sources.map(s=>s.id));
 const questions:PriorityQuestion[]=context.facts.flatMap((fact,index)=>{
  if(fact.status!=='needs confirmation')return [];
  const label=fact.label.trim();
  // Labels identify the unresolved subject. Do not mine incidental or negated prose
  // for deadlines, unpaid balances, danger or assumed financial exposure.
  const payment=/\bservicer\b|payment (?:portal|instructions|recipient|routing|due date)|\bpayee\b/i.test(label);
  const conflict=/conflict|discrepancy|inconsistent/i.test(label)&&! /\bno\b|\bnot\b|without/i.test(label);
  return [{id:`question:${index}`,workstreamId:fact.workstream,label:label||'Unresolved record',text:fact.text,refs:fact.refs.filter(r=>sources.has(r.sourceId)),signal:payment?'payment-coordination':conflict?'source-conflict':'open-question'}];
 });
 const workstreams:WorkstreamPriority[]=context.workstreams.map(stream=>{
  const items=questions.filter(q=>q.workstreamId===stream.id);
  const supported=items.filter(q=>q.refs.length);
  const payment=supported.filter(q=>q.signal==='payment-coordination');
  const status=[...new Set(context.entities.filter(e=>e.workstream===stream.id).map(e=>e.status).filter(Boolean))];
  const explicitlyStable=status.length>0&&status.every(s=>/^stable$/i.test(s.trim()))&&context.entities.filter(e=>e.workstream===stream.id).every(e=>e.refs.some(r=>sources.has(r.sourceId)));
  const level:PriorityLevel=payment.length?'needs-attention':supported.length?'review-soon':items.length?'unassessed':explicitlyStable?'stable':'unassessed';
  const reason=payment.length?'Payment coordination is unresolved in the saved records. Verifying it clarifies where and how to manage payments.':supported.some(q=>q.signal==='source-conflict')?'Saved sources conflict; reconcile them before relying on the affected details.':supported.length?'This workstream has source-linked questions that need a current answer.':items.length?'Open questions lack usable source references; their basis needs verification.':explicitlyStable?'The saved status explicitly reports stable, with no recorded open questions.':'No open questions are recorded; that alone does not establish a stable current state.';
  const servicing=payment.some(q=>/servic|payment portal/i.test(q.label));
  const guidance=servicing?'Confirm the current servicer, payment portal, and payment instructions using a recent servicing statement.':payment.length?'Verify the current payment contact and instructions against an up-to-date statement.':stream.nextStep.trim()&&!/choose a workstream|review its current recommendation/i.test(stream.nextStep)?stream.nextStep:'Review the unresolved records and confirm which details still apply.';
  return {workstreamId:stream.id,title:stream.title,status,level,reason,questions:items,refs:uniqueRefs(supported.flatMap(q=>q.refs).concat(explicitlyStable?context.entities.filter(e=>e.workstream===stream.id).flatMap(e=>e.refs.filter(r=>sources.has(r.sourceId))):[])),action:payment.length?'VERIFY':'REVIEW',guidance};
 });
 const attention=workstreams.filter(w=>w.level==='needs-attention');
 const candidates=attention.length?attention:workstreams.filter(w=>w.level==='review-soon');
 const outcome=candidates.length===1?'recommended':candidates.length>1?'tied':'none';
 const ordered=questions.map((q,index)=>({q,index,attention:workstreams.find(w=>w.workstreamId===q.workstreamId)?.level==='needs-attention'})).sort((a,b)=>Number(b.attention)-Number(a.attention)||a.index-b.index).map(x=>x.q);
 return {policyVersion:1,asOf:context.asOf,workstreams,questions:ordered,outcome,recommendedWorkstreamId:outcome==='recommended'?candidates[0].workstreamId:undefined,message:outcome==='recommended'?candidates[0].reason:outcome==='tied'?'No single workstream currently stands out. Several items remain open.':questions.length?'Open items need stronger source context before a next priority can be identified.':'No source-backed follow-up is identified in the saved context. This is not a completeness check.'};
}
