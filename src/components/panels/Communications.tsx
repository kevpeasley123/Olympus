import {SituationsWorkspace,SituationControls} from './SituationsWorkspace';
import {situationsClient,type SituationsClient} from '../../services/situations';
import {CommunicationsBrief} from './CommunicationsBrief';
import type {IntelligenceClient} from '../../services/communicationIntelligence';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Mail, RefreshCw, Settings2, X, ArrowUpRight } from 'lucide-react';
import { communicationsClient, askAboutThread, type CommunicationsClient, type CommunicationRow, type Workspace, type Group } from '../../services/communications';
import { gmailError, gmailHealth, requestGmailSettings, countOf, type GmailStatus, type MailMessage, type MailExcerpt } from '../../services/gmail';
import { useSituationSnapshot, useDocumentVisible, type SituationFeed } from './useSituationSnapshot';
import { EMPTY_COMMS_ACCOUNT, useViewEntry } from '../../state/viewState';
import { subscribeToRefresh, useNavigationTarget } from '../../services/navigation';
import { formatWhen } from '../../services/time';
import './communications.css';
const names: Record<Group,string> = { inbox:'Inbox', attention:'Attention', actions:'Responses', projects:'Projects', people:'People', search:'Search' };
const senderName=(s:string)=>s.split('<')[0].trim()||s;
export function Communications({api=communicationsClient,onSettings,intelligence,situations=situationsClient}:{api?:CommunicationsClient;onSettings:()=>void;intelligence?:IntelligenceClient;situations?:SituationsClient}) {
 const surface=useRef<HTMLElement>(null),[availableHeight,setAvailableHeight]=useState(window.innerHeight-180),[chatSize,setChatSize]=useState({height:0,width:480});
 useLayoutEffect(()=>{const parent=surface.current?.closest('.center-stack');if(!parent)return;const chat=parent.closest('.main-grid')?.querySelector('.right-stack');const measure=()=>{const style=getComputedStyle(parent);setAvailableHeight(Math.max(200,parent.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom)));if(chat)setChatSize({height:chat.clientHeight,width:chat.clientWidth})};measure();const observer=new ResizeObserver(measure);observer.observe(parent);if(chat)observer.observe(chat);return()=>observer.disconnect()},[]);
 const [status,setStatus]=useState<GmailStatus|null>(null);
 const [viewState,setViewState]=useViewEntry('comms',status?.account?.id||'__pending__',EMPTY_COMMS_ACCOUNT);
 const view=viewState.view??'situations';
 const setView=(next:'situations'|'mail')=>{if(status?.account?.id)setViewState(v=>({...v,view:next}))};
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
 const [briefOpen,setBriefOpen]=useState(false);
 const visible=useDocumentVisible();
 const selection=useRef(0),searchVersion=useRef(0);
 const inspectorClose=useRef<HTMLButtonElement>(null),inbox=useRef<HTMLDivElement>(null);
 const connectedNow=Boolean(status?.account?.enabled);
 // One situation poll serves the header's freshness line and the maps; it slows down while the maps are hidden.
 const feed=useSituationSnapshot(situations,connectedNow&&view==='situations');
 const [navTarget]=useNavigationTarget('communications');
 useEffect(()=>{if(navTarget&&status?.account?.id)setViewState(v=>({...v,view:'situations'}))},[navTarget,status?.account?.id,setViewState]);
 function close(){selection.current++;setSelected(null);setThread([]);setThreadLoading(false)}
 useEffect(()=>{
  if(!selected)return;
  const previous=document.activeElement as HTMLElement|null;
  inspectorClose.current?.focus();
  // An open modal (the write gate) owns Escape; closing the inspector under it would swallow the key.
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!document.querySelector('[aria-modal="true"]')){e.stopPropagation();close()}};
  window.addEventListener('keydown',escape,true);
  return()=>{window.removeEventListener('keydown',escape,true);previous?.focus()};
 },[selected]);
 const live=useRef(true);
 useEffect(()=>{live.current=true;return()=>{live.current=false}},[]);
 const readStatus=useCallback(async()=>{
  if(!api.native())return null;
  try{const s=await api.status();if(!live.current)return null;setStatus(s);if(!s.account?.enabled){setData(null);setSelected(null);setThread([]);setHits([]);selection.current++;searchVersion.current++}return s}
  catch(e){if(live.current)setError(gmailError(e));return null}
 },[api]);
 const readWorkspace=useCallback(async()=>{
  if(!api.native())return;
  setLoading(true);
  try{const d=await api.workspace(days,group,sender,page);if(live.current){setData(d);setError('')}}
  catch(e){if(live.current)setError(gmailError(e))}
  finally{if(live.current)setLoading(false)}
 },[api,days,group,sender,page]);
 // Status feeds the header in both views; the mail list is read only while it is on screen.
 useEffect(()=>{
  if(!visible)return;
  const tick=async()=>{const s=await readStatus();if(s?.account?.enabled&&view==='mail')await readWorkspace()};
  void tick();const timer=setInterval(()=>void tick(),10000);
  return()=>clearInterval(timer);
 },[readStatus,readWorkspace,visible,view]);
 useEffect(()=>subscribeToRefresh(()=>{void readStatus().then(s=>{if(s?.account?.enabled&&view==='mail')void readWorkspace()})}),[readStatus,readWorkspace,view]);
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
 function sync(){setError('');setSyncing(true);void api.action('sync').then(()=>readStatus()).catch(e=>setError(gmailError(e))).finally(()=>setSyncing(false))}
 function reconnect(){setError('');setSyncing(true);void api.action('connect').then(()=>readStatus()).catch(e=>setError(gmailError(e))).finally(()=>setSyncing(false))}
 const settings=()=>{requestGmailSettings();onSettings()};
 function changeGroup(g:Group,nextSender=''){setGroup(g);setPage(0);setSender(nextSender);close()}
 function changePage(p:number){setPage(p);inbox.current?.scrollIntoView({block:'start',behavior:'instant'})}
 const loadThread=useCallback((threadId:string)=>api.thread(threadId),[api]);
 const connected=connectedNow,busy=syncing||Boolean(status?.busy);
 const health=gmailHealth(api.native()?status:null);
 const rows:CommunicationRow[]=group==='search'?hits.map(h=>({id:h.messageId,threadId:h.threadId,timestamp:h.timestamp,fingerprint:h.fingerprint,sender:h.sender,subject:h.subject,preview:'Keyword match · open thread for source',labels:[],candidates:[]})):data?.rows??[];
 const max=Math.max(1,...(data?.activity??[]).map(d=>d.received+d.sent));
 // Too little height for a readable map beside the briefing (expanded chat, recovery messages): scroll the page instead.
 // Wide layouts span the chat row, so the measured height there is always the full column.
 return <section ref={surface} data-view={view} data-short-height={(availableHeight<600&&!(window.innerWidth>=1500&&window.innerHeight>=800))||undefined} style={{'--communications-height':`${availableHeight}px`,'--situation-chat-height':`${chatSize.height+20}px`,'--situation-chat-width':`${chatSize.width}px`} as CSSProperties} className="communications" aria-label="Communications workspace">
  <header className="comms-header">
   <div className="comms-title"><Mail size={25}/><div><h2>COMMUNICATIONS</h2><p>Signals into context</p></div></div>
   {connected&&<nav className="comms-primary-tabs" aria-label="Communications view"><button aria-pressed={view==='situations'} onClick={()=>setView('situations')}>Situation maps</button><button aria-pressed={view==='mail'} onClick={()=>setView('mail')}>Browse email</button></nav>}
   <div className="comms-health" role="status"><strong data-state={health.state}>Gmail · {api.native()?health.label:'Desktop connection required'}</strong>{connected&&<FreshnessLine status={status} feed={feed}/>}</div>
   {connected&&<button className="ghost-action comms-labelled-action" title={health.state==='auth'?'Reconnect Gmail first':'Fetch new mail from Gmail now'} disabled={busy||health.state==='auth'} onClick={sync}><RefreshCw size={14} aria-hidden="true"/> Sync mail</button>}
   {connected&&<SituationControls feed={feed} api={situations}/>}
   <button className="ghost-icon-action" aria-label="Gmail connection settings" title="Gmail connection settings" onClick={settings}><Settings2 size={16}/></button>
  </header>
  <CommsIssues health={health} error={error} feed={feed} busy={busy} connected={connected} onReconnect={reconnect} onSync={sync} onSettings={settings} onRetryRead={()=>{setError('');void readStatus().then(s=>{if(s?.account?.enabled&&view==='mail')void readWorkspace()})}} situations={situations}/>

  {!connected?<div className="comms-empty"><Mail size={36}/><h3>Bring communication into context</h3><p>Connect Gmail in the desktop app to explore your locally cached, read-only communication evidence.</p><button className="ghost-action" onClick={settings}>Open Gmail settings</button></div>:<>
   <div className="comms-situation-host" hidden={view!=='situations'}><SituationsWorkspace api={situations} feed={feed} loadThread={loadThread}/></div>
   <div hidden={view!=='mail'}><details className="comms-cache-info"><summary>Cached {countOf(data?.days??7,'day')} view · read only</summary><p>Configured sync limit: {countOf(status?.account?.horizonDays??7,'day')}. Inbox and Sent only; this cache is not a complete mailbox. View changes never change your import range. Not enough history for comparison.</p></details>
   <details onToggle={e=>setBriefOpen(e.currentTarget.open)}><summary>Thread triage history</summary><CommunicationsBrief key={status?.account?.id} days={days} api={intelligence} onOpen={row=>void open(row)} active={briefOpen&&view==='mail'&&visible}/></details>
   <div className="comms-workbench">
    <div className="comms-inbox" ref={inbox}>
     <div className="comms-toolbar"><nav aria-label="Communication groups">{(Object.keys(names) as Group[]).map(g=><button key={g} aria-pressed={group===g} onClick={()=>changeGroup(g)}>{names[g]}</button>)}</nav><label>View <select aria-label="Communication view range" value={days} onChange={e=>{setDays(Number(e.target.value));setPage(0);close()}}>{[7,30,90,180,365].map(n=><option key={n} disabled={n>(status?.account?.horizonDays??7)} value={n}>{n}D{n>(status?.account?.horizonDays??7)?' · outside cache limit':''}</option>)}</select></label></div>
     {group==='search'&&<form className="comms-search" onSubmit={e=>{e.preventDefault();void search()}}><input aria-label="Search cached Gmail" placeholder="Sender, subject or message words…" value={query} maxLength={500} onChange={e=>setQuery(e.target.value)}/><button className="ghost-action" disabled={!query.trim()||loading}>Search cache</button><small>Local keyword search · all entered words · up to two matching threads · synced history range</small></form>}
     {group==='people'&&<label className="comms-people">Sender <select aria-label="Filter sender" value={sender} onChange={e=>{setSender(e.target.value);setPage(0)}}><option value="">All received senders</option>{data?.people.map(p=><option key={p.sender}>{p.sender}</option>)}</select></label>}
     {['attention','actions','projects'].includes(group)&&<p className="comms-scope">Suggestions from source text; not approved actions, commitments or project assignments.</p>}
     <div className="comms-list" aria-busy={loading}>
      {rows.map(row=><button className="comms-row" key={row.id} onClick={()=>void open(row)}><span className={row.candidates.length?'comms-dot active':'comms-dot'}/><span className="comms-sender" title={row.sender}>{senderName(row.sender)}</span><span className="comms-subject">{row.subject||'(No subject)'}<small>{row.preview||'Open thread to read source'}</small></span><time title={formatWhen(row.timestamp,{withDate:true})}>{new Date(row.timestamp).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</time><span className="comms-tags">{row.candidates.map(c=><span title={c.text} key={c.kind}>{c.kind==='possible_deadline'?'Possible deadline':c.kind==='possible_response_needed'?'Possible response':'Suggested project'}</span>)}</span></button>)}
      {!rows.length&&<p className="comms-empty">{loading?'Loading cached messages…':group==='search'&&!searched?'Search your cached communication evidence.':'No cached messages match this view.'}</p>}
     </div>
     {group!=='search'&&<footer className="comms-pagination"><small>{countOf(data?.matches??0,'message')} · page {page+1}</small><button className="comms-text-action" disabled={!page||loading} onClick={()=>changePage(page-1)}>Previous</button><button className="comms-text-action" disabled={loading||(page+1)*40>=(data?.matches??0)} onClick={()=>changePage(page+1)}>Next</button></footer>}
    </div>

   </div>
   <details className="comms-analytics"><summary>ANALYTICS <span>Activity &amp; source distribution</span></summary><div className="comms-analytics-content">   <div className="comms-intelligence-strip" aria-label="Communication summary">
    {[[data?.total,'Messages','Source messages in view'],[data?.attention,'Attention','Messages with generated attention candidates'],[data?.actions,'Responses','Messages with possible response candidates'],[data?.deadlines,'Deadlines','Messages with possible deadline candidates']].map(([value,label,hint])=><div key={String(label)} title={String(hint)}><strong>{value??'—'}</strong><span>{label}</span></div>)}
   </div>

    <article className="comms-card"><h3>Email activity <small>Received / sent · UTC days</small></h3><div className="comms-chart" role="img" aria-label="Daily received and sent message counts" style={{gap:(data?.activity.length??0)>31?0:3}}>{data?.activity.map(d=><div key={d.timestamp} title={`${new Date(d.timestamp).toISOString().slice(0,10)}: ${d.received} received, ${d.sent} sent`}><i style={{height:`${d.received/max*85}px`}}/><b style={{height:`${d.sent/max*85}px`}}/></div>)}</div><small>Blue: received · amber: sent. Boundary days are partial.</small><details><summary>Activity values</summary>{data?.activity.map(d=><p key={d.timestamp}>{new Date(d.timestamp).toISOString().slice(0,10)}: {d.received} received / {d.sent} sent</p>)}</details></article>
    <article className="comms-card"><h3>Source distribution</h3><p>{countOf(data?.threads??0,'distinct thread')}</p><p>Inbox {data?.inbox??0} · Sent {data?.sent??0}</p><small>Labels may overlap. Counts describe the selected cached view.</small><h3>Sender distribution</h3>{data?.people.slice(0,10).map(p=><p key={p.sender}>{p.sender} · {p.count}</p>)}</article>
   </div></details></div>
  </>}
  {selected&&<section className="comms-inspector" aria-label="Cached thread inspector"><header><div><small>GMAIL · CACHED THREAD</small><h3>{selected.subject||'(No subject)'}</h3></div><button className="ghost-icon-action" ref={inspectorClose} aria-label="Close thread inspector" onClick={close}><X size={18}/></button></header><p className="comms-scope">In-scope subset · up to 100 messages · attachments are metadata only</p><button className="ghost-action" onClick={()=>askAboutThread(selected.threadId,selected.subject)}>Ask Olympus about this thread <ArrowUpRight size={14}/></button><small>Prepares a question in the console with this thread attached. Sending it retrieves up to four cached messages for your reasoning provider.</small><h3>Olympus findings · selected message <span className="source-kind">Generated</span></h3>{selected.candidates.length?selected.candidates.map(c=><p key={c.kind}>{c.text}</p>):<p>No generated findings for this message. Read the source below.</p>}<h3>Source</h3>{threadLoading?<p role="status">Loading thread…</p>:thread.length===0?<p>No cached messages available.</p>:thread.map(m=><article className="comms-source" key={m.id}><strong>{m.sender}</strong><small>To: {m.recipients} · {formatWhen(m.internalDate)}</small><pre>{m.cleanText||'Body unavailable'}</pre>{m.attachments.map((a,i)=><p key={i}>Attachment: {a.filename} · {a.mimeType} · {a.size.toLocaleString('en-US')} bytes</p>)}<details><summary>Inspect source</summary><p>Gmail · message {m.id} · thread {m.threadId}</p><p>Body status: {m.bodyStatus.replace(/_/g,' ')}</p><p>Fingerprint: {'fingerprint' in m?String(m.fingerprint):selected.id===m.id?selected.fingerprint:'Unavailable'}</p></details></article>)}</section>}
 </section>;
}

/** "Mail synced 4 min ago · Understanding updated 12 min ago · Background on" (review F1). */
function FreshnessLine({status,feed}:{status:GmailStatus|null;feed:SituationFeed}){
 // Relative times age on their own clock, not only when a poll returns.
 const [,tick]=useState(0);useEffect(()=>{const t=setInterval(()=>tick(n=>n+1),30000);return()=>clearInterval(t)},[]);
 const understanding=feed.data?.understanding;
 return <small className="comms-freshness">
  <span>{status?.account?.lastSuccess?<>Mail synced {formatWhen(status.account.lastSuccess)}</>:'Mail not yet synced'}</span>
  <span>{understanding?.lastSuccessAt?<>Understanding updated {formatWhen(understanding.lastSuccessAt)}</>:feed.data?'Understanding not yet published':'Understanding …'}</span>
  <span>Background {feed.data?feed.data.enabled?'on':'paused':'…'}</span>
 </small>;
}

/** Problems stated with their cause and the one action that recovers (review U12). */
function CommsIssues({health,error,feed,busy,connected,onReconnect,onSync,onSettings,onRetryRead,situations}:{health:ReturnType<typeof gmailHealth>;error:string;feed:SituationFeed;busy:boolean;connected:boolean;onReconnect:()=>void;onSync:()=>void;onSettings:()=>void;onRetryRead:()=>void;situations:SituationsClient}){
 const snapshot=feed.data,understanding=snapshot?.understanding;
 const understandingError=snapshot?.backgroundError||(snapshot?.run?.status==='failed'?snapshot.run.error:null);
 const refreshing=!!feed.busy||snapshot?.run?.status==='running';
 const retryUnderstanding=<button className="ghost-action" title="Runs situation understanding now" disabled={refreshing} onClick={()=>void feed.act('Refreshing situations',()=>situations.refresh())}>Retry now</button>;
 // Summary line always visible; the full cause sits in Details beside the recovery action.
 const issue=(kind:string,summary:string,detail:ReactNode,action:ReactNode,className='')=><div className="comms-issue" data-kind={kind} key={kind}><details className={className}><summary><span role="alert">⚠ {summary}</span> · Details</summary><div>{detail}</div></details>{action}</div>;
 const issues:ReactNode[]=[];
 if(health.state==='auth')issues.push(issue('auth','Authentication required',<p>{health.detail}</p>,<><button className="ghost-action" disabled={busy} onClick={onReconnect}>Reconnect</button><button className="comms-text-action" onClick={onSettings}>Gmail settings</button></>,'comms-diagnostic'));
 else if(health.state==='sync-failed')issues.push(issue('sync',`Mail sync failed · ${health.nextAttemptAt?`next attempt ${formatWhen(health.nextAttemptAt)}`:'cached mail remains available'}`,<p>{health.detail}</p>,<button className="ghost-action" disabled={busy} onClick={onSync}>Retry now</button>,'comms-diagnostic'));
 if(error&&connected)issues.push(issue('read','Mail view could not be read',<p>{error}</p>,<button className="ghost-action" onClick={onRetryRead}>Retry now</button>,'comms-diagnostic'));
 if(connected&&understanding?.nextAttemptAt)issues.push(issue('backoff',`Understanding paused after ${countOf(understanding.failures,'failed attempt')}; next attempt ${formatWhen(understanding.nextAttemptAt)}`,<><p>{understandingError||'The last background attempts failed.'}</p><p>Background attempts back off from five minutes to four hours. Showing previous analysis.</p></>,retryUnderstanding,'situation-diagnostic'));
 else if(connected&&understandingError)issues.push(issue('understanding',`Intelligence refresh failed${snapshot?.situations.length?' · Showing previous analysis':''}`,<><p>{understandingError}</p>{snapshot?.run?.finishedAt&&<small>{formatWhen(snapshot.run.finishedAt)}</small>}</>,retryUnderstanding,'situation-diagnostic'));
 if(connected&&feed.actionError)issues.push(issue('action','Situation action failed',<p>{feed.actionError}</p>,<button className="comms-text-action" onClick={()=>feed.setActionError('')}>Dismiss</button>));
 if(connected&&feed.error&&snapshot)issues.push(issue('poll','Situations could not be refreshed · showing the last reading',<p>{feed.error}</p>,<button className="comms-text-action" onClick={()=>void feed.reload()}>Retry now</button>));
 return issues.length?<div className="comms-issues">{issues}</div>:null;
}
