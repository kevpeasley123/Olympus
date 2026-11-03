import type { ProjectReview } from "./projectReviews";
import type {BriefMemory,BriefScope} from './briefingMemory';
import {invoke} from '@tauri-apps/api/core';
import {gmailStatus,type GmailStatus} from './gmail';
import {situationsClient,isUnchangedSnapshot,type SituationSnapshot} from './situations';
import {briefItems,selectBrief,type BriefContext,type BriefMode,type BriefReceipts,type BriefItem} from './briefingIntelligence';

export interface BriefClient {
 reviews?():Promise<ProjectReview[]>;
 gmail():Promise<GmailStatus>;
 situations():Promise<SituationSnapshot|null>;
 memory?(scope:BriefScope):Promise<BriefMemory>;
 receipts():Promise<BriefReceipts>;
 deliver(items:{id:string;revision:string}[]):Promise<void>;
}
const native:BriefClient={
 gmail:gmailStatus,
 reviews:()=>invoke("project_review_history"),
 memory:scope=>invoke('briefing_conversation_context',{scope}),
 situations:async()=>{const value=await situationsClient.snapshot();return isUnchangedSnapshot(value)?null:value;},
 receipts:()=>invoke('briefing_receipts'),
 deliver:items=>invoke('briefing_record_delivery',{items}),
};
export interface PreparedBrief {
 text:string|null; items:BriefItem[];
 current():Promise<boolean>;
 acknowledge():Promise<void>;
}
export async function boundedBriefRead<T>(promise:Promise<T>):Promise<T> {
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Brief source timed out')),3000);})]);}
 finally{clearTimeout(timer);}
}
const bounded=boundedBriefRead;

/** A changing source is a retry, not a successfully consumed opening. */
export async function prepareStableBrief(prepare:()=>Promise<PreparedBrief>,active:()=>boolean):Promise<PreparedBrief> {
 for(let attempt=0;attempt<3;attempt++) {
  if(!active())throw Error('Briefing context changed.');
  const prepared=await prepare();
  if(active()&&await prepared.current()&&active())return prepared;
 }
 throw Error('Sources changed while preparing the briefing. Request it again for current evidence.');
}
const signature=(gmail:GmailStatus|null,situations:SituationSnapshot|null)=>JSON.stringify([
 gmail?.account?.id,gmail?.account?.enabled,gmail?.account?.status,gmail?.account?.lastSuccess,gmail?.account?.lastError,gmail?.busy,gmail?.analysis,
 situations?.accountId,situations?.revision??situations,
]);

export async function prepareFactualBrief(
 input:Omit<BriefContext,'gmail'|'situations'|'memory'>,mode:BriefMode,now=Date.now(),client:BriefClient=native,
 sourcesCurrent:()=>boolean|Promise<boolean>=()=>true,
 scope:BriefScope={temporary:true,conversationId:null},
):Promise<PreparedBrief> {
 const readMemory=()=>!scope.temporary&&client.memory?bounded(client.memory(scope)):Promise.resolve(undefined);
 const readReviews=()=>!scope.temporary&&client.reviews?bounded(client.reviews()):Promise.resolve([] as ProjectReview[]);
 const [mailResult,situationResult,receiptResult,memoryResult,reviewResult]=await Promise.allSettled([
  bounded(client.gmail()),bounded(client.situations()),bounded(client.receipts()),readMemory(),readReviews(),
 ]);
 const gmail=mailResult.status==='fulfilled'?mailResult.value:null;
 const situations=situationResult.status==='fulfilled'?situationResult.value:null;
 const memory=memoryResult.status==='fulfilled'?memoryResult.value:null;
 const receipts=receiptResult.status==='fulfilled'?receiptResult.value:{};
 const findings=briefItems({...input,gmail,situations,memory},now);
 const records=reviewResult.status==='fulfilled'?reviewResult.value:[];
 const expectedReviews=JSON.stringify(records);
 const pathKey=(value:string)=>value.replace(/^\\\\\?\\/,"").replace(/\\/g,"/").replace(/\/$/,"").toLowerCase();
 const reviewed=new Set<string>();
 for(const review of records){
   if(review.outcome==="unchanged" || reviewed.has(review.project))continue;
   reviewed.add(review.project);
   const project=input.projects.find(p=>p.name===review.project && pathKey(p.path)===pathKey(review.source));
   const age=now-Date.parse(review.observedAt);
   if(!project || !Number.isFinite(age) || age<0 || age>7*86_400_000 || review.outcome!=="changed")continue;
   const row=input.board.find(r=>r.project.id===project.id);
   const action=row && ["NEEDS_YOU","BLOCKED"].includes(row.operationalStatus)
     ? row.operatorDecisions[0]?.text??row.nextMove : null;
   findings.push({id:"project-review:"+project.id,kind:"progress",priority:54,revision:JSON.stringify([review.revision,action]),
     text:"Project Change Review #"+review.id+" found a new committed revision in "+review.project+": "+review.detail+"."+(action?" Recorded action: "+action+".":"")});
 }
 // Only join independently eligible sources that explicitly name one known project.
 // Keep the mail recommendation/correction and its authority intact.
 for(const item of findings.filter(f=>f.id.startsWith("mail:"))){
   const attention=situations?.attention?.find(a=>item.id==="mail:"+situations.accountId+":"+a.threadId);
   if(!attention)continue;
   const words=(s:string)=>s.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.join(" ")??"";
   const mentions=" "+words(attention.subject)+" ";
   const matches=input.projects.filter(p=>words(p.name).length>=4 && mentions.includes(" "+words(p.name)+" "));
   if(matches.length!==1)continue;
   const projectItem=findings.find(f=>f.id==="project-review:"+matches[0].id);
   if(!projectItem)continue;
   item.text=projectItem.text+" Correspondence naming the same project: "+item.text;
   item.revision=JSON.stringify([item.revision,projectItem.revision]);
   findings.splice(findings.indexOf(projectItem),1);
 }
 const candidates=await Promise.all(findings.map(async item=>{
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(item.revision));
  return {...item,revision:Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('')};
 }));
 const items=selectBrief(candidates.filter(i=>mode!=="opening" || !i.id.startsWith("project-review:") || receipts[i.id]?.revision!==i.revision),receipts,mode,now);
 const expected=signature(gmail,situations);
 const memoryRevision=(value:BriefMemory|null|undefined)=>value?`${value.enabled}:${value.revision}`:value;
 const expectedMemory=memoryRevision(memory);
 return {
  items,
  text:items.length?`Hello sir. Factual update. ${items.map(i=>i.text).join(' ')}`
   :mode==='requested'?'Hello sir. No items to highlight in the available project and email records. This factual check does not establish complete coverage.':null,
  current:async()=>{
   if(!(await sourcesCurrent()))return false;
   const [mail,understanding,remembered,rechecked]=await Promise.allSettled([bounded(client.gmail()),bounded(client.situations()),readMemory(),readReviews()]);
   if(JSON.stringify(rechecked.status==='fulfilled'?rechecked.value:[])!==expectedReviews)return false;
   return signature(mail.status==='fulfilled'?mail.value:null,understanding.status==='fulfilled'?understanding.value:null)===expected && memoryRevision(remembered.status==='fulfilled'?remembered.value:null)===expectedMemory && await sourcesCurrent();
  },
  acknowledge:()=>scope.temporary?Promise.resolve():client.deliver(items.map(({id,revision})=>({id,revision}))),
 };
}
