import type {BriefItem} from './briefingIntelligence';
export interface SynthesisInput {revision:string;preparedAt:number;evidence:{id:string;revision:string;kind:'mail'|'project'|'memory'|'coverage';text:string;observedAt:number;authority?:'source_fact'|'operator_statement'|'remembered_context'|'hypothesis'|'unspecified';contextOnly?:boolean}[]}
export interface SynthesisResult {revision:string;preparedAt:number;items:{text:string;whyItMatters:string;action:string;uncertainty:string;sourceIds:string[]}[];provenance:{kind:'model_synthesis';provider:string;model:string;requestId:string}}
/** Treat IPC output as untrusted until revision, provenance and references agree. */
export function acceptSynthesis(input:SynthesisInput,result:SynthesisResult):{text:string;ids:Set<string>;provenance:SynthesisResult['provenance']}|null {
 if(!result||result.revision!==input.revision||result.preparedAt!==input.preparedAt||!Array.isArray(result.items)||result.items.length>3)return null;
 const p=result.provenance;
 if(!p||p.kind!=='model_synthesis'||![p.provider,p.model,p.requestId].every(v=>typeof v==='string'&&v.trim().length>0&&v.length<=200))return null;
 const known=new Set(input.evidence.map(e=>e.id)),deliverable=new Set(input.evidence.filter(e=>!e.contextOnly).map(e=>e.id)),ids=new Set<string>(),sentences:string[]=[];
 for(const item of result.items){
  if(typeof item.text!=='string'||!item.text.trim()||item.text.length>240||![item.whyItMatters,item.action,item.uncertainty].every(v=>typeof v==='string'&&v.length<=160)||!Array.isArray(item.sourceIds)||!item.sourceIds.length||item.sourceIds.length>24||new Set(item.sourceIds).size!==item.sourceIds.length||item.sourceIds.some(id=>!known.has(id))||!item.sourceIds.some(id=>deliverable.has(id)))return null;
  let sentence=item.text.trim();
  for(const value of [item.whyItMatters,item.action,item.uncertainty]){
   const detail=value.trim();if(detail&&!sentence.toLowerCase().includes(detail.toLowerCase()))sentence+=' '+detail;
  }
  sentences.push(sentence);
  for(const id of item.sourceIds)ids.add(id);
 }
 return {text:sentences.join(' '),ids,provenance:p};
}
export function synthesisEligible(item:BriefItem):boolean {
 // Preserve explicit operator authority and coverage text outside model rewriting.
 return item.kind!=='limitation'&&item.authority!=='operator_statement';
}
export async function boundedSynthesis<T>(work:Promise<T>,limit=30_000):Promise<T>{
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Synthesis wait expired')),limit);})]);}
 finally{clearTimeout(timer);}
 // A timeout ignores late output; it does not claim provider work was cancelled.
}

/** Persisted attribution, not proof that a cited source entails a generated claim. */
export type BriefingOrigin={preparedAt:number;sources:{id:string;revision:string}[]} & (
 {kind:'deterministic_fallback'} | (SynthesisResult['provenance'] & {packetRevision:string})
);
