import {useEffect,useState,useRef} from 'react';
import {gmailNative,gmailStatus,gmailHealth,type GmailStatus} from '../../services/gmail';
import {situationsClient,emailAttentionDecide,isUnchangedSnapshot,type SituationSnapshot,type EmailAttention} from '../../services/situations';
import {formatWhen} from '../../services/time';
import './emailAttentionBrief.css';
const api={native:gmailNative,status:gmailStatus,snapshot:()=>situationsClient.snapshot(),decide:emailAttentionDecide};
export function EmailAttentionBrief({client=api}:{client?:typeof api}){
 const generation=useRef(0);
 const [snapshot,setSnapshot]=useState<SituationSnapshot|null>(null),[health,setHealth]=useState<GmailStatus|null>(null),[error,setError]=useState(''),[pending,setPending]=useState(false),[selected,setSelected]=useState<string|null>(null);
 useEffect(()=>{if(!client.native())return;let active=true;let running=false;
 const refresh=async()=>{if(running||document.hidden)return;running=true;const version=generation.current;try{const status=await client.status();if(!active||version!==generation.current)return;setHealth(status);setSnapshot(previous=>previous?.accountId===status.account?.id?previous:null);if(!status.account?.enabled){setSnapshot(null);return;}const s=await client.snapshot();if(active&&version===generation.current&&!isUnchangedSnapshot(s)){setSnapshot(s);setError('');}}catch{if(active&&version===generation.current){setSnapshot(null);setError('Email suggestions are unavailable.');}}finally{running=false;}};
 void refresh();const timer=window.setInterval(refresh,15000);return()=>{active=false;window.clearInterval(timer)};
 },[client]);
 if(!client.native()||(!health?.account?.enabled&&!error))return null;
 const state=gmailHealth(health);const blocked=state.state!=='connected';
 const failure=snapshot?.backgroundError||snapshot?.run?.error;
 const analysisStatus=failure?(failure.includes('OPENAI_API_KEY')?'Email analysis needs a configured model.':failure.includes('local_email')?'Local email analysis is not ready.':'Email analysis could not complete.'):snapshot?.enabled===false?'Background email analysis is paused.':null;
 const items=blocked||snapshot?.accountId!==health?.account?.id?[]:snapshot?.attention??[];
 async function decide(item:EmailAttention,action:'dismissed'|'handled'|'snoozed'){
  if(!snapshot)return;generation.current++;setPending(true);setError('');try{await client.decide(snapshot.accountId,item.threadId,item.signature,action);setSnapshot(current=>current?.accountId!==snapshot.accountId?current:{...current,attention:(current.attention??[]).filter(s=>s.threadId!==item.threadId||s.signature!==item.signature)});setSelected(null);}catch{setError('The source may have changed. Wait for a refresh and review again.');}finally{setPending(false);}
 }
 return <section className="email-attention" aria-label="Email suggestions"><h4>Needs your attention</h4>
 {blocked&&<p role="status">{state.detail||state.label} Suggestions will appear after a successful sync.</p>}
 {!blocked&&analysisStatus&&<p role="status">{analysisStatus} Any suggestions below come from earlier analysis.</p>}
 {!blocked&&!analysisStatus&&items.length===0&&<p>No suggestions published yet. This does not mean your inbox has been fully reviewed.</p>}
 {error&&<p role="alert">{error}</p>}
 {items.slice(0,3).map(item=><article key={item.threadId} className="email-attention-card">
 <strong>{item.suggestion.title}</strong><p>{item.suggestion.why}</p><p className="email-attention-action">{item.suggestion.action}</p>
 {item.suggestion.deadline&&<p>Source date: {item.suggestion.deadline}</p>}
 <small>Email · {formatWhen(item.timestamp)} · Suggested</small>
 <div className="email-attention-actions"><button type="button" aria-expanded={selected===item.threadId} onClick={()=>setSelected(selected===item.threadId?null:item.threadId)}>Review source</button><button type="button" disabled={pending} onClick={()=>void decide(item,'snoozed')}>Snooze 1 day</button><button type="button" disabled={pending} onClick={()=>void decide(item,'handled')}>Handled</button><button type="button" disabled={pending} onClick={()=>void decide(item,'dismissed')}>Dismiss</button></div>
 {selected===item.threadId&&<div className="email-attention-source"><strong>{item.subject||'Email source'}</strong><blockquote>{item.suggestion.quote}</blockquote><small>This is an email claim, not verification that the sender or request is legitimate.</small></div>}
 </article>)}
 {items.length>3&&<small>{items.length-3} more suggestions will appear as you review these.</small>}
 </section>;
}
