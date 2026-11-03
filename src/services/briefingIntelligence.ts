import type { TrackedProject } from '../types';
import type { ProjectCommandState } from './projectCommandBoard';
import type { GmailStatus } from './gmail';
import type { SituationSnapshot } from './situations';

export interface BriefItem { id:string; revision:string; text:string; priority:number; kind:'limitation'|'attention'|'progress'|'recommendation' }
export interface Receipt { revision:string; deliveredAt:number }
export type BriefReceipts=Record<string,Receipt>;
export type BriefMode='opening'|'requested';
export interface BriefContext {
 projects:TrackedProject[]; board:ProjectCommandState[]; projectsError:string|null;
 gmail:GmailStatus|null; situations:SituationSnapshot|null;
}
const DAY=86_400_000;
const FRESH=15*60_000;
const text=(value:string,limit=260)=>value.replace(/\s+/g,' ').trim().slice(0,limit);
const validTime=(value:string|null|undefined,now:number,maxAge=FRESH)=>{
 const at=Date.parse(value??''); return Number.isFinite(at)&&at<=now+60_000&&now-at<=maxAge;
};

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
  if(changes.length) add(`project:${project.id}:progress`,'progress',`Recorded change in ${project.name}: ${changes[0].subject}`,40,changes.map(c=>[c.at,c.subject]));
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
  if(!understood) add('coverage:analysis','limitation',gmail.analysis?.state==='blocked'
   ?'Email analysis is blocked by its provider safeguards. This is a factual update, not a fresh analysis of your correspondence.'
   :'Email understanding is paused, unavailable or not current. No fresh email recommendations are being claimed.',95,[account.id,gmail.analysis?.state,situations?.enabled,situations?.backgroundError]);
  if(fresh&&understood) for(const candidate of situations.attention??[]) {
   const observation=situations.observations.find(o=>o.current&&o.threadId===candidate.threadId);
   const ref=observation?.evidenceRefs.find(r=>r.messageId===candidate.suggestion.messageId&&r.threadId===candidate.threadId&&!!r.fingerprint);
   if(!ref||!candidate.signature||!candidate.suggestion.quote?.trim()||!Number.isFinite(ref.timestamp)
    ||ref.timestamp>now+60_000||now-ref.timestamp>account.horizonDays*DAY) continue;
   add(`mail:${account.id}:${candidate.threadId}`,'recommendation',`Email recommendation: ${candidate.suggestion.title}. ${candidate.suggestion.why} Suggested next move: ${candidate.suggestion.action}`,70,[candidate.signature,ref.fingerprint,candidate.suggestion]);
  }
 }
 return items;
}

/** Receipts refer to displayed items, never app launches or assumed speech success. */
export function selectBrief(items:BriefItem[],receipts:BriefReceipts,mode:BriefMode,now=Date.now()):BriefItem[] {
 const seen=new Set<string>();
 return items.filter(item=>{
  if(seen.has(item.id))return false;seen.add(item.id);
  const receipt=receipts[item.id];
  return mode==='requested'||!receipt||receipt.revision!==item.revision
   ||!Number.isFinite(receipt.deliveredAt)||receipt.deliveredAt>now||now-receipt.deliveredAt>=DAY;
 }).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id)).slice(0,3);
}
