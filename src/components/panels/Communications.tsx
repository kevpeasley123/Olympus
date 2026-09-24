import {SituationsWorkspace} from './SituationsWorkspace';
import type {SituationsClient} from '../../services/situations';
import {CommunicationsBrief} from './CommunicationsBrief';
import type {IntelligenceClient} from '../../services/communicationIntelligence';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Mail, RefreshCw, Settings2, X, ArrowUpRight } from 'lucide-react';
import { communicationsClient, type CommunicationsClient, type CommunicationRow, type Workspace, type Group } from '../../services/communications';
import { gmailError, gmailStateLabel, type GmailStatus, type MailMessage, type MailExcerpt } from '../../services/gmail';
const names: Record<Group,string> = { inbox:'Inbox', attention:'Attention', actions:'Responses', projects:'Projects', people:'People', search:'Search' };
const date=(n:number)=>new Date(n).toLocaleString();
const senderName=(s:string)=>s.split('<')[0].trim()||s;
export function Communications({api=communicationsClient,onSettings,intelligence,situations}:{api?:CommunicationsClient;onSettings:()=>void;intelligence?:IntelligenceClient;situations?:SituationsClient}) {
 const surface=useRef<HTMLElement>(null),[availableHeight,setAvailableHeight]=useState(window.innerHeight-180),[chatSize,setChatSize]=useState({height:0,width:480});
 useLayoutEffect(()=>{const parent=surface.current?.closest('.center-stack');if(!parent)return;const chat=parent.closest('.main-grid')?.querySelector('.right-stack');const measure=()=>{const style=getComputedStyle(parent);setAvailableHeight(Math.max(200,parent.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)));if(chat)setChatSize({height:chat.clientHeight,width:chat.clientWidth})};measure();const observer=new ResizeObserver(measure);observer.observe(parent);if(chat)observer.observe(chat);return()=>observer.disconnect()},[]);
 const [view,setView]=useState<'situations'|'mail'>('situations');
 const [status,setStatus]=useState<GmailStatus|null>(null);
 const [data,setData]=useState<Workspace|null>(null);
 const [group,setGroup]=useState<Group>('inbox');
 const [days,setDays]=useState(7);
 const [page,setPage]=useState(0);
 const [sender,setSender]=useState('');
 const [query,setQuery]=useState('');
 const [hits,setHits]=useState<MailExcerpt[]>([]);
 const [searched,setSearched]=useState(false);
 const [selected,setSelected]=useState<CommunicationRow|null>(null);
 const [thread,setThread]=useState<MailMessage[]>([]);
 const [error,setError]=useState('');
 const [syncing,setSyncing]=useState(false);
 const [loading,setLoading]=useState(false);
 const [threadLoading,setThreadLoading]=useState(false);
 const selection=useRef(0),searchVersion=useRef(0);
 const inspectorClose=useRef<HTMLButtonElement>(null),inbox=useRef<HTMLDivElement>(null);
 function close(){selection.current++;setSelected(null);setThread([]);setThreadLoading(false)}
 useEffect(()=>{
  if(!selected)return;
  const previous=document.activeElement as HTMLElement|null;
  inspectorClose.current?.focus();
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();close()}};
  window.addEventListener('keydown',escape,true);
  return()=>{window.removeEventListener('keydown',escape,true);previous?.focus()};
 },[selected]);
 useEffect(()=>{
  let live=true;
  const refresh=async()=>{
   if(!api.native())return;
   try {
    const s=await api.status();if(!live)return;setStatus(s);
    if(!s.account?.enabled){setData(null);setSelected(null);setThread([]);setHits([]);selection.current++;searchVersion.current++;return}
    setLoading(true);
    const d=await api.workspace(days,group,sender,page);
    if(live){setData(d);setError('')}
   }catch(e){if(live)setError(gmailError(e))}finally{if(live)setLoading(false)}
  };
  void refresh();const timer=setInterval(refresh,10000);
  return()=>{live=false;clearInterval(timer)};
 },[api,days,group,sender,page]);
 async function open(row:CommunicationRow){
  const version=++selection.current;setSelected(row);setThread([]);setThreadLoading(true);
  try{const messages=await api.thread(row.threadId);if(version===selection.current)setThread(messages)}
  catch(e){if(version===selection.current)setError(gmailError(e))}
  finally{if(version===selection.current)setThreadLoading(false)}
 }
 async function search(){
  const version=++searchVersion.current;setLoading(true);setHits([]);setSearched(false);
  try{const results=await api.search(query);if(version===searchVersion.current){setHits(results);setSearched(true)}}
  catch(e){if(version===searchVersion.current)setError(gmailError(e))}
  finally{if(version===searchVersion.current)setLoading(false)}
 }
 function changeGroup(g:Group,nextSender=''){setGroup(g);setPage(0);setSender(nextSender);close()}
 function changePage(p:number){setPage(p);inbox.current?.scrollIntoView({block:'start',behavior:'instant'})}
 const connected=Boolean(status?.account?.enabled),busy=syncing||Boolean(status?.busy);
 const rows:CommunicationRow[]=group==='search'?hits.map(h=>({id:h.messageId,threadId:h.threadId,timestamp:h.timestamp,fingerprint:h.fingerprint,sender:h.sender,subject:h.subject,preview:'Keyword match · open thread for source',labels:[],candidates:[]})):data?.rows??[];
 const max=Math.max(1,...(data?.activity??[]).map(d=>d.received+d.sent));
 return <section ref={surface} data-view={view} style={{'--communications-height':`${availableHeight}px`,'--situation-chat-height':`${chatSize.height+20}px`,'--situation-chat-width':`${chatSize.width}px`} as CSSProperties} className="communications" aria-label="Communications workspace">
  <header className="comms-header">
   <div className="comms-title"><Mail size={25}/><div><h2>COMMUNICATIONS</h2><p>Signals into context</p></div></div>
   {connected&&<nav className="comms-primary-tabs" aria-label="Communications view"><button aria-pressed={view==='situations'} onClick={()=>setView('situations')}>Situation maps</button><button aria-pressed={view==='mail'} onClick={()=>setView('mail')}>Browse email</button></nav>}
   <div className="comms-health"><strong>GMAIL · {api.native()?gmailStateLabel(status):'Desktop connection required'}</strong><small>Last sync: {status?.account?.lastSuccess?new Date(status.account.lastSuccess).toLocaleString():'Not yet'}</small></div>
   <button className="ghost-icon-action" aria-label="Sync Gmail" disabled={!connected||busy} onClick={()=>{setError('');setSyncing(true);void api.action('sync').then(()=>api.status()).then(setStatus).catch(e=>setError(gmailError(e))).finally(()=>setSyncing(false))}}><RefreshCw size={16}/></button>
   <button className="ghost-icon-action" aria-label="Gmail connection settings" onClick={onSettings}><Settings2 size={16}/></button>
   {(error||status?.account?.lastError)&&<details className="comms-diagnostic"><summary><span role="alert">⚠ Gmail sync issue</span> · Details</summary><div>{error||gmailError(status?.account?.lastError)} <button className="ghost-action" onClick={onSettings}>Connection &amp; history settings</button></div></details>}
  </header>

  {!connected?<div className="comms-empty"><Mail size={36}/><h3>Bring communication into context</h3><p>Connect Gmail in the desktop app to explore your locally cached, read-only communication evidence.</p><button className="ghost-action" onClick={onSettings}>Open Gmail settings</button></div>:<>
   <div className="comms-situation-host" hidden={view!=='situations'}><SituationsWorkspace api={situations} onOpen={row=>void open(row)}/></div>
   <div hidden={view!=='mail'}><details className="comms-cache-info"><summary>Cached {data?.days??7}-day view · read only</summary><p>Configured sync limit: {status?.account?.horizonDays} days. Inbox and Sent only; this cache is not a complete mailbox. View changes never change your import range. Not enough history for comparison.</p></details>
   <details><summary>Thread analysis history</summary><CommunicationsBrief key={status?.account?.id} days={days} api={intelligence} onOpen={row=>void open(row)}/></details>
   <div className="comms-workbench">
    <div className="comms-inbox" ref={inbox}>
     <div className="comms-toolbar"><nav aria-label="Communication groups">{(Object.keys(names) as Group[]).map(g=><button key={g} aria-pressed={group===g} onClick={()=>changeGroup(g)}>{names[g]}</button>)}</nav><label>View <select aria-label="Communication view range" value={days} onChange={e=>{setDays(Number(e.target.value));setPage(0);close()}}>{[7,30,90,180,365].map(n=><option key={n} disabled={n>(status?.account?.horizonDays??7)} value={n}>{n}D{n>(status?.account?.horizonDays??7)?' · outside cache limit':''}</option>)}</select></label></div>
     {group==='search'&&<form className="comms-search" onSubmit={e=>{e.preventDefault();void search()}}><input aria-label="Search cached Gmail" placeholder="Sender, subject or message words…" value={query} maxLength={500} onChange={e=>setQuery(e.target.value)}/><button className="ghost-action" disabled={!query.trim()||loading}>Search cache</button><small>Local keyword search · all entered words · up to two matching threads · synced history range</small></form>}
     {group==='people'&&<label className="comms-people">Sender <select aria-label="Filter sender" value={sender} onChange={e=>{setSender(e.target.value);setPage(0)}}><option value="">All received senders</option>{data?.people.map(p=><option key={p.sender}>{p.sender}</option>)}</select></label>}
     {['attention','actions','projects'].includes(group)&&<p className="comms-scope">Suggestions from source text; not approved actions, commitments or project assignments.</p>}
     <div className="comms-list" aria-busy={loading}>
      {rows.map(row=><button className="comms-row" key={row.id} onClick={()=>void open(row)}><span className={row.candidates.length?'comms-dot active':'comms-dot'}/><span className="comms-sender" title={row.sender}>{senderName(row.sender)}</span><span className="comms-subject">{row.subject||'(No subject)'}<small>{row.preview||'Open thread to read source'}</small></span><time title={date(row.timestamp)}>{new Date(row.timestamp).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</time><span className="comms-tags">{row.candidates.map(c=><span title={c.text} key={c.kind}>{c.kind==='possible_deadline'?'Possible deadline':c.kind==='possible_response_needed'?'Possible response':'Suggested project'}</span>)}</span></button>)}
      {!rows.length&&<p className="comms-empty">{loading?'Loading cached messages…':group==='search'&&!searched?'Search your cached communication evidence.':'No cached messages match this view.'}</p>}
     </div>
     {group!=='search'&&<footer className="comms-pagination"><small>{data?.matches??0} messages · page {page+1}</small><button className="comms-text-action" disabled={!page||loading} onClick={()=>changePage(page-1)}>Previous</button><button className="comms-text-action" disabled={loading||(page+1)*40>=(data?.matches??0)} onClick={()=>changePage(page+1)}>Next</button></footer>}
    </div>

   </div>
   <details className="comms-analytics"><summary>ANALYTICS <span>Activity &amp; source distribution</span></summary><div className="comms-analytics-content">   <div className="comms-intelligence-strip" aria-label="Communication summary">
    {[[data?.total,'Messages','Source messages in view'],[data?.attention,'Attention','Messages with generated attention candidates'],[data?.actions,'Responses','Messages with possible response candidates'],[data?.deadlines,'Deadlines','Messages with possible deadline candidates']].map(([value,label,hint])=><div key={String(label)} title={String(hint)}><strong>{value??'—'}</strong><span>{label}</span></div>)}
   </div>

    <article className="comms-card"><h3>Email activity <small>Received / sent · UTC days</small></h3><div className="comms-chart" role="img" aria-label="Daily received and sent message counts" style={{gap:(data?.activity.length??0)>31?0:3}}>{data?.activity.map(d=><div key={d.timestamp} title={`${new Date(d.timestamp).toISOString().slice(0,10)}: ${d.received} received, ${d.sent} sent`}><i style={{height:`${d.received/max*85}px`}}/><b style={{height:`${d.sent/max*85}px`}}/></div>)}</div><small>Blue: received · amber: sent. Boundary days are partial.</small><details><summary>Activity values</summary>{data?.activity.map(d=><p key={d.timestamp}>{new Date(d.timestamp).toISOString().slice(0,10)}: {d.received} received / {d.sent} sent</p>)}</details></article>
    <article className="comms-card"><h3>Source distribution</h3><p>{data?.threads??0} distinct threads</p><p>Inbox {data?.inbox??0} · Sent {data?.sent??0}</p><small>Labels may overlap. Counts describe the selected cached view.</small><h3>Sender distribution</h3>{data?.people.slice(0,10).map(p=><p key={p.sender}>{p.sender} · {p.count}</p>)}</article>
   </div></details></div>
  </>}
  {selected&&<section className="comms-inspector" aria-label="Cached thread inspector"><header><div><small>GMAIL · CACHED THREAD</small><h3>{selected.subject}</h3></div><button className="ghost-icon-action" ref={inspectorClose} aria-label="Close thread inspector" onClick={close}><X size={18}/></button></header><p className="comms-scope">In-scope subset · up to 100 messages · attachments are metadata only</p><button className="ghost-action" onClick={()=>window.dispatchEvent(new CustomEvent('olympus:focus-console',{detail:{prompt:`Summarize the cached Gmail email thread and identify possible response needs. [Gmail thread: ${selected.threadId}]`}}))}>Ask Olympus about this thread <ArrowUpRight size={14}/></button><small>Prepares a question in the console. Sending it retrieves up to four cached messages for your reasoning provider.</small><h3>Olympus findings · selected message</h3>{selected.candidates.length?selected.candidates.map(c=><p key={c.kind}>{c.text}</p>):<p>No candidate findings supplied for this selection.</p>}<h3>Source</h3>{threadLoading?<p role="status">Loading thread…</p>:thread.length===0?<p>No cached messages available.</p>:thread.map(m=><article className="comms-source" key={m.id}><strong>{m.sender}</strong><small>To: {m.recipients} · {date(m.internalDate)}</small><pre>{m.cleanText||'Body unavailable'}</pre>{m.attachments.map((a,i)=><p key={i}>Attachment: {a.filename} · {a.mimeType} · {a.size} bytes</p>)}<details><summary>Source evidence</summary><p>Gmail · message {m.id} · thread {m.threadId}</p><p>Body status: {m.bodyStatus}</p><p>Fingerprint: {'fingerprint' in m?String(m.fingerprint):selected.id===m.id?selected.fingerprint:'Unavailable'}</p></details></article>)}</section>}
 </section>;
}
