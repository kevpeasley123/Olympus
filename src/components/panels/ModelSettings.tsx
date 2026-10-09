import {useEffect,useLayoutEffect,useState,useRef,useId} from "react";
import {createPortal} from "react-dom";
import {MemoryEvidence} from "./MemoryEvidence";
import {loadModelCatalog,loadModelDiagnostics,saveModelSelection,useModelSelection,type ModelCatalog,type ModelCapability,type ModelScope,type ModelRequest} from "../../services/modelRouting";
import {isTauriRuntime} from "../../services/launcher";
import {routeLabel} from "../../services/routeLabel";
import {formatWhen} from "../../services/time";
import "./command.css";
import "./modelPicker.css";
const ms=(value:number|null)=>value===null?"—":value<1000?`${value} ms`:`${(value/1000).toFixed(1)} s`;
const statusLabel=(row:ModelRequest)=>row.errorCode?`${row.status} · ${row.errorCode}`:row.status;
export function ModelRouteControl({disabled=false}:{disabled?:boolean}) {
 const [catalog,setCatalog]=useState<ModelCatalog|null>(null),[open,setOpen]=useState(false),[error,setError]=useState<string|null>(null),[saving,setSaving]=useState(false);
 const selection=useModelSelection(),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null),id=useId();
 const returnFocus=useRef(false),scopeFocus=useRef<HTMLButtonElement|null>(null);
 const [position,setPosition]=useState({left:8,top:8,width:320,maxHeight:400});
 const desktop=isTauriRuntime();
 const refresh=()=>loadModelCatalog().then(value=>{setCatalog(value);setError(null);}).catch(()=>setError("Model catalog unavailable. Try again."));
 useEffect(()=>{void refresh();},[]);
 useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
 const current=catalog?.routes.find(r=>r.capability===selection.capability);
 const defaultName=catalog?.routes.find(r=>r.capability===catalog.defaultCapability)?.label??"the configured default";
 const suffix=!catalog?"Loading":!current?.available?"Unavailable":selection.scope==="chat"?"This chat":selection.capability===catalog.defaultCapability?"Default":"Next answer";
 const close=(focus=false)=>{returnFocus.current=focus;setOpen(false);};
 useLayoutEffect(()=>{if(!saving){if(!open&&returnFocus.current){returnFocus.current=false;trigger.current?.focus();}else if(open&&scopeFocus.current){scopeFocus.current.focus();scopeFocus.current=null;}}},[open,saving]);
 useLayoutEffect(()=>{
  if(!open)return;
  const place=()=>{
   const anchor=trigger.current?.getBoundingClientRect();if(!anchor)return;
   const composer=trigger.current?.closest('.console-command-bar')?.getBoundingClientRect()??anchor;
   const vv=window.visualViewport,leftEdge=vv?.offsetLeft??0,topEdge=vv?.offsetTop??0;
   const w=vv?.width??innerWidth,h=vv?.height??innerHeight;
   const width=Math.min(360,Math.max(280,composer.width-16),w-16);
   const left=Math.max(leftEdge+8,Math.min(composer.right-width,leftEdge+w-width-8));
   const above=anchor.top-topEdge-18,below=topEdge+h-anchor.bottom-18;
   const useAbove=above>=Math.min(350,below);
   const maxHeight=Math.max(80,useAbove?above:below);
   const height=Math.min(panel.current?.scrollHeight??400,maxHeight);
   setPosition({left,top:useAbove?Math.max(topEdge+8,anchor.top-height-10):anchor.bottom+10,width,maxHeight});
  };
  place();const observer=new ResizeObserver(place);if(panel.current)observer.observe(panel.current);
  window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
  window.visualViewport?.addEventListener('resize',place);window.visualViewport?.addEventListener('scroll',place);
  return()=>{observer.disconnect();window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);window.visualViewport?.removeEventListener('resize',place);window.visualViewport?.removeEventListener('scroll',place);};
 },[open,catalog,error]);
 useEffect(()=>{
  if(!open)return;
  (panel.current?.querySelector<HTMLButtonElement>('[role="radio"][aria-checked="true"]:not(:disabled)')??panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus();
  const outside=(e:PointerEvent)=>{if(!panel.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))close();};
  const focusOutside=(e:FocusEvent)=>{if(!panel.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))close();};
  document.addEventListener('pointerdown',outside);document.addEventListener('focusin',focusOutside);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('focusin',focusOutside);};
 },[open]);
 async function choose(capability:ModelCapability,scope:ModelScope,finish:boolean){
  if(!finish)scopeFocus.current=document.activeElement as HTMLButtonElement;
  setSaving(true);setError(null);
  try{await saveModelSelection(capability,scope);if(finish)close(true);}
  catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setSaving(false);}
 }
 return <div className="model-route-control">
  <button ref={trigger} type="button" className="model-route-trigger" aria-label={`Choose model: ${current?.label??selection.capability} · ${suffix}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open?id:undefined} disabled={disabled||saving}
   onClick={()=>{if(open)close(true);else{setOpen(true);void refresh();}}}>
   <span>{current?.label??(error?"Models":"Model")}</span><span className="model-choice-scope"> · {suffix}</span><span aria-hidden="true"> ▾</span>
  </button>
  {open&&createPortal(<div ref={panel} id={id} role="dialog" aria-modal="false" aria-label="Choose a model" className="olympus-model-picker" style={position} onKeyDown={e=>{
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);}
   const group=(e.target as HTMLElement).closest('[role="radiogroup"]');
   if(group&&['ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Home','End'].includes(e.key)){
    e.preventDefault();const items=Array.from(group.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));const index=items.indexOf(document.activeElement as HTMLButtonElement);
    const next=e.key==='Home'?0:e.key==='End'?items.length-1:(index+(['ArrowDown','ArrowRight'].includes(e.key)?1:-1)+items.length)%items.length;
    items[next]?.focus();
   }
   if(e.key==='Tab'){
    const items=Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);
    if((e.shiftKey&&document.activeElement===items[0])||(!e.shiftKey&&document.activeElement===items[items.length-1])){e.preventDefault();close(true);}
   }
  }}>
   <header><h3>Choose a model</h3><button type="button" className="model-picker-close" aria-label="Close model picker" onClick={()=>close(true)}>×</button></header>
   <div role="radiogroup" aria-label="Models" className="model-picker-options">
    {catalog?.routes.map(route=><button type="button" role="radio" aria-checked={selection.capability===route.capability} disabled={!route.available||saving} key={route.capability} title={route.model} onClick={()=>void choose(route.capability,selection.scope,true)}>
     <span className="model-picker-copy"><strong>{route.label}</strong><small>{route.description}</small>{!route.available&&<small className="model-unavailable">Unavailable · {route.unavailableReason}</small>}</span>
     <span className="model-provider">{route.providerLabel}</span><span className="model-check" aria-hidden="true">{selection.capability===route.capability?'✓':''}</span>
    </button>)}
   </div>
   <div className="model-picker-scope" role="radiogroup" aria-label="Applies to"><span>Applies to</span><div>
    {([['next','Next answer'],['chat','This chat']] as const).map(([scope,label])=><button key={scope} type="button" role="radio" aria-checked={selection.scope===scope} disabled={saving||!current?.available} onClick={()=>void choose(selection.capability,scope,false)}>{label}</button>)}
   </div></div>
   <p>{selection.scope==='next'?`Returns to ${defaultName} after this answer.`:'Stays selected for this conversation until you change it.'}</p>
   {!desktop&&<p className="model-preview-note">Browser preview · models run in the desktop app.</p>}
   {error&&<div role="alert" className="model-picker-error">{error}<button type="button" onClick={()=>void refresh()}>Retry</button></div>}
  </div>,document.body)}
 </div>;
}
export function ModelAttribution({request}:{request:ModelRequest}){
 const [open,setOpen]=useState(false);
 const confirmed=request.actualModel;
 return <details className="model-attribution" onToggle={event=>setOpen(event.currentTarget.open)}><summary>{confirmed?`Answered by ${confirmed}`:`Requested ${request.requestedModel} · unconfirmed`}</summary>
  <dl><dt>Provider</dt><dd>{request.provider}</dd><dt>Requested</dt><dd>{request.requestedModel}</dd><dt>Actual model</dt><dd>{confirmed??'Unconfirmed — provider did not report a model'}</dd><dt>Reasoning</dt><dd>{request.reasoningEffort??'Not reported'}</dd><dt>Status</dt><dd>{request.status}</dd><dt>Request</dt><dd>{request.id}</dd>{request.fallbackFrom&&<><dt>Fallback from</dt><dd>{request.fallbackFrom}</dd></>}</dl>
 {open&&<MemoryEvidence requestId={request.id}/>}
 </details>;
}

/**
 * Request diagnostics as a table (review D4): the columns answer "what ran,
 * how, and how fast"; each row's full record stays one disclosure away.
 */
export function ModelDiagnostics(){
 const [rows,setRows]=useState<ModelRequest[]>([]);const [error,setError]=useState<string|null>(null);const [catalog,setCatalog]=useState<ModelCatalog|null>(null);
 async function refresh(){try{setCatalog(await loadModelCatalog());setRows(await loadModelDiagnostics());setError(null);}catch{setError("Model diagnostics are available in the desktop app.");}}
 return <details className="model-diagnostics" onToggle={event=>{if(event.currentTarget.open)void refresh();}}><summary>Model diagnostics</summary>
 {catalog&&<dl className="model-diagnostics-routes"><dt>Brain</dt><dd>{catalog.routes[0].model}</dd><dt>Voice</dt><dd>{catalog.realtime}</dd><dt>Transcription</dt><dd>{catalog.transcription}</dd><dt>Coding driver</dt><dd>{catalog.coding}</dd></dl>}
 <button type="button" className="ghost-action" onClick={()=>void refresh()}>Refresh requests</button>
 {error&&<p role="status">{error}</p>}
 {rows.length>0?<div className="model-diagnostics-table-wrap"><table className="model-diagnostics-table">
  <thead><tr><th scope="col">Time</th><th scope="col">Route</th><th scope="col">Model</th><th scope="col">Status</th><th scope="col">First token</th><th scope="col">Latency</th></tr></thead>
  <tbody>{rows.map(row=><DiagnosticRow key={row.id} row={row}/>)}</tbody>
 </table></div>:!error&&<p className="model-diagnostics-empty">No requests recorded yet.</p>}
 <p>Request metadata only. Costs are not estimated; reported token usage is in each row's record. Deep Analysis is operator-selected and never recursive.</p>
 </details>;
}
function DiagnosticRow({row}:{row:ModelRequest}){
 const [open,setOpen]=useState(false);const detailId=useId();
 return <>
  <tr data-status={row.status}>
   <td><time dateTime={row.requestedAt} title={formatWhen(row.requestedAt,{withDate:true})}>{formatWhen(row.requestedAt)}</time></td>
   <td>{routeLabel(row)}<small>{row.purpose.replace(/_/g," ")}</small></td>
   <td className="model-diagnostics-model">{row.actualModel??`${row.requestedModel} (requested)`}{row.fallbackFrom&&<small>fell back from {row.fallbackFrom}</small>}</td>
   <td>{statusLabel(row)}</td>
   <td className="tabular-data">{ms(row.firstTokenMs)}</td>
   <td className="tabular-data">{ms(row.latencyMs)}
    <button type="button" className="model-diagnostics-json" aria-expanded={open} aria-controls={detailId} onClick={()=>setOpen(value=>!value)}>{open?"Hide":"Record"}</button></td>
  </tr>
  {open&&<tr className="model-diagnostics-detail" id={detailId}><td colSpan={6}><pre>{JSON.stringify(row,null,2)}</pre></td></tr>}
 </>;
}
