import {useEffect,useState,useRef} from 'react';
import {gmailNative,gmailStatus,gmailHealth,type GmailStatus} from '../../services/gmail';
import {situationsClient,emailAttentionDecide,emailLearningChange,isUnchangedSnapshot,type SituationSnapshot,type EmailAttention,type EmailLearningRequest} from '../../services/situations';
import {formatWhen} from '../../services/time';
import './emailAttentionBrief.css';
import {EmailCorrectionForm,EmailLearningReview} from './EmailLearningReview';
const api={native:gmailNative,status:gmailStatus,snapshot:()=>situationsClient.snapshot(),decide:emailAttentionDecide,learn:emailLearningChange};
type Client=Omit<typeof api,'learn'>&{learn?:typeof emailLearningChange};
export function EmailAttentionBrief({client=api}:{client?:Client}){
 const generation=useRef(0),alive=useRef(true),mutation=useRef(false);
 const [correcting,setCorrecting]=useState<{item:EmailAttention;revision:number;accountId:string}|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;generation.current++;};},[]);
 const [snapshot,setSnapshot]=useState<SituationSnapshot|null>(null),[health,setHealth]=useState<GmailStatus|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(false),[selected,setSelected]=useState<string|null>(null);
 useEffect(()=>{if(!client.native())return;let active=true;let running=false;
 const refresh=async()=>{if(running||mutation.current||document.hidden)return;running=true;const version=generation.current;try{const status=await client.status();if(!active||version!==generation.current)return;setHealth(status);setCorrecting(previous=>previous?.accountId===status.account?.id?previous:null);setSnapshot(previous=>previous?.accountId===status.account?.id?previous:null);if(!status.account?.enabled){setSnapshot(null);return;}const s=await client.snapshot();if(active&&version===generation.current&&!isUnchangedSnapshot(s)){setSnapshot(s);setError('');}}catch{if(active&&version===generation.current){setError('Email suggestions could not be refreshed. Showing the last checked source; unsaved correction text is kept.');}}finally{running=false;}};
 void refresh();const timer=window.setInterval(refresh,15000);return()=>{active=false;window.clearInterval(timer)};
 },[client]);
 if(!client.native()||(!health?.account?.enabled&&!error))return null;
 const state=gmailHealth(health);const blocked=state.state!=='connected';
 const failure=snapshot?.backgroundError||snapshot?.run?.error;
 const analysisStatus=failure?(failure.includes('OPENAI_API_KEY')?'Email analysis needs a configured model.':failure.includes('local_email')?'Local email analysis is not ready.':'Email analysis could not complete.'):snapshot?.enabled===false?'Background email analysis is paused.':null;
 const items=blocked||snapshot?.accountId!==health?.account?.id?[]:snapshot?.attention??[];
 async function change(request:EmailLearningRequest):Promise<boolean> {
  if(!client.learn||mutation.current||snapshot?.accountId!==request.accountId)return false;
  mutation.current=true;const version=++generation.current;setPending(true);setError('');
  try {
   await client.learn(request);
   const status=await client.status();
   if(!alive.current||version!==generation.current)return false;
   setHealth(status);
   if(status.account?.id!==request.accountId||!status.account.enabled){setSnapshot(null);setCorrecting(null);return false;}
   const next=await client.snapshot();
   if(!alive.current||version!==generation.current)return false;
   if(isUnchangedSnapshot(next)||next.accountId!==request.accountId){setSnapshot(null);setError('Feedback was saved, but current email coverage could not be refreshed.');return false;}
   setSnapshot(next);return true;
  } catch {
   if(alive.current&&version===generation.current)setError('Feedback could not be saved or refreshed. Your text is kept; review the latest source before retrying.');
   return false;
  } finally {mutation.current=false;if(alive.current)setPending(false);}
 }
 async function decide(item:EmailAttention,action:'dismissed'|'handled'|'snoozed') {
  if(!snapshot||mutation.current)return;
  if(client.learn) {
   const revision=snapshot.learning?.find(record=>record.threadId===item.threadId)?.revision??0;
   if(await change({accountId:snapshot.accountId,threadId:item.threadId,signature:item.signature,expectedRevision:revision,action}))setSelected(null);
   return;
  }
  // Compatibility for older injected clients; production uses the revisioned path.
  mutation.current=true;const version=++generation.current;setPending(true);setError('');
  try{await client.decide(snapshot.accountId,item.threadId,item.signature,action);if(alive.current&&version===generation.current){setSnapshot(current=>current?.accountId!==snapshot.accountId?current:{...current,attention:(current.attention??[]).filter(s=>s.threadId!==item.threadId||s.signature!==item.signature)});setSelected(null);}}
  catch{if(alive.current)setError('The source may have changed. Wait for a refresh and review again.');}
  finally{mutation.current=false;if(alive.current)setPending(false);}
 }
 return <section className="email-attention" aria-label="Email suggestions"><h4>Needs your attention</h4>
 {blocked&&<p role="status">{state.detail||state.label} Suggestions will appear after a successful sync.</p>}
 {!blocked&&analysisStatus&&<p role="status">{analysisStatus} Any suggestions below come from earlier analysis.</p>}
 {!blocked&&!analysisStatus&&items.length===0&&<p>No suggestions to show from the available records. This does not mean your inbox has been fully reviewed.</p>}
 {error&&<p role="alert">{error}</p>}
 {items.slice(0,3).map(item=><article key={item.threadId} className="email-attention-card">
 <strong>{item.operatorCorrection?'Your correction':item.suggestion.title}</strong>{item.operatorCorrection?<p className="email-attention-action">{item.operatorCorrection}</p>:<><p>{item.suggestion.why}</p><p className="email-attention-action">{item.suggestion.action}</p></>}
 {!item.operatorCorrection&&item.suggestion.deadline&&<p>Source date: {item.suggestion.deadline}</p>}
 <small>Email · {formatWhen(item.timestamp)} · {item.operatorCorrection?'Your source-scoped context':'Suggested'}</small>
 <div className="email-attention-actions"><button type="button" aria-expanded={selected===item.threadId} onClick={()=>setSelected(selected===item.threadId?null:item.threadId)}>Review source</button>{client.learn&&<button type="button" disabled={pending} onClick={()=>setCorrecting({item,revision:snapshot?.learning?.find(record=>record.threadId===item.threadId)?.revision??0,accountId:snapshot!.accountId})}>Correct suggestion</button>}<button type="button" disabled={pending} onClick={()=>void decide(item,'snoozed')}>Snooze 1 day</button><button type="button" disabled={pending} onClick={()=>void decide(item,'handled')}>Handled</button><button type="button" disabled={pending} onClick={()=>void decide(item,'dismissed')}>Dismiss</button></div>
 {selected===item.threadId&&<div className="email-attention-source"><strong>{item.subject||'Email source'}</strong><blockquote>{item.suggestion.quote}</blockquote><small>This is an email claim, not verification that the sender or request is legitimate.</small></div>}
 </article>)}
 {correcting&&<EmailCorrectionForm key={`${correcting.accountId}:${correcting.revision}`} initial={correcting.item.operatorCorrection} pending={pending} onCancel={()=>setCorrecting(null)} onSave={async text=>{const ok=await change({accountId:correcting.accountId,threadId:correcting.item.threadId,signature:correcting.item.signature,expectedRevision:correcting.revision,action:'corrected',text});if(ok)setCorrecting(null);return ok;}}/>}
 {items.length>3&&<small>{items.length-3} more suggestions will appear as you review these.</small>}
 {client.learn&&snapshot&&snapshot.accountId===health?.account?.id&&<EmailLearningReview key={snapshot.accountId} accountId={snapshot.accountId} records={snapshot.learning??[]} pending={pending} onChange={change}/>}
 </section>;
}
