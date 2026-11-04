/** Deterministic evidence projection, not model reasoning. Never fetches mail. */
import type {BriefMail,GmailStatus} from './gmail';
import type {BriefItem} from './briefingIntelligence';
import type {SituationSnapshot} from './situations';
const DAY=86_400_000;
const compact=(s:string,n=120)=>s.replace(/\s+/g,' ').trim().slice(0,n);
const senderKey=(s:string)=>(s.match(/<([^>]+)>/)?.[1]??s).trim().toLowerCase();
const senderName=(s:string)=>compact(s.split('<')[0].replace(/^"|"$/g,''),60)||'The sender';
type State='shipped'|'out'|'delivered'|'problem'|'action'|'account';
function state(mail:BriefMail):State|null {
 const s=mail.subject;
 if(/\?|\bif\b|\bno (?:action|payment|response)\b/i.test(s))return null;
 if(/\b(?:not|isn't|hasn't|wasn't)\b/i.test(s)&&!/\b(?:could not deliver|was not delivered|has not been delivered)\b/i.test(s))return null;
 if(/\b(delivery (?:failed|exception|delayed)|could not deliver|was not delivered|has not been delivered|shipment delayed)\b/i.test(s))return 'problem';
 if(/\b(action required|payment due|payment failed|response due|deadline)\b/i.test(s)||/^(payment due|deadline):\s*\S/i.test(mail.detail??''))return 'action';
 if(/\b(?:automatic|recurring|scheduled|standing)\b/i.test(s)&&/\b(?:transfer|withdrawal|payment|instruction)\b/i.test(s)&&/\b(?:established|created|cancelled|canceled|changed)\b/i.test(s))return 'account';
 if(/\b(?:was delivered|has been delivered)\b/i.test(s))return 'delivered';
 if(/\bout for delivery\b/i.test(s))return 'out';
 if(/\b(?:has shipped|order shipped)\b/i.test(s))return 'shipped';
 // Routine receipts, invoices and confirmations remain searchable evidence,
 // but are not highlights merely because they arrived recently.
 return null;
}
function label(mail:BriefMail):string {
 const item=compact(mail.item??'',140);
 if(/\bstarter kit\b/i.test(item))return 'starter kit';
 return compact(item.split(':')[0].replace(/\([^)]*\)/g,''),70)||'order';
}
function estimate(detail:string|undefined|null,now:number):string|null {
 if(!detail||!/^\s*(?:the )?(?:estimated|expected) (?:delivery|arrival)\b/i.test(detail))return null;
 // Relative dates and unspecified years are not promoted to a verified ETA.
 const date=detail.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i)?.[0];
 if(!date)return null;
 const parsed=new Date(date);if(!Number.isFinite(parsed.getTime())||parsed.getDate()!==Number(date.match(/\d{1,2}/)?.[0]))return null;
 const today=new Date(now);today.setHours(0,0,0,0);
 if(parsed.getTime()<today.getTime())return null;
 const window=detail.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*[-–—]\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
 const day=parsed.toLocaleDateString('en-US',{month:'short',day:'numeric',...(parsed.getFullYear()!==today.getFullYear()?{year:'numeric' as const}:{})});
 return day+(window?`, ${window[1]}–${window[2]}`:'');
}
function shipmentIdentity(mail:BriefMail):string {
 const reference=mail.subject.match(/\border\s*(?:#|number\s*:?|no\.\s*)\s*([a-z0-9][a-z0-9-]{2,63})\b/i)?.[1]?.toLowerCase();
 return reference?`order:${senderKey(mail.sender)}:${reference}`:`thread:${mail.threadId}`;
}
function contradictsShipment(mail:BriefMail):boolean {
 // Retain negative evidence for reconciliation, without turning it into a claim.
 const s=mail.subject;
 return /\b(?:order|shipment|delivery)\b/i.test(s)&&(
  /\b(?:cancelled|canceled)\b/i.test(s)||
  /\b(?:not|hasn't|isn't|wasn't)\s+(?:been\s+)?(?:shipped|delivered|out for delivery)\b/i.test(s));
}
export function transactionFindings(gmail:GmailStatus,situations:SituationSnapshot|null,now:number):BriefItem[] {
 const account=gmail.account;if(!account)return [];
 const matching=situations?.accountId===account.id?situations:null;
 const corrected=new Set((matching?.attention??[]).filter(a=>a.operatorCorrection).map(a=>a.threadId));
 // `current` is native signature equality against the current thread, not a
 // frontend guess based on subject or a stale historical resolution.
 for(const resolution of matching?.learning??[]){
  if(!resolution.current||!resolution.signature?.trim())continue;
  const snoozed=resolution.action==='snoozed'&&typeof resolution.until==='number'&&Number.isFinite(resolution.until)&&resolution.until>now;
  if(['handled','dismissed'].includes(resolution.action)||snoozed)corrected.add(resolution.threadId);
 }
 const eligible=(gmail.briefMail??[]).filter(m=>m.fingerprint&&m.threadId&&m.messageId&&Number.isFinite(m.timestamp)&&m.timestamp<=now&&now-m.timestamp<=7*DAY&&!corrected.has(m.threadId));
 const contradictions=eligible.filter(contradictsShipment);
 const rows=eligible
  .map(mail=>({mail,state:state(mail)})).filter((r):r is {mail:BriefMail;state:State}=>r.state!==null)
  .sort((a,b)=>b.mail.timestamp-a.mail.timestamp||a.mail.messageId.localeCompare(b.mail.messageId));
 const groups=new Map<string,typeof rows>();
 for(const row of rows){
  // Never equate orders merely because they share a sender or product name.
  const identity=shipmentIdentity(row.mail);
  const key=row.state==='account'?`account:${row.mail.messageId}`:(row.state==='action'?'action:':'shipment:')+identity;
  const group=groups.get(key)??[];group.push(row);groups.set(key,group);
 }
 const findings:BriefItem[]=[];
 for(const group of groups.values()){
  const {mail,state:status}=group[0];
  if(['shipped','out','delivered'].includes(status)&&contradictions.some(other=>other.timestamp>=mail.timestamp&&(other.threadId===mail.threadId||shipmentIdentity(other)===shipmentIdentity(mail))))continue;
  if((status==='delivered'||status==='out')&&now-mail.timestamp>2*DAY)continue;
  const name=senderName(mail.sender),product=label(mail);
  const conflict=group.some(r=>r.mail.timestamp===mail.timestamp&&r.state!==status);
  let report:string,priority:number,kind:BriefItem['kind']='progress';
  if(conflict){report=`${name} sent conflicting shipment updates. Check the latest tracking details.`;priority=78;kind='attention';}
  else if(status==='problem'){report=`There is a delivery problem with your ${product} from ${name}. Check the carrier update.`;priority=79;kind='attention';}
  else if(status==='account'){
   const change=/cancelled|canceled/i.test(mail.subject)?'cancelled':/established|created/i.test(mail.subject)?'created':'changed';
   report=`${name} reports a recurring account instruction was ${change}. Check whether you recognize the change.`;priority=78;kind='attention';
  } else if(status==='action'){
   const reason=/payment failed/i.test(mail.subject)?'reported a failed payment':/payment due/i.test(mail.subject+' '+mail.detail)?'flagged a payment due':/deadline|response due/i.test(mail.subject+' '+mail.detail)?'flagged a deadline':'requested action';
   report=`${name} ${reason}. Review the latest request and whether you have already handled it.`;priority=77;kind='attention';
  } else if(status==='delivered'){report=`${name} reports your ${product} was delivered.`;priority=55;}
  else if(status==='out'){report=`${name} reports your ${product} is out for delivery.`;priority=57;}
  else {report=`Your ${product} from ${name} has shipped.`;priority=56;}
  const eta=estimate(mail.detail,now);
  if(eta&&!conflict&&(status==='shipped'||status==='out'))report+=` Estimated arrival: ${eta}.`;
  const contributing=conflict?group.filter(r=>r.mail.timestamp===mail.timestamp):[group[0]];
  findings.push({id:`mail:${account.id}:notice:${mail.threadId}`+(['account','action'].includes(status)?`:${status}:${mail.messageId}`:''),kind,priority,text:report,
   revision:JSON.stringify(contributing.map(r=>[r.mail.messageId,r.mail.fingerprint]))});
 }
 return findings.sort((a,b)=>b.priority-a.priority);
}
