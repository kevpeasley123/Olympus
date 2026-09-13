import {useEffect,useState} from "react";
import {gmailNative,gmailStatus,gmailThread,type GmailStatus,type MailMessage} from "../../services/gmail";
/** Read-only generated candidates never enter task/approval state. */
export function GmailAttention(){
 const [state,setState]=useState<GmailStatus|null>(null),[source,setSource]=useState<MailMessage[]>([]),[error,setError]=useState("");
 useEffect(()=>{if(!gmailNative())return;let live=true;const refresh=()=>gmailStatus().then(s=>{if(live){setState(s);if(!s.account?.enabled)setSource([])}}).catch(()=>{if(live)setError("Mail attention is unavailable. Check Gmail in Preferences.")});void refresh();const timer=window.setInterval(refresh,30000);return()=>{live=false;window.clearInterval(timer)}},[]);
 if(!state?.account?.enabled)return error?<p className="section-copy">{error}</p>:null;
 const candidates=state.candidates.slice(0,5);
 if(!candidates.length)return null;
 return <details className="gmail-settings"><summary>Mail attention · {candidates.length} generated candidates</summary><p>Possible relevance or response needs, not approved tasks or commitments. Last sync: {state.account.lastSuccess?new Date(state.account.lastSuccess).toLocaleString():"not yet"} · {state.account.status.replace(/_/g," ")}.</p>
 {candidates.map(c=><button type="button" className="gmail-result" key={`${c.messageId}-${c.kind}`} onClick={()=>void gmailThread(c.threadId).then(setSource).catch(()=>setError("Cached source unavailable. Check Gmail in Preferences."))}><span>{c.text}</span><small>{c.sender} · {c.subject} · Gmail {c.messageId} · {new Date(c.timestamp).toLocaleString()}</small></button>)}
 {error&&<p role="alert">{error}</p>}{source.length>0&&<details open><summary>Cached source thread · in-scope subset</summary>{source.map(m=><article key={m.id} className="gmail-thread-message"><strong>{m.sender} · {m.subject}</strong><p>Gmail {m.id} · {new Date(m.internalDate).toLocaleString()}</p><pre>{m.canonicalText||"Body unavailable"}</pre></article>)}</details>}
 </details>
}
