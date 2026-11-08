import {readProjectWindow,displayedCursors,type DisplayPlan,type ProjectWindow} from "./briefProjectWindow";
import type { ProjectReview } from "./projectReviews";
import type {BriefMemory,BriefScope} from './briefingMemory';
import {invoke} from '@tauri-apps/api/core';
import {type GmailStatus} from './gmail';
import {situationsClient,isUnchangedSnapshot,type SituationSnapshot} from './situations';
import {briefItems,selectBrief,type BriefContext,type BriefMode,type BriefReceipts,type BriefItem} from './briefingIntelligence';
import {acceptSynthesis,synthesisEligible,boundedSynthesis,type SynthesisInput,type SynthesisResult,type BriefingOrigin} from './briefingSynthesis';

export interface BriefClient {
 synthesize?(input:SynthesisInput):Promise<SynthesisResult>;
 reviews?():Promise<ProjectReview[]>;
 gmail():Promise<GmailStatus>;
 situations():Promise<SituationSnapshot|null>;
 memory?(scope:BriefScope):Promise<BriefMemory>;
 receipts():Promise<BriefReceipts>;
 deliver(items:{id:string;revision:string}[]):Promise<void>;
}
const native:BriefClient={
 // Backend refuses before credentials/process/model work while generation is gated.
 synthesize:input=>invoke<SynthesisResult>('briefing_synthesize',{input}),
 gmail:()=>invoke<GmailStatus>("gmail_status",{includeBrief:true}),
 reviews:()=>invoke("project_review_findings"),
 memory:scope=>invoke('briefing_conversation_context',{scope}),
 situations:async()=>{const value=await situationsClient.snapshot();return isUnchangedSnapshot(value)?null:value;},
 receipts:()=>invoke('briefing_receipts'),
 deliver:items=>invoke('briefing_record_delivery',{items}),
};
export interface PreparedBrief {
 provenance?:SynthesisResult['provenance'];
 briefing?:BriefingOrigin;
 text:string|null; items:BriefItem[]; delivery?:DisplayPlan;
 current():Promise<boolean>;
 acknowledge():Promise<void>;
}
export async function boundedBriefRead<T>(promise:Promise<T>):Promise<T> {
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([promise,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Brief source timed out')),3000);})]);}
 finally{clearTimeout(timer);}
}
const bounded=boundedBriefRead;

/** Let the native startup cadence finish before minting a source-bound ticket. */
export async function waitForBriefMail(
 active:()=>boolean=()=>true,
 read:()=>Promise<GmailStatus>=native.gmail,
 timing={now:()=>Date.now(),sleep:(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms))},
):Promise<GmailStatus> {
 const deadline=timing.now()+12_000;
 let mail:GmailStatus;
 do {
  if(!active())throw Error('Briefing context changed.');
  mail=await bounded(read());
  if(!active())throw Error('Briefing context changed.');
  const account=mail.account;
  const legacyAuth=['gmail_authentication_required','gmail_secure_store_unavailable','oauth_token_missing'].includes(account?.lastError??'');
  const retryable=account?.status!=='authentication_required'||legacyAuth;
  const next=Date.parse(account?.nextSync??'');
  // Match native sync_due, including interrupted/retryable errors. A running
  // retry retains lastError until it commits, so that error must not skip it.
  const pending=account?.enabled && (account.status==='syncing' ||
   (retryable && !mail.busy && (!Number.isFinite(next)||next<=timing.now())));
  if(!pending || timing.now()>=deadline)return mail;
  await timing.sleep(600);
 } while(true);
}

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
 gmail?.account?.id,gmail?.account?.enabled,gmail?.account?.status,gmail?.account?.lastSuccess,gmail?.account?.lastError,gmail?.busy,gmail?.analysis,gmail?.briefMail?.map(m=>[m.messageId,m.fingerprint]),
 situations?.accountId,situations?.revision??situations,
]);

export async function prepareFactualBrief(
 input:Omit<BriefContext,'gmail'|'situations'|'memory'> & {rootPath?:string},mode:BriefMode,now=Date.now(),client:BriefClient=native,
 sourcesCurrent:()=>boolean|Promise<boolean>=()=>true,
 scope:BriefScope={temporary:true,conversationId:null},
):Promise<PreparedBrief> {
 const readMemory=()=>!scope.temporary&&client.memory?bounded(client.memory(scope)):Promise.resolve(undefined);
 const readReviews=()=>!scope.temporary&&client.reviews?bounded(client.reviews()):Promise.resolve([] as ProjectReview[]);
 const windowRoot=client===native && !scope.temporary && !input.projectsError ? input.rootPath : undefined;
 const readProjects=():Promise<ProjectWindow>=>windowRoot?readProjectWindow(windowRoot,input.projects,now):Promise.resolve({projects:input.projects,gaps:[]});
 const readMail=()=>client===native && mode==='opening' ? waitForBriefMail() : bounded(client.gmail());
 const [mailResult,situationResult,receiptResult,memoryResult,reviewResult,projectResult]=await Promise.allSettled([
  readMail(),bounded(client.situations()),bounded(client.receipts()),readMemory(),readReviews(),readProjects(),
 ]);
 const gmail=mailResult.status==='fulfilled'?mailResult.value:null;
 const situations=situationResult.status==='fulfilled'?situationResult.value:null;
 const memory=memoryResult.status==='fulfilled'?memoryResult.value:null;
 const receipts=receiptResult.status==='fulfilled'?receiptResult.value:{};
 const associatedProjects=new Map<BriefItem,string>();
 const checkedProjects=projectResult.status==='fulfilled'?projectResult.value.projects:input.projects;
 const projectsError=projectResult.status==='rejected'?'Project change window unavailable':input.projectsError;
 const findings=briefItems({...input,projects:checkedProjects,projectsError,gmail,situations,memory},now);
 if(projectResult.status==="fulfilled" && projectResult.value.gaps.length) {
    const names=projectResult.value.gaps.join(", ");
    findings.push({id:"coverage:project-activity",kind:"limitation",text:"Git activity unavailable for "+names+". Other project evidence remains available.",priority:60,revision:names});
 }
 const parts=new Map<BriefItem,BriefItem[]>();
 for(const project of checkedProjects){
   const progress=findings.find(f=>f.id==="project:"+project.id+":progress");
   if(progress)associatedProjects.set(progress,project.name);
 }
 const records=reviewResult.status==='fulfilled'?reviewResult.value:[];
 const expectedReviews=JSON.stringify(records);
 const pathKey=(value:string)=>value.replace(/^\\\\\?\\/,"").replace(/\\/g,"/").replace(/\/$/,"").toLowerCase();
 const reviewed=new Set<string>();
 for(const review of records){
   if(review.outcome!=="changed")continue;
   const project=input.projects.find(p=>p.name===review.project && pathKey(p.path)===pathKey(review.source));
   const age=now-Date.parse(review.observedAt);
   if(!project || reviewed.has(project.id) || !Number.isFinite(age) || age<0)continue;
   reviewed.add(project.id);
   const row=input.board.find(r=>r.project.id===project.id);
   const action=row && ["NEEDS_YOU","BLOCKED"].includes(row.operationalStatus)
     ? row.operatorDecisions[0]?.text??row.nextMove : null;
   const finding:BriefItem={id:"project-review:"+project.id,kind:"progress",priority:54,revision:JSON.stringify([review.id,review.revision,action]),
     text:"Project Change Review #"+review.id+" found a new committed revision in "+review.project+": "+review.detail+"."+(action?" Recorded action: "+action+".":"")};
   findings.push(finding);associatedProjects.set(finding,project.name);
 }
 // Only join independently eligible sources that explicitly name one known project.
 // Keep the mail recommendation/correction and its authority intact.
 const words=(s:string)=>s.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.join(" ")??"";
 const namedProjects=(text:string)=>input.projects.filter(p=>words(p.name).length>=4 && (" "+words(text)+" ").includes(" "+words(p.name)+" "));
 for(const item of findings.filter(f=>f.id.startsWith("mail:"))){
   if(item.authority==='operator_statement')continue;
   const attention=situations?.attention?.find(a=>item.id==="mail:"+situations.accountId+":"+a.threadId);
   if(!attention)continue;
   const matches=namedProjects(attention.subject);
   if(matches.length!==1)continue;
   const related=findings.filter(f=>f.kind==="progress" && associatedProjects.get(f)===matches[0].name);
   if(!related.length)continue;
   parts.set(item,[{...item},...related]);
   item.text=related.map(f=>f.text).join(" ")+" Correspondence naming the same project: "+item.text;
   for(const finding of related){findings.splice(findings.indexOf(finding),1);associatedProjects.delete(finding);}
   associatedProjects.set(item,matches[0].name);
 }
 const digest=async(value:string)=>{
   const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
   return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
 };
 // Shipment reconciliation is evidence-bound in briefingTransactions.
 for(const memoryItem of findings.filter(f=>f.kind==="context" && f.source)){
   if(mode==="opening" && receipts[memoryItem.id]?.revision===await digest(memoryItem.revision))continue;
   const matches=namedProjects(memoryItem.text);
   if(matches.length!==1)continue;
   const related=findings.find(f=>associatedProjects.get(f)===matches[0].name);
   if(!related)continue;
   parts.set(related,[...(parts.get(related)??[{...related}]),memoryItem]);
   related.text+=" "+memoryItem.text;
   related.source=memoryItem.source;
   related.authority='unspecified'; // Mixed project facts and remembered interpretation.
   related.priority=Math.max(related.priority,memoryItem.priority);
   findings.splice(findings.indexOf(memoryItem),1);
   break;
 }
 const constituents=new Map<string,{id:string;revision:string}[]>();
 const candidates=await Promise.all(findings.map(async item=>{
   const components=parts.get(item);
   if(!components)return {...item,revision:await digest(item.revision)};
   const bound=await Promise.all(components.map(async f=>({id:f.id,revision:await digest(f.revision)})));
   const id=item.id+":combined";
   constituents.set(id,bound);
   return {...item,id,revision:await digest(JSON.stringify(bound))};
 }));
 const eligible=candidates.filter(i=>{
   if(mode!=="opening")return true;
   const group=constituents.get(i.id);
   if(group && group.every(p=>receipts[p.id]?.revision===p.revision))return false;
   return !i.id.startsWith("project-review:") || receipts[i.id]?.revision!==i.revision;
 });
 // Keep the highest-ranked current notice per merchant in the opening headlines.
 // Separate notifications from one sender need not refer to the same order.
 const merchants=new Map((gmail?.briefMail??[]).map(m=>["mail:"+gmail?.account?.id+":notice:"+m.threadId,m.sender.toLowerCase()]));
 const highlighted=new Set<string>();
 const ranked=eligible.filter(f=>selectBrief([f],receipts,mode,now).length>0).sort((a,b)=>b.priority-a.priority);
 const distinct=ranked.filter(f=>{
   const merchant=merchants.get(f.id.replace(/:combined$/,""));
   if(!merchant || f.priority>=77)return true;
   if(highlighted.has(merchant))return false;
   highlighted.add(merchant);return true;
 });
 const selected=selectBrief(distinct,receipts,mode,now);
 const memoryGap=eligible.find(i=>i.id==="coverage:memory");
 if(mode==="requested" && memoryGap && !selected.includes(memoryGap)){
   if(selected.length===3)selected.pop();
   selected.push(memoryGap);
 }
 const substantive=selected.filter(i=>i.kind!=="limitation");
 let items=selected.filter(i=>{
   if(i.id==="coverage:analysis")return !substantive.length && mode==="requested";
   if(mode==="opening" && i.id==="coverage:gmail" && gmail?.account?.enabled && !gmail.account.lastError)return false;
   return true;
 });

 let synthesizedText:string|undefined,provenance:SynthesisResult['provenance']|undefined;
 let modelBinding:{packetRevision:string;sources:{id:string;revision:string}[]}|undefined;
 // Until constituent-level citations exist, retain a combined item in full.
 const rewriteable=(i:BriefItem)=>synthesisEligible(i)&&!constituents.has(i.id);
 const selectedIds=new Set(items.map(i=>i.id));
 const contextual=candidates.filter(i=>!selectedIds.has(i.id)&&(i.kind==='context'||i.authority==='operator_statement')).slice(0,6);
 const evidence:SynthesisInput['evidence']=[...items.filter(i=>i.kind!=='limitation'),...contextual].map(i=>({id:i.id,revision:i.revision,
  kind:i.id.startsWith('mail:')?'mail':i.kind==='context'?'memory':'project',text:i.text,observedAt:now,
  authority:i.authority??(i.kind==='context'?'remembered_context':i.kind==='recommendation'?'hypothesis':'source_fact'),
  contextOnly:!selectedIds.has(i.id)||!rewriteable(i)}));
 if(client.synthesize&&evidence.some(e=>!e.contextOnly)){
  const packet:SynthesisInput={revision:await digest(JSON.stringify(evidence)),preparedAt:now,evidence};
  try{
   const accepted=acceptSynthesis(packet,await boundedSynthesis(client.synthesize(packet)));
   if(accepted){
    const protectedItems=items.filter(i=>!rewriteable(i));
    items=items.filter(i=>!rewriteable(i)||accepted.ids.has(i.id));
    synthesizedText=[...protectedItems.map(i=>i.text),accepted.text].filter(Boolean).join(' ');
    if(!synthesizedText&&mode==='requested')synthesizedText='I have no additional update to highlight from the evidence reviewed.';
    provenance=accepted.provenance;
    modelBinding={packetRevision:packet.revision,sources:evidence.filter(e=>accepted.ids.has(e.id)||protectedItems.some(i=>i.id===e.id)).map(e=>({id:e.id,revision:e.revision}))};
   }
  }catch{
   // A closed gate or failed synthesis preserves the source-grounded fallback.
   // No API/provider retry is attempted and no model provenance is claimed.
  }
 }

 const receiptItems=[...new Map(items.flatMap(i=>[{id:i.id,revision:i.revision},...(constituents.get(i.id)??[])]).map(r=>[r.id,r])).values()];
 const delivery:DisplayPlan={preparedAt:now,items:receiptItems,cursors:windowRoot && !projectsError?displayedCursors(checkedProjects,new Set(receiptItems.map(i=>i.id))):[]};
 const expected=signature(gmail,situations);
 const projectRevision=(projects:typeof checkedProjects)=>JSON.stringify(projects.map(p=>[p.path,p.sinceSessionCommits]));
 const expectedProjects=projectRevision(checkedProjects);
 const expectedGaps=JSON.stringify(projectResult.status==="fulfilled"?projectResult.value.gaps:[]);
 const memoryRevision=(value:BriefMemory|null|undefined)=>value?`${value.enabled}:${value.revision}`:value;
 const expectedMemory=memoryRevision(memory);
 return {
  items, delivery:scope.temporary?undefined:delivery,provenance,
  briefing:provenance&&modelBinding?{...provenance,...modelBinding,preparedAt:now}:{kind:'deterministic_fallback',preparedAt:now,sources:items.map(i=>({id:i.id,revision:i.revision}))},
  text:synthesizedText??(items.length?items.map(i=>i.text).join(' ')
   :mode==='requested'?'I found no new project or email highlights in the records I checked.':null),
  current:async()=>{
   if(!(await sourcesCurrent()))return false;
   const [mail,understanding,remembered,rechecked,projectCheck]=await Promise.allSettled([bounded(client.gmail()),bounded(client.situations()),readMemory(),readReviews(),readProjects()]);
   if(projectCheck.status!==projectResult.status || (projectCheck.status==="fulfilled" && (projectRevision(projectCheck.value.projects)!==expectedProjects || JSON.stringify(projectCheck.value.gaps)!==expectedGaps)))return false;
   if(JSON.stringify(rechecked.status==='fulfilled'?rechecked.value:[])!==expectedReviews)return false;
   return signature(mail.status==='fulfilled'?mail.value:null,understanding.status==='fulfilled'?understanding.value:null)===expected && memoryRevision(remembered.status==='fulfilled'?remembered.value:null)===expectedMemory && await sourcesCurrent();
  },
  acknowledge:async()=>{
    if(scope.temporary)return;
    for(let i=0;i<receiptItems.length;i+=3)await client.deliver(receiptItems.slice(i,i+3));
  },
 };
}
