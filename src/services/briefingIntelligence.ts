import type { TrackedProject } from '../types';
import type { ProjectCommandState } from './projectCommandBoard';
import type { GmailStatus } from './gmail';
import type { SituationSnapshot } from './situations';
import type { BriefMemory } from './briefingMemory';
import type {EmailFeedbackSource} from './conversationFeedback';

export interface BriefItem { id:string; revision:string; text:string; priority:number; kind:'limitation'|'attention'|'progress'|'recommendation'|'context'; source?:{conversationId:string;messageIds:string[]}; emailSource?:EmailFeedbackSource }
export interface Receipt { revision:string; deliveredAt:number }
export type BriefReceipts=Record<string,Receipt>;
export type BriefMode='opening'|'requested';
export interface BriefContext {
 projects:TrackedProject[]; board:ProjectCommandState[]; projectsError:string|null;
 gmail:GmailStatus|null; situations:SituationSnapshot|null;
 memory?:BriefMemory|null;
}
const DAY=86_400_000;
const FRESH=15*60_000;
const text=(value:string,limit=260)=>value.replace(/\s+/g,' ').trim().slice(0,limit);
const validTime=(value:string|null|undefined,now:number,maxAge=FRESH)=>{
 const at=Date.parse(value??''); return Number.isFinite(at)&&at<=now+60_000&&now-at<=maxAge;
};

function transactionFindings(gmail:GmailStatus,situations:SituationSnapshot|null,now:number):BriefItem[] {
 const account=gmail.account;
 if(!account)return [];
 const findings:BriefItem[]=[];
 for(const mail of gmail.briefMail??[]) {
  if(!mail.fingerprint||!mail.threadId||!mail.messageId||!Number.isFinite(mail.timestamp)||mail.timestamp>now||now-mail.timestamp>7*DAY)continue;
  if(situations?.attention?.some(a=>a.threadId===mail.threadId && a.operatorCorrection))continue;
  const subject=text(mail.subject,160);
  const sender=text(mail.sender.split('<')[0].replace(/^"|"$/g,''),60)||'The sender';
  const date=new Date(mail.timestamp).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  let report:string,priority:number;
  if(/\b(delivery (?:failed|exception|delayed)|could not deliver|shipment delayed)\b/i.test(subject)){
   report=`${sender} reported a delivery problem on ${date}: “${subject}”. Check the carrier notice for the next step.`;priority=79;
  } else if(/\b(action required|payment due|response due|deadline)\b/i.test(subject)){
   report=`${sender} flagged “${subject}” on ${date}. Check the original request and whether you have already handled it.`;priority=77;
  } else if(/\b(has shipped|order shipped|out for delivery|was delivered|has been delivered)\b/i.test(subject)){
   report=`${sender} sent a shipping update on ${date}: “${subject}”.`;priority=56;
  } else if(/\b(your receipt|order confirmation|order has been confirmed|got your order|your order invoice)\b/i.test(subject)){
   report=`${sender} sent “${subject}” on ${date}.`;priority=47;
  } else continue;
  if(mail.item) report+=` The notice lists ${text(mail.item,140)}.`;
  if(mail.detail) report+=` The message says “${text(mail.detail,180)}”.`;
  if(priority===56 && /has shipped|order shipped/i.test(subject) && !mail.detail) report+=" The carrier has yet to confirm arrival in this notice.";
  findings.push({id:`mail:${account.id}:notice:${mail.threadId}`,kind:'progress',priority,text:report,revision:JSON.stringify([mail.messageId,mail.fingerprint])});
 }
 return findings.sort((a,b)=>b.priority-a.priority); // Native records arrive newest first.
}

/** Factual projection only. No provider calls, inferred deadlines or hidden source reads. */
export function briefItems(input:BriefContext,now=Date.now()):BriefItem[] {
 const items:BriefItem[]=[];
 const add=(id:string,kind:BriefItem['kind'],value:string,priority:number,revision:unknown=value)=>
  items.push({id,kind,text:text(value),priority,revision:JSON.stringify(revision)});
 if(input.projectsError) add('coverage:projects','limitation','Project records could not be refreshed. Project coverage is incomplete.',100);
 else for(const project of input.projects.filter(p=>p.status==='active'||p.status==='watching')) {
  const row=input.board.find(r=>r.project.id===project.id);
  if(row&&(row.operationalStatus==='NEEDS_YOU'||row.operationalStatus==='BLOCKED')) {
   const detail=row.operatorDecisions[0]?.text??row.nextMove??row.currentState;
   add(`project:${project.id}:decision`,'attention',`${project.name} ${row.operationalStatus==='BLOCKED'?'has a recorded blocker':'is awaiting your review'}: ${detail}`,80,[row.operationalStatus,detail]);
  }
  const changes=project.sinceSessionCommits?.filter(c=>!/^Merge\b/.test(c.subject))??[];
  if(changes.length) add(`project:${project.id}:progress`,'progress',`${changes.length>1?`${changes.length} recorded changes`:"Recorded change"} in ${project.name}: ${changes[0].subject}`,40,changes.map(c=>[c.at,c.subject]));
  if(project.nextStep?.trim()) add(`project:${project.id}:next`,'attention',`Recorded next step for ${project.name}: ${project.nextStep}`,50,project.nextStep);
  if(project.repoState==='git-pending'||project.linkedWorktrees?.some(w=>w.changedFiles>0))
   add(`project:${project.id}:working`,'attention',`${project.name} has uncommitted work available for review.`,10,[project.repoState,project.lastCommit,project.linkedWorktrees?.map(w=>[w.path,w.head,w.changedFiles])]);
 }
 const {gmail,situations}=input;
 const account=gmail?.account;
 if(!gmail) add('coverage:gmail','limitation','Gmail status could not be checked. This update cannot establish whether new email needs attention.',100);
 else if(!account?.enabled) add('coverage:gmail','limitation','Gmail is not connected. Email is outside this update’s coverage.',100);
 else {
  const fresh=account.status==='connected'&&!gmail.busy&&!account.lastError&&validTime(account.lastSuccess,now);
  if(!fresh) add('coverage:gmail','limitation',account.status==='authentication_required'
   ?'Gmail needs reconnection. Cached email does not establish what is happening now.'
   :'Gmail is not current. New correspondence may be missing from this update.',100,[account.id,account.status,account.lastError]);
  const matching=situations?.accountId===account.id;
  const understood=matching&&situations.enabled&&!situations.backgroundError
   &&gmail.analysis?.state!=='blocked'&&gmail.analysis?.state!=='unconfigured'
   &&validTime(situations.understanding?.lastSuccessAt,now,DAY)
   &&!['failed','running'].includes(situations.run?.status??'');
  if(fresh && !understood && !gmail.briefMail?.length) add('coverage:analysis','limitation',gmail.analysis?.state==='blocked'
   ?'I could not review recent mail for this briefing.'
   :'I have no current email assessment to include.',0,[account.id,gmail.analysis?.state,situations?.enabled,situations?.backgroundError]);
  if(fresh) items.push(...transactionFindings(gmail, matching ? situations : null, now));
  if(fresh&&matching) for(const candidate of situations.attention??[]) {
   const correction=candidate.operatorCorrection?.trim();
   if(!understood&&!correction) continue;
   const observation=situations.observations.find(o=>o.current&&o.threadId===candidate.threadId);
   const ref=observation?.evidenceRefs.find(r=>r.messageId===candidate.suggestion.messageId&&r.threadId===candidate.threadId&&!!r.fingerprint);
   if(!ref||!candidate.signature||!candidate.suggestion.quote?.trim()||!Number.isFinite(ref.timestamp)
    ||ref.timestamp>now+60_000||now-ref.timestamp>account.horizonDays*DAY) continue;
   if(correction) add(`mail:${account.id}:${candidate.threadId}`,'attention',`Your correction for ${candidate.subject||'this email'}: ${correction}`,85,[candidate.signature,ref.fingerprint,correction,candidate.learningRevision]);
   else add(`mail:${account.id}:${candidate.threadId}`,'recommendation',`Email recommendation: ${candidate.suggestion.title}. ${candidate.suggestion.why} Suggested next move: ${candidate.suggestion.action}`,70,[candidate.signature,ref.fingerprint,candidate.suggestion,candidate.learningRevision]);
   items[items.length-1].emailSource={accountId:account.id,threadId:candidate.threadId,signature:candidate.signature,revision:candidate.learningRevision??0,subject:(candidate.subject||'this email').slice(0,200)};
  }
 }
 if(input.memory===null) add('coverage:memory','limitation','Remembered conversation context could not be checked. It is outside this update’s coverage.',90);
 else if(input.memory?.enabled) {
  const eligible=input.memory.items.filter(item=>item.id&&item.title.trim()&&item.summary.trim()&&item.sourceMessageIds.length
   &&/^[a-f0-9]{64}$/.test(item.revision)&&validTime(item.learnedAt,now,7*DAY));
  for(const recalled of eligible) {
   // Native summaries are bounded. Preserve all sentences: clipping can hide a correction.
   items.push({id:`memory:chat:${recalled.id}`,kind:'context',priority:45,revision:JSON.stringify(recalled.revision),
    text:`Remembered from “${recalled.title}”: ${recalled.summary}`.replace(/\s+/g,' ').trim(),
    source:{conversationId:recalled.id,messageIds:recalled.sourceMessageIds}});
  }
 }
 return items;
}

/** Receipts refer to displayed items, never app launches or assumed speech success. */
export function selectBrief(items:BriefItem[],receipts:BriefReceipts,mode:BriefMode,now=Date.now()):BriefItem[] {
 const seen=new Set<string>();
 let contextSelected=false;
 return items.filter(item=>{
  if(seen.has(item.id))return false;seen.add(item.id);
  const receipt=receipts[item.id];
  return mode==='requested'||!receipt||receipt.revision!==item.revision
   ||!Number.isFinite(receipt.deliveredAt)||receipt.deliveredAt>now||(item.kind!=='context'&&!item.id.includes(':notice:')&&now-receipt.deliveredAt>=DAY);
 }).sort((a,b)=>Number(a.kind==='limitation')-Number(b.kind==='limitation')||b.priority-a.priority)
 .filter(item=>{
  if(item.kind!=='context' && !item.source)return true;
  if(contextSelected)return false;
  contextSelected=true;return true;
 }).slice(0,3);
}
