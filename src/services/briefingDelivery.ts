import {invoke} from '@tauri-apps/api/core';
import {gmailStatus,type GmailStatus} from './gmail';
import {situationsClient,isUnchangedSnapshot,type SituationSnapshot} from './situations';
import {briefItems,selectBrief,type BriefContext,type BriefMode,type BriefReceipts,type BriefItem} from './briefingIntelligence';

export interface BriefClient {
 gmail():Promise<GmailStatus>;
 situations():Promise<SituationSnapshot|null>;
 receipts():Promise<BriefReceipts>;
 deliver(items:{id:string;revision:string}[]):Promise<void>;
}
const native:BriefClient={
 gmail:gmailStatus,
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
 input:Omit<BriefContext,'gmail'|'situations'>,mode:BriefMode,now=Date.now(),client:BriefClient=native,
 sourcesCurrent:()=>boolean|Promise<boolean>=()=>true,
):Promise<PreparedBrief> {
 const [mailResult,situationResult,receiptResult]=await Promise.allSettled([
  bounded(client.gmail()),bounded(client.situations()),bounded(client.receipts()),
 ]);
 const gmail=mailResult.status==='fulfilled'?mailResult.value:null;
 const situations=situationResult.status==='fulfilled'?situationResult.value:null;
 const receipts=receiptResult.status==='fulfilled'?receiptResult.value:{};
 const candidates=await Promise.all(briefItems({...input,gmail,situations},now).map(async item=>{
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(item.revision));
  return {...item,revision:Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('')};
 }));
 const items=selectBrief(candidates,receipts,mode,now);
 const expected=signature(gmail,situations);
 return {
  items,
  text:items.length?`Hello sir. Factual update. ${items.map(i=>i.text).join(' ')}`
   :mode==='requested'?'Hello sir. No items to highlight in the available project and email records. This factual check does not establish complete coverage.':null,
  current:async()=>{
   if(!(await sourcesCurrent()))return false;
   const [mail,understanding]=await Promise.allSettled([bounded(client.gmail()),bounded(client.situations())]);
   return signature(mail.status==='fulfilled'?mail.value:null,understanding.status==='fulfilled'?understanding.value:null)===expected && await sourcesCurrent();
  },
  acknowledge:()=>client.deliver(items.map(({id,revision})=>({id,revision}))),
 };
}
