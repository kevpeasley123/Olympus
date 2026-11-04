import {readProjectWindow,displayedCursors,type DisplayPlan,type ProjectWindow} from "./briefProjectWindow";
import type { ProjectReview } from "./projectReviews";
import type {BriefMemory,BriefScope} from './briefingMemory';
import {invoke} from '@tauri-apps/api/core';
import {type GmailStatus} from './gmail';
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
 gmail:()=>invoke<GmailStatus>("gmail_status",{includeBrief:true}),
 reviews:()=>invoke("project_review_findings"),
 memory:scope=>invoke('briefing_conversation_context',{scope}),
 situations:async()=>{const value=await situationsClient.snapshot();return isUnchangedSnapshot(value)?null:value;},
 receipts:()=>invoke('briefing_receipts'),
 deliver:items=>invoke('briefing_record_delivery',{items}),
};
export interface PreparedBrief {
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
 const [mailResult,situationResult,receiptResult,memoryResult,reviewResult,projectResult]=await Promise.allSettled([
  bounded(client.gmail()),bounded(client.situations()),bounded(client.receipts()),readMemory(),readReviews(),readProjects(),
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
 // Keep related notices together without equating two notifications with two orders.
 const merchantUpdates=new Map<string,BriefItem[]>();
 for(const mail of gmail?.briefMail??[]){
   const id="mail:"+gmail?.account?.id+":notice:"+mail.threadId;
   const finding=findings.find(f=>f.id===id && f.priority===56);
   if(!finding || (mode==="opening" && receipts[id]?.revision===await digest(finding.revision)))continue;
   const group=merchantUpdates.get(mail.sender)??[];
   group.push(finding);merchantUpdates.set(mail.sender,group);
 }
 for(const [merchant,group] of merchantUpdates){
   if(group.length<2)continue;
   const first=group[0];
   const displayed=group.slice(0,2);
   parts.set(first,displayed.map(f=>({...f})));
   const sources=displayed.map(f=>gmail!.briefMail!.find(m=>f.id==="mail:"+gmail!.account!.id+":notice:"+m.threadId)!);
   const name=merchant.split("<")[0].replace(/^"|"$/g,"").trim() || "The sender";
   const descriptions=sources.map(m=>new Date(m.timestamp).toLocaleDateString(undefined,{month:"short",day:"numeric"})+" — "+(m.item || m.subject)+(m.detail?" ("+m.detail+")":""));
   first.text=name+" sent two shipping updates. "+descriptions.join(". ")+".";
   if(sources.every(m=>/has shipped|order shipped/i.test(m.subject)))first.text+=" Both notices confirm dispatch. Arrival is still unconfirmed in these messages.";
   for(const other of displayed.slice(1))findings.splice(findings.indexOf(other),1);
 }
 for(const memoryItem of findings.filter(f=>f.kind==="context" && f.source)){
   if(mode==="opening" && receipts[memoryItem.id]?.revision===await digest(memoryItem.revision))continue;
   const matches=namedProjects(memoryItem.text);
   if(matches.length!==1)continue;
   const related=findings.find(f=>associatedProjects.get(f)===matches[0].name);
   if(!related)continue;
   parts.set(related,[...(parts.get(related)??[{...related}]),memoryItem]);
   related.text+=" "+memoryItem.text;
   related.source=memoryItem.source;
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
 const selected=selectBrief(eligible,receipts,mode,now);
 const memoryGap=eligible.find(i=>i.id==="coverage:memory");
 if(mode==="requested" && memoryGap && !selected.includes(memoryGap)){
   if(selected.length===3)selected.pop();
   selected.push(memoryGap);
 }
 const substantive=selected.filter(i=>i.kind!=="limitation");
 const items=selected.filter(i=>i.id!=="coverage:analysis" || (!substantive.length && mode==="requested"));

 const receiptItems=[...new Map(items.flatMap(i=>[{id:i.id,revision:i.revision},...(constituents.get(i.id)??[])]).map(r=>[r.id,r])).values()];
 const delivery:DisplayPlan={preparedAt:now,items:receiptItems,cursors:windowRoot && !projectsError?displayedCursors(checkedProjects,new Set(receiptItems.map(i=>i.id))):[]};
 const expected=signature(gmail,situations);
 const projectRevision=(projects:typeof checkedProjects)=>JSON.stringify(projects.map(p=>[p.path,p.sinceSessionCommits]));
 const expectedProjects=projectRevision(checkedProjects);
 const expectedGaps=JSON.stringify(projectResult.status==="fulfilled"?projectResult.value.gaps:[]);
 const memoryRevision=(value:BriefMemory|null|undefined)=>value?`${value.enabled}:${value.revision}`:value;
 const expectedMemory=memoryRevision(memory);
 return {
  items, delivery:scope.temporary?undefined:delivery,
  text:items.length?items.map(i=>i.text).join(' ')
   :mode==='requested'?'I found no new project or email highlights in the records I checked.':null,
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
