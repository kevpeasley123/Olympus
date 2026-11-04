import {useEffect,useState} from 'react';
import {FileText,ArrowUpRight,ChevronRight,Mail,FolderOpen} from 'lucide-react';
import type {FocusedMap,FocusedNode} from '../../services/focusedMap';
import type {Situation,Observation} from '../../services/situations';
import type {MailMessage} from '../../services/gmail';
import {situationDocuments,type SituationDocumentsClient,type DocumentAvailability} from '../../services/situationDocuments';
import {relationshipDossier} from '../../services/relationshipDossier';
import {DossierTabs} from './DossierTabs';
import {RelationshipDossier} from './RelationshipDossier';
import {SituationSourceReview} from './SituationSourceReview';
import {formatWhen} from '../../services/time';

export function FocusedMapDetails({node,graph,situation,observations,tab,onTab,onSelect,onFocus,loadThread,documentsApi=situationDocuments}:{node:FocusedNode;graph:FocusedMap;situation:Situation;observations:Observation[];tab:string;onTab:(tab:string)=>void;onSelect:(key:string)=>void;onFocus:(key:string)=>void;loadThread?:(id:string)=>Promise<MailMessage[]>;documentsApi?:SituationDocumentsClient}){
 const [files,setFiles]=useState<DocumentAvailability[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(false),[recordOpen,setRecordOpen]=useState(false),[thread,setThread]=useState<string|null>(node.kind==='thread'?node.observation?.threadId??null:null);
 const context=situation.localContext,stamp=context?.sources.map(s=>s.id+':'+s.path).join('|');
 useEffect(()=>{let active=true;setFiles([]);setError('');if(context){setLoading(true);documentsApi.status(situation.id).then(value=>{if(active)setFiles(value)}).catch(()=>{if(active)setError('File availability could not be checked.')}).finally(()=>{if(active)setLoading(false)})}return()=>{active=false}},[situation.id,stamp,documentsApi,!!context]);
 const threads=observations.filter(o=>o.situationId===situation.id&&node.threadIds.includes(o.threadId)).sort((a,b)=>b.timestamp-a.timestamp);
 const documents=context?.sources.filter(s=>node.sourceIds.includes(s.id))??[];
 const children=(graph.children[node.key]??[]).flatMap(key=>graph.nodes.find(n=>n.key===key)??[]);
 const d=context&&node.actor?relationshipDossier(context,node.actor):null;
 const selectedThread=threads.find(o=>o.threadId===thread);
 const tabs=['Summary','Conversations','Documents'];
 const related=graph.related.filter(r=>r.from===node.key||r.to===node.key);
 function fileRows(limit?:number){return documents.slice(0,limit).map(doc=>{
  const availability=files.find(f=>f.id===doc.id),origin=doc.document?.origin??(/operator.*summary|generated|ChatGPT/i.test(doc.category)?'generated':'local');
  const originLabel=origin==='received'?'Received document':origin==='operator-created'?'Created by you':origin==='generated'?'Generated / supplied context':origin==='referenced'?'Referenced document':'Local file · authorship not recorded';
  return <article className="focused-file" key={doc.id}><FileText size={20} aria-hidden="true"/><div><strong>{doc.title}</strong><small>{originLabel}{doc.document?.date?' · '+doc.document.date:''}</small><small>{availability?.available?'Saved locally':loading?'Checking availability…':availability?'File not currently available':'Local availability not checked'}</small>{tab==='Documents'&&<details><summary>Source details</summary>{doc.document?.description&&<p>{doc.document.description}</p>}{doc.document?.from&&<p>From: {doc.document.from}</p>}<p>{doc.category}</p><code>{doc.path||'No local path recorded'}</code><small>Source: {doc.id}</small>{availability?.available&&!availability.openable&&<p>Opening this file type is not supported.</p>}</details>}</div>{availability?.available&&availability.openable&&<button className="focused-open" aria-label={'Open document: '+doc.title} onClick={()=>void documentsApi.open(situation.id,doc.id).catch(()=>setError('The document could not be opened. It may have moved.'))}>Open <ArrowUpRight size={14}/></button>}</article>
 })}
 return <>
  <header className="focused-detail-heading"><span className="focused-eyebrow">{node.kind==='actor'||node.kind==='person'?'Relationship':node.kind==='document'?'Source document':node.kind==='thread'?'Correspondence':'Relationship map'}</span><h2>{node.title}</h2><p>{node.subtitle}</p></header>
  {situation.stale&&<p className="focused-notice" role="status">Email understanding needs refresh. Saved records remain available.</p>}
  <nav className="focused-tabs" aria-label="Selected item views" role="tablist">{tabs.map((name,i)=><button key={name} role="tab" aria-selected={tab===name} aria-controls="focused-detail-panel" tabIndex={tab===name?0:-1} onClick={()=>onTab(name)} onKeyDown={event=>{let next=i;if(event.key==='ArrowRight')next=(i+1)%3;else if(event.key==='ArrowLeft')next=(i+2)%3;else if(event.key==='Home')next=0;else if(event.key==='End')next=2;else return;event.preventDefault();onTab(tabs[next]);(event.currentTarget.parentElement?.children[next] as HTMLElement).focus()}}>{name}</button>)}</nav>
  <div id="focused-detail-panel" role="tabpanel" aria-label={tab} className="focused-detail-content">
   {error&&<p role="alert" className="focused-notice">{error}</p>}
   {tab==='Summary'&&<>
    <p className="focused-summary">{d?.profile??node.summary}</p>
    {d&&<><h3>Relationship status</h3><p>{d.status}</p></>}
    {children.some(n=>n.kind!=='document'&&n.kind!=='thread')&&<section><h3>Explore relationships</h3><div className="focused-linked-list">{children.filter(n=>n.kind!=='document'&&n.kind!=='thread').slice(0,3).map(n=><button key={n.key} onClick={()=>onSelect(n.key)}><span><strong>{n.title}</strong><small>{n.subtitle}</small></span><ChevronRight size={15}/></button>)}</div>{children.filter(n=>n.kind!=='document'&&n.kind!=='thread').length>3&&<button className="focused-text-button" onClick={()=>onFocus(node.key)}>Explore this branch</button>}</section>}
    {documents.length>0&&<section><h3>Related documents</h3>{fileRows(2)}<button className="focused-text-button" onClick={()=>onTab('Documents')}>View all documents</button></section>}
    {threads.length>0&&<section><h3>Recent correspondence</h3><button className="focused-linked-thread" onClick={()=>{setThread(threads[0].threadId);onTab('Conversations')}}><Mail size={18}/><span>{threads[0].subject}</span><ChevronRight size={16}/></button></section>}
    {related.length>0&&<details className="focused-supporting"><summary>Related connections</summary>{related.map((r,i)=>{const target=graph.nodes.find(n=>n.key===(r.from===node.key?r.to:r.from));return <div key={i}><button className="focused-text-button" onClick={()=>target&&onSelect(target.key)}>{target?.title??'Unavailable relationship'}</button><p>{r.description}</p><small>{r.certainty}</small></div>})}</details>}
    {context&&node.actor&&<details className="focused-supporting" onToggle={e=>setRecordOpen(e.currentTarget.open)}><summary>Full relationship record</summary>{recordOpen&&<RelationshipDossier context={context} actor={node.actor} situationId={situation.id} documentsApi={documentsApi} onBack={()=>onSelect(node.parent??graph.root)}/>}</details>}
    {context&&node.kind==='workstream'&&node.workstream&&<details className="focused-supporting" onToggle={e=>setRecordOpen(e.currentTarget.open)}><summary>Full workstream record</summary>{recordOpen&&<DossierTabs context={context} workstream={node.workstream} situationId={situation.id} documentsApi={documentsApi} provenance={<p>{context.coverage}</p>} documentContext={<>{context.facts.filter(f=>f.workstream===node.workstream).map((fact,i)=><section key={i}><h3>{fact.label}</h3><small>{fact.status}</small><p>{fact.text}</p>{fact.refs.map((ref,j)=><small key={j}>{context.sources.find(source=>source.id===ref.sourceId)?.title??ref.sourceId} · {ref.locator}</small>)}</section>)}</>}><p>{node.summary}</p><p>{context.workstreams.find(w=>w.id===node.workstream)?.nextStep}</p><small>Saved guidance, not a commitment.</small></DossierTabs>}</details>}
    <details className="focused-supporting"><summary>About this understanding</summary><p>{context?'Saved document context · '+context.asOf:'Generated from linked cached correspondence.'}</p><p>{context?.coverage??'The map covers processed correspondence in the current cache.'}</p>{node.actor?.state==='unconfirmed'&&<p>This relationship is unconfirmed.</p>}{node.contacts.length>0&&<><h3>Recorded contacts</h3>{node.contacts.map(c=><p key={c}>{c}</p>)}</>}</details>
   </>}
   {tab==='Conversations'&&(selectedThread?<>{!selectedThread.current&&<p className="focused-notice" role="status">This conversation changed or left the cache. The interpretation may be out of date.</p>}<SituationSourceReview observation={selectedThread} loadThread={loadThread} onBack={()=>setThread(null)}/></>:threads.length?<div className="focused-threads">{threads.map(o=><button key={o.threadId} className="focused-thread" onClick={()=>setThread(o.threadId)}><Mail size={19}/><span><strong>{o.subject||'(No subject)'}</strong><small>{formatWhen(o.timestamp)}{!o.current?' · Source changed or left the cache':''}</small><p>{o.summary}</p></span><ChevronRight size={16}/></button>)}</div>:<div className="focused-empty"><Mail size={26}/><h3>No linked conversations</h3><p>{node.kind==='document'?'This document has no recorded originating email link.':'No cached conversations are linked to this selection.'}</p><small>Other situation correspondence remains reachable from the parent map or search.</small></div>)}
   {tab==='Documents'&&(documents.length?<><p className="focused-scope">Linked source files. Shared records do not establish authorship.</p>{fileRows()}</>:<div className="focused-empty"><FolderOpen size={27}/><h3>No saved documents linked</h3><p>Email attachment listings do not establish that their contents have been saved locally.</p></div>)}
  </div>
 </>;
}
