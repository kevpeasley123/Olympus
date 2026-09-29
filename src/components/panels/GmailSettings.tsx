import { useEffect, useRef, useState } from "react";
import { gmailRemoveCache, gmailAction, gmailCacheCounts, gmailError, gmailHorizon, gmailNative, gmailSearch, gmailStateLabel, gmailStatus, gmailThread, gmailSettingsRequestPending, clearGmailSettingsRequest, countOf, type GmailCacheCounts, type GmailStatus, type MailExcerpt, type MailMessage } from "../../services/gmail";
import { formatWhen } from "../../services/time";
import { forgetCommsAccount } from "../../state/viewState";
import "./communications.css";
export interface GmailClient { native:()=>boolean; status:typeof gmailStatus; action:typeof gmailAction; horizon:typeof gmailHorizon; search:typeof gmailSearch; thread:typeof gmailThread; removeCache:typeof gmailRemoveCache; counts?:typeof gmailCacheCounts }
const client:GmailClient={native:gmailNative,status:gmailStatus,action:gmailAction,horizon:gmailHorizon,search:gmailSearch,thread:gmailThread,removeCache:gmailRemoveCache,counts:gmailCacheCounts};
const date=(value:string|null|undefined)=>value?formatWhen(value):"Not yet";
const RANGES=[7,30,90,180,365];

/** "Deletes 1,842 messages, 3 situations, 12 updates, 2 drafts and imported document context (58 sources)." */
export function removalSentence(c:GmailCacheCounts):string{
 const parts=[countOf(c.messages,"message"),countOf(c.situations,"situation"),countOf(c.updates,"update"),countOf(c.drafts,"draft")];
 const context=c.documentContexts?`imported document context (${countOf(c.documentSources,"source")})`:"no imported document context";
 return `Deletes ${parts.join(", ")} and ${context}.`;
}

export function GmailSettings({api=client}:{api?:GmailClient}) {
 const [state,setState]=useState<GmailStatus|null>(null),[error,setError]=useState(""),[pending,setPending]=useState(false),[query,setQuery]=useState(""),[results,setResults]=useState<MailExcerpt[]>([]),[searched,setSearched]=useState(false),[thread,setThread]=useState<MailMessage[]>([]);
 // Communications' settings link asks for this section already open.
 const [requested]=useState(gmailSettingsRequestPending);
 const [expanded,setExpanded]=useState(requested);
 const [removal,setRemoval]=useState<null|{counts:GmailCacheCounts|null;error?:string}>(null);
 const [narrow,setNarrow]=useState<null|{days:number;messages:number|null;error?:string}>(null);
 const root=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{clearGmailSettingsRequest();if(requested){root.current?.scrollIntoView({block:"start"});root.current?.querySelector<HTMLElement>("summary")?.focus()}},[requested]);
 // Read once for the summary line; the 2 s poll runs only while the section is open.
 useEffect(()=>{if(!api.native())return;let active=true;const refresh=()=>api.status().then(s=>{if(active)setState(s)}).catch(e=>{if(active)setError(gmailError(e))});void refresh();const timer=expanded?window.setInterval(refresh,2000):undefined;return()=>{active=false;window.clearInterval(timer)}},[api,expanded]);
 async function run(action:()=>Promise<unknown>){setPending(true);setError("");try{await action();setState(await api.status())}catch(e){setError(gmailError(e))}finally{setPending(false)}}
 const enabled=Boolean(state?.account?.enabled),busy=pending||Boolean(state?.busy);
 const horizon=state?.account?.horizonDays??90;

 async function askRemoval(){
  setRemoval({counts:null});
  if(!api.counts){setRemoval({counts:null,error:"Counts are not available in this build."});return}
  try{setRemoval({counts:await api.counts()})}catch(e){setRemoval({counts:null,error:gmailError(e)})}
 }
 async function chooseRange(days:number){
  if(days>=horizon){void run(async()=>{await api.horizon(days);await api.action("sync")});return}
  // Narrowing prunes on the next sync; ask first, with the real count where it can be read.
  setNarrow({days,messages:null});
  if(!api.counts)return;
  try{const counts=await api.counts(days);setNarrow({days,messages:counts.olderThan?.messages??null})}catch(e){setNarrow({days,messages:null,error:gmailError(e)})}
 }

 return <details ref={root} className="gmail-settings" data-testid="gmail-settings" open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)}><summary>Gmail · read-only source</summary>
 {!api.native()?<p>Connect Gmail in the Olympus desktop app. This browser preview cannot access native credentials or your mailbox.</p>:<>
 <p role="status">{gmailStateLabel(state)}{state?.account?.email&&<> — {state.account.email}</>}</p>
 <p className="section-copy">Connect opens your system browser and requests read-only access to message bodies in Gmail. Relevant cached excerpts are sent to your reasoning provider for communication questions and analysis. Background situation understanding also analyzes changed correspondence, your situation updates and matching Research context using OpenAI. Pause it in Communications at any time. Olympus cannot send or change mail.</p>
 {state&&!state.configured&&<p>Save a Google <strong>Desktop app</strong> OAuth client JSON as <code className="gmail-config-path">{state.configPath}</code>. Setup: <code>docs/GMAIL.md</code>. Do not paste credentials into chat.</p>}
 <div className="gmail-controls">
 <button type="button" className="ghost-action" disabled={busy||!state?.configured} onClick={()=>void run(()=>api.action("connect"))}>{enabled?"Reconnect Gmail":"Connect Gmail"}</button>
 <button type="button" className="ghost-action" disabled={!enabled||busy||state?.account?.status==="authentication_required"} onClick={()=>void run(()=>api.action("sync"))}>Sync now</button>
 {busy&&<button type="button" className="ghost-action" onClick={()=>void api.action("cancel").catch(e=>setError(gmailError(e)))}>Cancel operation</button>}
 {enabled&&<button type="button" className="ghost-action" onClick={()=>{setResults([]);setThread([]);setRemoval(null);void run(()=>api.action("disconnect"))}}>Disconnect</button>}
 </div>
 {state?.account&&<><label className="gmail-horizon">History range <select aria-label="Gmail history range" value={narrow?.days??horizon} disabled={busy||!enabled||!!narrow} onChange={e=>void chooseRange(Number(e.target.value))}>{RANGES.map(days=><option key={days} value={days}>Recent {days} days</option>)}</select></label>
 {narrow&&<div className="gmail-confirm" role="alertdialog" aria-label="Confirm narrower history range">
  <p><strong>Narrow the history range to {narrow.days} days?</strong></p>
  <p>{narrow.messages===null?(narrow.error?`The number of affected messages could not be read (${narrow.error}).`:"Counting affected messages…"):narrow.messages===0?`No cached messages are older than ${narrow.days} days.`:`${countOf(narrow.messages,"cached message")} older than ${narrow.days} days will be removed from the cache on the next sync.`} Situations, updates and drafts are kept, but understanding will no longer read the removed mail. Widening the range later re-imports it from Gmail on a fresh sync.</p>
  <div className="gmail-confirm-actions"><button type="button" className="ghost-action" autoFocus onClick={()=>setNarrow(null)}>Keep {horizon} days</button><button type="button" className="ghost-action destructive-action" disabled={busy} onClick={()=>{const days=narrow.days;setNarrow(null);void run(async()=>{await api.horizon(days);await api.action("sync")})}}>Narrow to {narrow.days} days</button></div>
 </div>}
 <p className="section-copy">Inbox and Sent; excludes Spam and Trash. {countOf(state.cachedMessages,"cached message")} in scope. Last successful sync: {date(state.account.lastSuccess)}. Next expected: {enabled?date(state.account.nextSync):"Stopped"}.</p>
 {state.lastRun&&<p className="section-copy">Latest run: {state.lastRun.status}; {state.lastRun.mode.replace(/_/g," ")}; {countOf(state.lastRun.changes,"change")} processed.</p>}</>}
 {(error||state?.account?.lastError)&&<p role="alert">{error||gmailError(state?.account?.lastError)}</p>}
 {state?.account&&!enabled&&<div>{removal?<div className="gmail-confirm gmail-remove-confirm" role="alertdialog" aria-label="Confirm cache removal">
  <p><strong>{removal.counts?removalSentence(removal.counts):removal.error?"Remove this account's cached mailbox and everything derived from it?":"Counting what would be removed…"}</strong></p>
  {removal.error&&<p>The counts could not be read ({removal.error}); removal still deletes every item listed below.</p>}
  <p>Also removes the search index, generated candidates, sync receipts{removal.counts?` and ${countOf(removal.counts.analysisRuns,"analysis run")}`:" and analysis history"}. Previously cited chat excerpts remain; clear conversation separately.</p>
  <p className="gmail-irreversible"><strong>Cannot be undone.</strong> Mail can be imported again by reconnecting. Imported document context must be re-imported with <code>scripts/import-situation-context.py</code> while Olympus is stopped.</p>
  <div className="gmail-confirm-actions"><button className="ghost-action" type="button" autoFocus onClick={()=>setRemoval(null)}>Keep cache</button><button className="ghost-action destructive-action" type="button" disabled={busy||(!removal.counts&&!removal.error)} onClick={()=>{const accountId=state?.account?.id;void run(async()=>{await api.removeCache();if(accountId)forgetCommsAccount(accountId);setRemoval(null);setResults([]);setThread([])})}}>Confirm cache removal</button></div>
 </div>:<button className="ghost-action" type="button" disabled={busy} onClick={()=>void askRemoval()}>Remove cached mailbox</button>}</div>}
 <p className="section-copy">Disconnect stops sync, asks Google to revoke this authorization and removes the local credential. Revocation is best effort; confirm it in your Google Account’s third-party connections. Cached mail, analysis history and previously cited answers remain. Sync runs only while Olympus is open.</p>
 {enabled&&<details><summary>Search cached mail and review candidates</summary>
 <form className="gmail-controls" onSubmit={e=>{e.preventDefault();setThread([]);void run(async()=>{setResults(await api.search(query));setSearched(true)})}}><input aria-label="Search cached Gmail" placeholder="Person, subject, or topic" value={query} maxLength={500} onChange={e=>setQuery(e.target.value)}/><button className="ghost-action" disabled={busy} type="submit">Search</button></form>
 {searched&&results.length===0&&<p>No matches in the current local scope. This does not mean no email exists.</p>}
 {results.map(r=><button className="gmail-result" type="button" key={r.messageId} onClick={()=>void run(async()=>setThread(await api.thread(r.threadId)))}><strong>{r.subject||"(No subject)"}</strong><small>{r.sender} · {formatWhen(r.timestamp)}</small><span>{r.excerpt.slice(0,240)}</span></button>)}
 {state?.candidates.length!==0&&<h4>Generated candidates · need review</h4>}
 {state?.candidates.map(c=><button className="gmail-result" type="button" key={`${c.messageId}-${c.kind}`} onClick={()=>void run(async()=>setThread(await api.thread(c.threadId)))}><span>{c.text}</span><small>{c.sender} · {c.subject}</small></button>)}
 {thread.length>0&&<section aria-label="Cached Gmail thread"><h4>Cached thread · up to 100 in-scope messages</h4>{thread.map(m=><article className="gmail-thread-message" key={m.id}><strong>{m.subject}</strong><p>{m.sender} → {m.recipients}<br/>{formatWhen(m.internalDate)}</p><pre>{m.canonicalText||"Body not available in this snapshot."}</pre><small>{m.bodyStatus.replace(/_/g," ")}</small>{m.attachments.map((a,i)=><p key={i}>Attachment metadata: {a.filename||"Unnamed MIME part"} · {a.mimeType} · {a.size.toLocaleString("en-US")} bytes. Content not downloaded.</p>)}<details><summary>Inspect source</summary><p>Gmail {m.id} · thread {m.threadId}</p></details></article>)}</section>}
 </details>}
 </>}
 </details>
}
