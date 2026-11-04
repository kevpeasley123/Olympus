import {useMemo,useState,useRef,useLayoutEffect,type ReactNode} from 'react';
import {Search,ChevronRight,ArrowUpRight,Home,Folder,Users,FileText,Mail,Minus,Plus,Scan,ArrowLeft,MoreHorizontal} from 'lucide-react';
import type {Situation,Observation} from '../../services/situations';
import type {MailMessage} from '../../services/gmail';
import {buildFocusedMap,branchPage,searchFocusedMap,type FocusedNode} from '../../services/focusedMap';
import {useViewEntry,EMPTY_COMMS_ACCOUNT} from '../../state/viewState';
import {FocusedMapDetails} from './FocusedMapDetails';
import type {SituationDocumentsClient} from '../../services/situationDocuments';
import './focusedMap.css';
const iconFor=(node:FocusedNode)=>node.kind==='document'?FileText:node.kind==='thread'?Mail:node.kind==='actor'||node.kind==='person'?Users:node.kind==='situation'?Home:Folder;
export function FocusedSituationMap({situation,observations,accountId,navigation,loadThread,inspector,onCloseInspector,onManage,documentsApi}:{situation:Situation;observations:Observation[];accountId:string;navigation?:ReactNode;loadThread?:(id:string)=>Promise<MailMessage[]>;inspector?:ReactNode;onCloseInspector:()=>void;onManage:()=>void;documentsApi?:SituationDocumentsClient}){
 const graph=useMemo(()=>buildFocusedMap(situation,observations),[situation,observations]);
 const [view,setView]=useViewEntry('comms',accountId||'__pending__',EMPTY_COMMS_ACCOUNT);
 const saved=view.focusedMaps?.[situation.id];
 const update=(patch:Partial<NonNullable<typeof saved>>)=>{if(accountId)setView(v=>({...v,focusedMaps:{...v.focusedMaps,[situation.id]:{...v.focusedMaps?.[situation.id],...patch}}}))};
 const branch=branchPage(graph,saved?.focus??graph.root,saved?.page??0);
 const selected=graph.nodes.find(n=>n.key===saved?.selection)??branch.focus;
 const query=saved?.query??'',tab=['Summary','Conversations','Documents'].includes(saved?.tab??'')?saved!.tab!:'Summary';
 const [zoom,setZoom]=useState(1),[searchPage,setSearchPage]=useState(0);
 const mapViewport=useRef<HTMLDivElement>(null),panel=useRef<HTMLElement>(null);
 const pendingFocus=useRef<'root'|'detail'|null>(null);
 useLayoutEffect(()=>{
  const target=pendingFocus.current;if(!target)return;pendingFocus.current=null;
  if(target==='detail')panel.current?.focus({preventScroll:true});
  else mapViewport.current?.querySelector<HTMLButtonElement>('.focused-node.is-root .focused-node-select')?.focus({preventScroll:true});
 });
 const matches=useMemo(()=>searchFocusedMap(graph,query),[graph,query]);
 const resultPage=Math.min(searchPage,Math.max(0,Math.ceil(matches.length/8)-1));
 function select(key:string){update({selection:key,tab:graph.nodes.find(n=>n.key===key)?.kind==='document'?'Documents':graph.nodes.find(n=>n.key===key)?.kind==='thread'?'Conversations':'Summary'});onCloseInspector();panel.current?.scrollTo({top:0})}
 function focus(key:string){pendingFocus.current='root';update({focus:key,selection:key,page:0,query:'',tab:'Summary'});setZoom(1);onCloseInspector();mapViewport.current?.scrollTo({left:0,top:0})}
 const crumbs:FocusedNode[]=[];let cursor:FocusedNode|undefined=branch.focus;const seen=new Set<string>();
 while(cursor&&!seen.has(cursor.key)){seen.add(cursor.key);crumbs.unshift(cursor);cursor=graph.nodes.find(n=>n.key===cursor!.parent)}
 const expandable=(node:FocusedNode)=>(graph.children[node.key]?.length??0)>0;
 const nodeButton=(node:FocusedNode,isRoot=false)=>{const Icon=iconFor(node);return <div className={'focused-node'+(node.key===selected.key?' is-selected':'')+(isRoot?' is-root':'')} data-kind={node.kind} data-key={node.key}><button className="focused-node-select" aria-pressed={node.key===selected.key} title={node.title} onClick={()=>select(node.key)}><Icon size={19}/><span>{node.title}</span>{node.actor?.state==='unconfirmed'&&<small title="Relationship unconfirmed">?</small>}</button>{expandable(node)&&!isRoot&&<button className="focused-node-expand" aria-label={'Focus branch: '+node.title} title={'Explore '+node.title} onClick={()=>focus(node.key)}><ChevronRight size={17}/></button>}</div>};
 return <div className="focused-workspace">
  <header className="focused-toolbar">{navigation}<label className="focused-search"><Search size={17}/><input type="search" aria-label="Search relationships, conversations and documents" placeholder="Search relationships, conversations, documents" value={query} maxLength={300} onChange={e=>{update({query:e.target.value});setSearchPage(0)}}/></label><button className="focused-text-button focused-manage" title="Situation updates, history and saved drafts" onClick={onManage}><MoreHorizontal size={18}/><span>More</span></button></header>
  <div className="focused-split">
   <section className="focused-map" data-focus={branch.focus.key} aria-label="Focused relationship map">
    <nav className="focused-breadcrumbs" aria-label="Relationship path">{branch.focus.parent&&<button aria-label="Back to parent branch" onClick={()=>focus(branch.focus.parent!)}><ArrowLeft size={16}/></button>}{crumbs.map((n,i)=><span key={n.key}>{i>0&&<span aria-hidden="true">/</span>}<button aria-current={i===crumbs.length-1?'location':undefined} onClick={()=>focus(n.key)}>{n.title}</button></span>)}</nav>
    {query.trim()?<div className="focused-search-results" aria-live="polite"><h3>Search this situation</h3>{matches.length?matches.slice(resultPage*8,resultPage*8+8).map(n=><div key={n.key}><button onClick={()=>{pendingFocus.current='detail';select(n.key);update({focus:n.parent??graph.root,page:Math.floor((graph.children[n.parent??graph.root]??[]).indexOf(n.key)/8),query:''})}}><span>{n.title}<small>{n.kind==='actor'?'Relationship':n.kind} · {n.subtitle}</small></span><ChevronRight size={16}/></button></div>):<p>No matching relationships or sources.</p>}{matches.length>8&&<footer><button disabled={!resultPage} onClick={()=>setSearchPage(p=>p-1)}>Previous results</button><span>{resultPage+1} / {Math.ceil(matches.length/8)}</span><button disabled={(resultPage+1)*8>=matches.length} onClick={()=>setSearchPage(p=>p+1)}>More results</button></footer>}</div>:
    <div ref={mapViewport} className="focused-map-viewport"><div className="focused-map-scale" style={{width:`${100*zoom}%`,minHeight:Math.max(330,branch.nodes.length*62)*zoom}}><div className="focused-tree" style={{minHeight:Math.max(330,branch.nodes.length*62),transform:`scale(${zoom})`,transformOrigin:'top left',width:`${100/zoom}%`}}>{nodeButton(branch.focus,true)}{branch.nodes.length?<div className="focused-branches">{branch.nodes.map(n=><div className="focused-branch" key={n.key}>{nodeButton(n)}</div>)}</div>:<div className="focused-leaf"><span>No further branches</span><small>Its records are in the detail panel.</small></div>}</div></div></div>}
    <footer className="focused-map-footer"><div className="focused-zoom" role="group" aria-label="Map zoom"><button aria-label="Zoom map out" disabled={zoom<=1} onClick={()=>setZoom(z=>Math.max(1,z-.15))}><Minus size={15}/></button><button aria-label="Reset map zoom" onClick={()=>{setZoom(1);mapViewport.current?.scrollTo({left:0,top:0})}}><Scan size={15}/></button><button aria-label="Zoom map in" disabled={zoom>=1.6} onClick={()=>setZoom(z=>Math.min(1.6,z+.15))}><Plus size={15}/></button></div>{branch.total>8&&!query&&<div className="focused-pagination"><button disabled={!branch.page} onClick={()=>update({page:branch.page-1})}>Previous</button><span>{branch.page*8+1}–{Math.min(branch.total,(branch.page+1)*8)} of {branch.total}</span><button disabled={(branch.page+1)*8>=branch.total} onClick={()=>update({page:branch.page+1})}>More</button></div>}{selected.key!==branch.focus.key&&expandable(selected)&&<button className="focused-focus-action" onClick={()=>focus(selected.key)}><ArrowUpRight size={14}/>Focus this branch</button>}</footer>
   </section>
   <article className="focused-detail contextual-inspector" ref={panel} aria-label="Selected relationship details" tabIndex={-1}>{inspector?<><button className="focused-text-button focused-return" onClick={onCloseInspector}><ArrowLeft size={16}/>Back to selected relationship</button>{inspector}</>:<FocusedMapDetails key={situation.id+':'+selected.key} node={selected} graph={graph} situation={situation} observations={observations} tab={tab} onTab={tab=>update({tab})} onSelect={select} onFocus={focus} loadThread={loadThread} documentsApi={documentsApi}/>}</article>
  </div>
 </div>;
}
