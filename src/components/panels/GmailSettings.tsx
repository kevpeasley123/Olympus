import { useEffect, useState } from "react";
import { gmailRemoveCache, gmailAction, gmailError, gmailHorizon, gmailNative, gmailSearch, gmailStateLabel, gmailStatus, gmailThread, type GmailStatus, type MailExcerpt, type MailMessage } from "../../services/gmail";
export interface GmailClient { native:()=>boolean; status:typeof gmailStatus; action:typeof gmailAction; horizon:typeof gmailHorizon; search:typeof gmailSearch; thread:typeof gmailThread; removeCache:typeof gmailRemoveCache }
const client:GmailClient={native:gmailNative,status:gmailStatus,action:gmailAction,horizon:gmailHorizon,search:gmailSearch,thread:gmailThread,removeCache:gmailRemoveCache};
const date=(value:string|null|undefined)=>value?new Date(value).toLocaleString():"Not yet";
export function GmailSettings({api=client}:{api?:GmailClient}) {
 const [state,setState]=useState<GmailStatus|null>(null),[error,setError]=useState(""),[pending,setPending]=useState(false),[confirmRemove,setConfirmRemove]=useState(false),[query,setQuery]=useState(""),[results,setResults]=useState<MailExcerpt[]>([]),[searched,setSearched]=useState(false),[thread,setThread]=useState<MailMessage[]>([]);
 useEffect(()=>{if(!api.native())return;let active=true;const refresh=()=>api.status().then(s=>{if(active)setState(s)}).catch(e=>{if(active)setError(gmailError(e))});void refresh();const timer=window.setInterval(refresh,2000);return()=>{active=false;window.clearInterval(timer)}},[api]);
 async function run(action:()=>Promise<unknown>){setPending(true);setError("");try{await action();setState(await api.status())}catch(e){setError(gmailError(e))}finally{setPending(false)}}
 const enabled=Boolean(state?.account?.enabled),busy=pending||Boolean(state?.busy);
 return <details className="gmail-settings" data-testid="gmail-settings"><summary>Gmail · read-only source</summary>
 {!api.native()?<p>Connect Gmail in the Olympus desktop app. This browser preview cannot access native credentials or your mailbox.</p>:<>
 <p role="status">{gmailStateLabel(state)}{state?.account?.email&&<> — {state.account.email}</>}</p>
 <p className="section-copy">Connect opens your system browser and requests read-only access to message bodies in Gmail. Relevant cached excerpts are sent to your reasoning provider for communication questions and analysis. Background situation understanding also analyzes changed correspondence, your situation updates and matching Research context using OpenAI. Pause it in Communications at any time. Olympus cannot send or change mail.</p>
 {state&&!state.configured&&<p>Save a Google <strong>Desktop app</strong> OAuth client JSON as <code className="gmail-config-path">{state.configPath}</code>. Setup: <code>docs/GMAIL.md</code>. Do not paste credentials into chat.</p>}
 <div className="gmail-controls">
 <button type="button" className="ghost-action" disabled={busy||!state?.configured} onClick={()=>void run(()=>api.action("connect"))}>{enabled?"Reconnect Gmail":"Connect Gmail"}</button>
 <button type="button" className="ghost-action" disabled={!enabled||busy} onClick={()=>void run(()=>api.action("sync"))}>Sync now</button>
 {busy&&<button type="button" className="ghost-action" onClick={()=>void api.action("cancel").catch(e=>setError(gmailError(e)))}>Cancel operation</button>}
 {state?.account&&<button type="button" className="ghost-action" onClick={()=>{setResults([]);setThread([]);void run(()=>api.action("disconnect"))}}>Disconnect</button>}
 </div>
 {state?.account&&<><label className="gmail-horizon">History range <select aria-label="Gmail history range" value={state.account.horizonDays} disabled={busy||!enabled} onChange={e=>void run(async()=>{await api.horizon(Number(e.target.value));await api.action("sync")})}>{[7,30,90,180,365].map(days=><option key={days} value={days}>Recent {days} days</option>)}</select></label>
 <p className="section-copy">Inbox and Sent; excludes Spam and Trash. {state.cachedMessages} cached messages in scope. Last successful sync: {date(state.account.lastSuccess)}. Next expected: {enabled?date(state.account.nextSync):"Stopped"}.</p>
 {state.lastRun&&<p className="section-copy">Latest run: {state.lastRun.status}; {state.lastRun.mode.replace(/_/g," ")}; {state.lastRun.changes} changes processed.</p>}</>}
 {(error||state?.account?.lastError)&&<p role="alert">{error||gmailError(state?.account?.lastError)}</p>}
 {state?.account&&!enabled&&<div>{confirmRemove?<><p>Remove this account's cached messages, search index, candidates, and sync receipts? Previously cited chat excerpts and local analysis history remain; clear conversation separately.</p><button className="ghost-action" type="button" disabled={busy} onClick={()=>void run(async()=>{await api.removeCache();setConfirmRemove(false);setResults([]);setThread([])})}>Confirm cache removal</button><button className="ghost-action" type="button" onClick={()=>setConfirmRemove(false)}>Keep cache</button></>:<button className="ghost-action" type="button" disabled={busy} onClick={()=>setConfirmRemove(true)}>Remove cached mailbox</button>}</div>}
 <p className="section-copy">Disconnect stops sync and removes the local credential. Cached mail, analysis history and previously cited answers remain. It does not revoke Google consent; revoke separately in your Google Account’s third-party connections. Sync runs only while Olympus is open.</p>
 {enabled&&<details><summary>Search cached mail and review candidates</summary>
 <form className="gmail-controls" onSubmit={e=>{e.preventDefault();setThread([]);void run(async()=>{setResults(await api.search(query));setSearched(true)})}}><input aria-label="Search cached Gmail" placeholder="Person, subject, or topic" value={query} maxLength={500} onChange={e=>setQuery(e.target.value)}/><button className="ghost-action" disabled={busy} type="submit">Search</button></form>
 {searched&&results.length===0&&<p>No matches in the current local scope. This does not mean no email exists.</p>}
 {results.map(r=><button className="gmail-result" type="button" key={r.messageId} onClick={()=>void run(async()=>setThread(await api.thread(r.threadId)))}><strong>{r.subject||"(No subject)"}</strong><small>{r.sender} · {new Date(r.timestamp).toLocaleString()}</small><span>{r.excerpt.slice(0,240)}</span></button>)}
 {state?.candidates.length!==0&&<h4>Generated candidates · need review</h4>}
 {state?.candidates.map(c=><button className="gmail-result" type="button" key={`${c.messageId}-${c.kind}`} onClick={()=>void run(async()=>setThread(await api.thread(c.threadId)))}><span>{c.text}</span><small>{c.sender} · {c.subject} · Gmail {c.messageId}</small></button>)}
 {thread.length>0&&<section aria-label="Cached Gmail thread"><h4>Cached thread · up to 100 in-scope messages</h4>{thread.map(m=><article className="gmail-thread-message" key={m.id}><strong>{m.subject}</strong><p>{m.sender} → {m.recipients}<br/>{new Date(m.internalDate).toLocaleString()} · Gmail {m.id}</p><pre>{m.canonicalText||"Body not available in this snapshot."}</pre><small>{m.bodyStatus.replace(/_/g," ")}</small>{m.attachments.map((a,i)=><p key={i}>Attachment metadata: {a.filename||"Unnamed MIME part"} · {a.mimeType} · {a.size} bytes. Content not downloaded.</p>)}</article>)}</section>}
 </details>}
 </>}
 </details>
}
