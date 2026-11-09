import {RefreshCw,SlidersHorizontal,Search} from 'lucide-react';
import {useEffect,useMemo,useRef,useState,type KeyboardEvent as ReactKeyboardEvent,type ReactNode} from 'react';
import {flushSync} from 'react-dom';
import {situationsClient,type SituationsClient,type SituationSnapshot,type Observation,type LocalDraft,type Situation} from '../../services/situations';
import type {MailMessage} from '../../services/gmail';
import './situations.css';
import './communications.css';
import {FocusedSituationMap} from './FocusedSituationMap';
import {SituationSourceReview,type SourceRecommendation} from './SituationSourceReview';
import {SituationDraftEditor} from './SituationDraftEditor';
import {useSituationSnapshot,type SituationFeed} from './useSituationSnapshot';
import {navigatorEntries,sortEntries,filterEntries,LEVEL_LABEL,LEVEL_HINT,FILTER_LABEL,type NavigatorFilter} from '../../services/situationNavigator';
import {EMPTY_COMMS_ACCOUNT,useViewEntry,type CommsAccountViewState,type CommsReplyDraft} from '../../state/viewState';
import {useNavigationTarget} from '../../services/navigation';
import {formatRecipients} from '../../services/recipients';
import {formatWhen} from '../../services/time';

const active=(state:string)=>!['closed','dismissed','merged'].includes(state);
const plural=(n:number,one:string,many=`${one}s`)=>`${n} ${n===1?one:many}`;
const shortDay=(value:string|number)=>{const t=typeof value==='number'?value:Date.parse(value);return Number.isFinite(t)?new Date(t).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'Date unavailable'};

type Panel={kind:'briefing'}|{kind:'activity';focus?:'update'|'log'}|{kind:'source';threadId:string;move?:SourceRecommendation}|{kind:'draft'};

export interface SituationsWorkspaceProps {
 api?:SituationsClient;
 /** Loads a cached Gmail thread for source review; absent in standalone studies. */
 loadThread?:(threadId:string)=>Promise<MailMessage[]>;
 /** Supplied by Communications, which polls once for the header and this view. */
 feed?:SituationFeed;
}

/** Standalone studies poll for themselves; Communications passes its shared feed. */
export function SituationsWorkspace(props:SituationsWorkspaceProps){
 return props.feed?<SituationsView {...props} feed={props.feed}/>:<SelfPollingSituations {...props}/>;
}
function SelfPollingSituations(props:SituationsWorkspaceProps){
 const feed=useSituationSnapshot(props.api??situationsClient,true);
 return <SituationsView {...props} feed={feed} standalone/>;
}

/** Refresh and the background preference. Communications renders these in its header. */
export function SituationControls({feed,api=situationsClient}:{feed:SituationFeed;api?:SituationsClient}){
 const data=feed.data;
 return <>
  <button className="ghost-action comms-labelled-action" title="Analyse changed correspondence now (sends cached excerpts to your reasoning provider)" disabled={!data||!!feed.busy||data?.run?.status==='running'} onClick={()=>void feed.act('Refreshing situations',()=>api.refresh())}><RefreshCw size={14} aria-hidden="true"/> Refresh situations</button>
  <details className="situation-settings"><summary aria-label="Understanding settings" title="Understanding settings"><SlidersHorizontal size={15}/></summary><div className="situation-settings-panel"><label><input type="checkbox" checked={data?.enabled??false} disabled={!data||!!feed.busy} onChange={e=>void feed.act('Updating background preference',()=>api.background(e.target.checked))}/> Background understanding</label><p>Your configured analysis provider reviews changed email, your updates and matching Research context while Olympus is open. Gmail stays read only. Pause background understanding here.</p></div></details>
 </>;
}

function SituationsView({api=situationsClient,loadThread,feed,standalone=false}:SituationsWorkspaceProps&{feed:SituationFeed;standalone?:boolean}){
 const data=feed.data,busy=feed.busy;
 const accountId=data?.accountId??'';
 const [view,setView]=useViewEntry('comms',accountId||'__pending__',EMPTY_COMMS_ACCOUNT);
 const patch=(p:Partial<CommsAccountViewState>)=>{if(accountId)setView(v=>({...v,...p}))};
 const [panel,setPanel]=useState<Panel>(()=>view.openDraftId&&view.drafts[view.openDraftId]?.situationId===view.situationId?{kind:'draft'}:{kind:'briefing'});
 const [update,setUpdate]=useState(''),[title,setTitle]=useState(''),[target,setTarget]=useState('');
 const navRef=useRef<HTMLDivElement>(null);

 const situations=useMemo(()=>data?.situations.filter(s=>active(s.state))??[],[data]);
 const entries=useMemo(()=>sortEntries(navigatorEntries(situations)),[situations]);
 const filter=(view.navigatorFilter??'all') as NavigatorFilter,query=view.navigatorQuery??'';
 const shown=filterEntries(entries,filter,query);
 const selected=situations.some(s=>s.id===view.situationId)?view.situationId!:entries[0]?.id??'';
 // Workstream, actor and tab belong to the situation they were chosen in.
 const scope=view.situationId===selected?view:EMPTY_COMMS_ACCOUNT;
 const overview=!!view.overview;
 const situation=situations.find(s=>s.id===selected);
 const observations=useMemo(()=>data?.observations.filter(o=>o.situationId===selected)??[],[data,selected]);
 const people=useMemo(()=>[...new Map(observations.flatMap(o=>o.people).map(p=>[p.email,p])).values()],[observations]);
 const person=situation&&!situation.localContext&&people.some(p=>p.email===scope.actorId)?scope.actorId!:'';

 // Another surface asked for a situation (navigation.openCommunicationsSituation).
 const [navTarget,consume]=useNavigationTarget('communications');
 useEffect(()=>{
  if(!navTarget||!data)return;
  if(!navTarget.accountId||navTarget.accountId===data.accountId){
   if(situations.some(s=>s.id===navTarget.situationId))focus(navTarget.situationId);
   else feed.setNotice('That situation is no longer active. Closed situations are listed under Closed & dismissed.');
  }
  consume(navTarget.revision);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[navTarget,data]);

 // The account is known only after the first snapshot; reopen an unsent draft left open before a mode switch.
 const restored=useRef(false);
 useEffect(()=>{if(!accountId||restored.current)return;restored.current=true;const open=view.openDraftId&&view.drafts[view.openDraftId];if(open&&open.situationId===selected)setPanel({kind:'draft'})},[accountId,view,selected]);
 const draftId=view.openDraftId&&view.drafts[view.openDraftId]?view.openDraftId:null;
 const draft=draftId?view.drafts[draftId]:undefined;
 const draftHere=!!draft&&draft.situationId===selected;
 const effectivePanel:Panel=panel.kind==='draft'&&!draftHere?{kind:'briefing'}:panel;

 function focus(id:string){patch({situationId:id,workstreamId:null,actorId:null,tab:null,overview:false});setTitle('');setTarget('');setPanel(view.openDraftId&&view.drafts[view.openDraftId]?.situationId===id?{kind:'draft'}:{kind:'briefing'})}
 function showBriefing(){setPanel({kind:'briefing'})}
 function openSource(threadId:string,move?:SourceRecommendation){setPanel({kind:'source',threadId,move})}
 function openActivity(focusOn?:'update'|'log'){
  flushSync(()=>setPanel({kind:'activity',focus:focusOn}));
  const inspector=document.querySelector<HTMLElement>('.situations .contextual-inspector');
  if(focusOn==='update')inspector?.querySelector<HTMLTextAreaElement>('textarea[aria-label="Situation update"]')?.focus();
  if(focusOn==='log')inspector?.querySelector<HTMLElement>('.situation-log-heading')?.scrollIntoView({block:'start',behavior:'instant' as ScrollBehavior});
 }


 const draftFrom=(d:LocalDraft):CommsReplyDraft=>({subject:d.subject,body:d.body,to:formatRecipients(d.to),situationId:d.situationId,threadId:d.threadId,messageId:d.threadId,revision:d.revision,stale:d.stale,saved:{to:formatRecipients(d.to),subject:d.subject,body:d.body}});
 function openDraft(d:LocalDraft){
  const existing=view.drafts[d.id];
  // Unsaved local edits win over the stored copy unless the stored copy moved on.
  const next=existing&&existing.revision===d.revision?existing:draftFrom(d);
  setView(v=>({...v,situationId:d.situationId,openDraftId:d.id,drafts:{...v.drafts,[d.id]:next}}));
  setPanel({kind:'draft'});
 }
 function editDraft(p:Partial<CommsReplyDraft>){if(draftId)setView(v=>({...v,drafts:{...v.drafts,[draftId]:{...v.drafts[draftId],...p}}}))}
 function closeDraft(){if(!draftId)return;setView(v=>{const {[draftId]:_closed,...rest}=v.drafts;return {...v,drafts:rest,openDraftId:null}});setPanel({kind:'briefing'})}
 async function saveDraft(emails:string[]):Promise<boolean>{
  if(!draftId||!draft)return false;
  const request:LocalDraft={id:draftId,situationId:draft.situationId??selected,threadId:draft.threadId??'',revision:draft.revision??1,to:emails,subject:draft.subject,body:draft.body};
  const ok=await feed.act('Saving local draft',()=>api.save(request));
  if(ok){editDraft({revision:(draft.revision??1)+1,saved:{to:draft.to??'',subject:draft.subject,body:draft.body}});feed.setNotice('Draft saved locally. No email was sent.')}
  return ok;
 }
 async function newDraft(threadId:string){
  const situationId=selected;
  await feed.act('Preparing a local reply draft',async()=>{const d=await api.draft(situationId,threadId);openDraft({...d,situationId:d.situationId||situationId})});
 }

 const draftReason=(threadId:string)=>busy?'Wait for the current action to finish.':situation?.stale?'Understanding needs refreshing before a reply can be drafted.':!observations.some(o=>o.threadId===threadId&&o.current)?'The source thread changed or left the cache. Review the source first.':'';

 const onNavKey=(e:ReactKeyboardEvent<HTMLDivElement>)=>{
  const items=[...(navRef.current?.querySelectorAll<HTMLButtonElement>('.situation-nav-item')??[])];
  const index=items.indexOf(document.activeElement as HTMLButtonElement);if(index<0)return;
  const next=e.key==='ArrowDown'?Math.min(items.length-1,index+1):e.key==='ArrowUp'?Math.max(0,index-1):e.key==='Home'?0:e.key==='End'?items.length-1:-1;
  if(next<0)return;e.preventDefault();items.forEach((item,i)=>item.tabIndex=i===next?0:-1);items[next].focus();
 };
 const rovingId=overview?'overview':shown.some(e=>e.id===selected)?selected:'overview';

 if(!data)return <section className="situations" aria-label="Situation intelligence"><p className="situations-loading">{feed.error||'Loading situation understanding…'}</p></section>;

 const panelContent:ReactNode=!situation?null:effectivePanel.kind==='source'?(()=>{const o=observations.find(x=>x.threadId===effectivePanel.threadId);return o?<SituationSourceReview key={o.threadId} observation={o} recommendation={effectivePanel.move} loadThread={loadThread} onBack={showBriefing}/>:<p>This thread is no longer part of the situation.</p>})()
  :effectivePanel.kind==='draft'&&draft?<SituationDraftEditor key={draftId} draft={draft} situationTitle={situation.title} threadSubject={observations.find(o=>o.threadId===draft.threadId)?.subject??draft.subject.replace(/^re:\s*/i,'')} busy={!!busy} onChange={editDraft} onSave={saveDraft} onClose={closeDraft}/>
  :effectivePanel.kind==='activity'?<ActivityPanel data={data} situation={situation} situations={situations} observations={observations} people={people} person={person} onPerson={email=>patch({situationId:selected,actorId:email||null})} update={update} setUpdate={setUpdate} busy={!!busy} feed={feed} api={api} onSource={openSource} onDraft={openDraft} onNewDraft={newDraft} draftReason={draftReason} title={title} setTitle={setTitle} target={target} setTarget={setTarget} focus={effectivePanel.focus}/>
  :null;

 const navigation=<div className="focused-situation-switcher"><label><span className="focused-sr-only">Situation</span><select aria-label="Select situation" value={overview?'':selected} onChange={e=>e.target.value?focus(e.target.value):patch({overview:true})}><option value="">All relationships</option>{entries.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></label><details className="focused-situation-directory"><summary title="Browse and filter all situations" aria-label="Browse all situations">All · {situations.length}</summary><aside className="situation-navigator" aria-label="Situation navigator">
    <a className="skip-link" href="#situation-inspector" onClick={e=>{e.preventDefault();const target=document.getElementById('situation-inspector')??document.querySelector<HTMLElement>('.situations .contextual-inspector');target?.focus()}}>Skip to selected details</a>
    <h4>Situations <small>{situations.length}</small></h4>
    <div className="situation-nav-tools">
     <label className="situation-nav-search"><Search size={13} aria-hidden="true"/><input type="search" aria-label="Search situations by title" placeholder="Search titles" value={query} onChange={e=>patch({navigatorQuery:e.target.value})}/></label>
     <div className="situation-nav-filters" role="group" aria-label="Filter situations">{(Object.keys(FILTER_LABEL) as NavigatorFilter[]).map(f=><button key={f} aria-pressed={filter===f} onClick={()=>patch({navigatorFilter:f})}>{FILTER_LABEL[f]}</button>)}</div>
    </div>
    <div className="situation-nav-scroll" ref={navRef} role="list" aria-label="Situations by review priority" onKeyDown={onNavKey}>
     <div role="listitem"><button className="situation-nav-overview situation-nav-item" tabIndex={rovingId==='overview'?0:-1} aria-pressed={overview} onClick={()=>patch({overview:true})}>Overview · {situations.length}</button></div>
     {shown.map(e=>{const pendingDraft=Object.values(view.drafts).some(d=>d.situationId===e.id);return <div role="listitem" key={e.id}><button className="situation-nav-card situation-nav-item" tabIndex={rovingId===e.id?0:-1} aria-pressed={!overview&&selected===e.id} onClick={()=>focus(e.id)}><strong>{e.title}</strong><span className="situation-priority-chip" data-level={e.level} title={LEVEL_HINT[e.level]}>{LEVEL_LABEL[e.level]}</span><small>{e.state==='emerging'?'Emerging':e.state==='active'?'Active':e.state} · updated {shortDay(e.updatedAt)}{e.openQuestions?` · ${plural(e.openQuestions,'open question')}`:''}{pendingDraft?' · unsent draft':''}</small></button></div>})}
     {!shown.length&&<p className="situation-nav-empty">No situations match{query?` “${query}”`:''}{filter!=='all'?` in ${FILTER_LABEL[filter]}`:''}.</p>}
    </div>
   </aside></details></div>;
 const statusLine=busy||(data.run?.status==='running'?data.run.phase:feed.notice)||'';
 return <section className="situations" aria-label="Situation intelligence">
  {(standalone||statusLine)&&<header className="situations-heading compact-situation-tools">
   <div className="situations-status" role="status">{statusLine}</div>
   {standalone&&(feed.error||feed.actionError||data.backgroundError||data.run?.error)&&<details className="situation-diagnostic"><summary><span role="alert">⚠ {feed.actionError?'Situation action failed':'Intelligence refresh failed'}{situations.length?' · Showing previous analysis':''}</span> · Details</summary><div><p>{feed.actionError||feed.error||String(data.backgroundError||data.run?.error)}</p>{data.run?.finishedAt&&<small>{formatWhen(data.run.finishedAt)}</small>}</div></details>}
   {standalone&&<SituationControls feed={feed} api={api}/>}
  </header>}
  <div className="situation-layout">
   {(!situation||overview)&&navigation}
   <div className="situation-selected">
    {!situations.length?<div className="situation-empty-map"><div className="situation-map-placeholder" aria-label="No relationship map published yet"><span>Ω</span><h4>No map yet</h4></div><div><h4>{data.run?.status==='running'?'Building your first relationship map':'Your relationship map will appear here'}</h4><p>{data.run?.status==='running'?'Reading relevant conversations and connecting the people involved.':data.run?.status==='failed'?'Discovery paused before publishing a map. Refresh situations to try again.':'Olympus has not identified a situation in the correspondence processed so far.'}</p><small>{plural(data.horizonDays,'day')} of cached mail available</small></div></div>
    :overview?<div className="situation-overview">{entries.map(e=>{const s=situations.find(x=>x.id===e.id)!;return <button key={s.id} className="situation-overview-card" onClick={()=>focus(s.id)}><small><span className="situation-priority-chip" data-level={e.level}>{LEVEL_LABEL[e.level]}</span> {s.state==='emerging'?'Emerging':'Active'}</small><h4>{s.title}</h4><p>{s.localContext?.summary||s.briefing.whereThingsStand||'Building the first briefing…'}</p><span>{s.localContext?plural(s.localContext.entities.length,'entity','entities'):plural(new Set(data.observations.filter(o=>o.situationId===s.id).flatMap(o=>o.people.map(p=>p.email))).size,'person','people')}</span></button>})}</div>
    :situation&&<>
     <FocusedSituationMap key={accountId+':'+situation.id} situation={situation} observations={observations} accountId={accountId} navigation={navigation} loadThread={loadThread} inspector={panelContent} onCloseInspector={showBriefing} onManage={()=>openActivity()}/>
    </>}
   </div>
  </div>
  {!!data.situations.some(s=>['closed','dismissed'].includes(s.state))&&<details className="closed-situations"><summary>Closed &amp; dismissed</summary>{data.situations.filter(s=>['closed','dismissed'].includes(s.state)).map(s=><p key={s.id}>{s.title} · {s.state} <button disabled={!!busy} onClick={()=>void feed.act('Restoring',()=>api.edit(s.id,'restore'))}>Restore</button></p>)}</details>}
 </section>;
}

function ActivityPanel({data,situation,situations,observations,people,person,onPerson,update,setUpdate,busy,feed,api,onSource,onDraft,onNewDraft,draftReason,title,setTitle,target,setTarget,focus}:{data:SituationSnapshot;situation:Situation;situations:Situation[];observations:Observation[];people:Observation['people'];person:string;onPerson:(email:string)=>void;update:string;setUpdate:(v:string)=>void;busy:boolean;feed:SituationFeed;api:SituationsClient;onSource:(threadId:string)=>void;onDraft:(d:LocalDraft)=>void;onNewDraft:(threadId:string)=>Promise<void>;draftReason:(threadId:string)=>string;title:string;setTitle:(v:string)=>void;target:string;setTarget:(v:string)=>void;focus?:'update'|'log'}){
 const selected=situation.id;
 const activity=[...observations.map(o=>({id:'email:'+o.threadId,at:o.timestamp,label:o.current?'Correspondence in this situation':'Correspondence source changed',text:o.subject})),...data.updates.filter(u=>u.situationId===selected).map(u=>({id:'update:'+u.id,at:Date.parse(u.at),label:'Your situation update',text:u.text}))].sort((a,b)=>(Number.isFinite(b.at)?b.at:0)-(Number.isFinite(a.at)?a.at:0));
 const logHeading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{if(focus==='log')logHeading.current?.scrollIntoView({block:'start',behavior:'instant' as ScrollBehavior})},[focus,person]);
 const personName=people.find(p=>p.email===person)?.name;
 const drafts=data.drafts.filter(d=>d.situationId===selected);
 return <div className="situation-activity-panel">
  {situation.localContext&&observations.length>0&&<section className="situation-latest"><h4>Latest communication update</h4><p>{situation.briefing.whereThingsStand}</p><p>{situation.briefing.whatChanged}</p></section>}
  <section className="situation-activity" aria-label="Recent situation activity"><h4>Recent activity</h4>{activity.length?<ol>{activity.slice(0,6).map(event=><li key={event.id}><small>{shortDay(event.at)}</small><strong>{event.label}</strong><p>{event.text}</p></li>)}</ol>:<p>No correspondence or operator updates are recorded for this situation yet.</p>}<small>Dates reflect correspondence and saved updates. Earlier records remain in the log below.</small></section>
  <section className="situation-update-form"><h4>Add an update</h4><p>Add context, correct an assumption, or paste a summary of work you did elsewhere.</p><form onSubmit={e=>{e.preventDefault();void feed.act('Saving your update',async()=>{await api.update(selected,update);setUpdate('')}).then(ok=>{if(ok)feed.setNotice('Update saved. The next refresh will incorporate your context.')})}}><textarea aria-label="Situation update" value={update} maxLength={12000} rows={4} onChange={e=>setUpdate(e.target.value)} placeholder="What has changed, and what are you trying to achieve?"/><button disabled={busy||!update.trim()}>Save update</button></form></section>
  <section className="situation-support"><h4 ref={logHeading} className="situation-log-heading" tabIndex={-1}>{personName?`${personName} · conversation log`:'Conversation log'}</h4>{personName&&<button className="comms-text-action" onClick={()=>onPerson('')}>Show everyone</button>}
   {observations.filter(o=>!person||o.people.some(p=>p.email===person)).sort((a,b)=>b.timestamp-a.timestamp).map(o=><div className="situation-log" key={o.threadId}><small>{formatWhen(o.timestamp)} · {o.current?'Cached evidence':'Source changed or left the cache'}</small><strong>{o.subject}</strong><p>{o.summary}</p>{o.relationships.map((r,i)=><p key={i} className="situation-relation">{r.description}</p>)}<button onClick={()=>onSource(o.threadId)}>Review source</button><button disabled={!!draftReason(o.threadId)} title={draftReason(o.threadId)||undefined} onClick={()=>void onNewDraft(o.threadId)}>Draft reply</button>{o.details.length>0&&<details><summary>Practical details · {o.details.length}</summary>{o.details.map((d,i)=><div key={i}><strong>{d.label}</strong><p>{d.value}</p><blockquote>{d.quote}</blockquote>{d.kind==='portal'&&<small>Address from email · not verified</small>}</div>)}</details>}</div>)}
   {!observations.length&&<p>No correspondence is linked to this situation.</p>}
  </section>
  <details><summary>Your updates · {data.updates.filter(u=>u.situationId===selected).length}</summary>{data.updates.filter(u=>u.situationId===selected).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).map(u=><p key={u.id}><small>{formatWhen(u.at)}</small><br/>{u.text}</p>)}</details>
  <details><summary>Research context · {situation.briefing.research?.length??0}</summary>{situation.briefing.research?.length?situation.briefing.research.map((r,i)=><div key={i}><strong>{r.title}</strong><small>{r.sourceFile}</small><p>{r.excerpt}</p></div>):<p>No Research excerpts informed this briefing.</p>}</details>
  <details><summary>Saved local drafts · {drafts.length}</summary>{drafts.length?drafts.map(d=><button key={d.id} onClick={()=>onDraft(d)}>{d.subject}{d.stale?' · source changed':''}</button>):<p>No local drafts for this situation.</p>}</details>
  <details><summary>Manage situation</summary><input aria-label="Situation name" placeholder={situation.title} value={title} maxLength={100} onChange={e=>setTitle(e.target.value)}/><button disabled={busy||!title.trim()} onClick={()=>void feed.act('Renaming',()=>api.edit(selected,'rename',title))}>Rename</button><select aria-label="Merge destination" value={target} onChange={e=>setTarget(e.target.value)}><option value="">Merge into…</option>{situations.filter(s=>s.id!==selected).map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select><button disabled={busy||!target} onClick={()=>void feed.act('Merging',()=>api.edit(selected,'merge',target))}>Merge</button><button disabled={busy} onClick={()=>void feed.act('Closing situation',()=>api.edit(selected,'close'))}>Close situation</button><button disabled={busy} onClick={()=>void feed.act('Dismissing situation',()=>api.edit(selected,'dismiss'))}>Dismiss</button></details>
 </div>;
}
