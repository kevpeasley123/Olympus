import {useEffect,useState,useRef,useId} from "react";
import {loadModelCatalog,loadModelDiagnostics,selectNextModel,useNextModel,type ModelCatalog,type ModelCapability,type ModelRequest} from "../../services/modelRouting";
import {isTauriRuntime} from "../../services/launcher";
const routeNames:Record<ModelCapability,string>={PRIMARY:"SOL",DEEP_REASONING:"ASTRA",CLAUDE_COMPARISON:"CLAUDE"};
const routeDescriptions:Record<ModelCapability,string>={PRIMARY:"Default reasoning",DEEP_REASONING:"Deep reasoning",CLAUDE_COMPARISON:"Explicit comparison"};
export function ModelRouteControl({disabled=false}:{disabled?:boolean}) {
  const [catalog,setCatalog]=useState<ModelCatalog|null>(null),[open,setOpen]=useState(false);
  const next=useNextModel(),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),menuId=useId();
  const desktop=isTauriRuntime();
  useEffect(()=>{if(desktop)void loadModelCatalog().then(setCatalog).catch(()=>{});},[desktop]);
  const routes:ModelCapability[]=catalog?catalog.routes.map(route=>route.capability):desktop?[]:["PRIMARY","DEEP_REASONING","CLAUDE_COMPARISON"];
  const unavailable=disabled||!routes.length;
  useEffect(()=>{if(unavailable)setOpen(false);},[unavailable]);
  useEffect(()=>{
    if(!open)return;
    root.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    document.addEventListener('pointerdown',outside);
    return ()=>document.removeEventListener('pointerdown',outside);
  },[open]);
  const label=routeNames[next]??next;
  return <div className="model-route-control" ref={root} onKeyDown={event=>{
    if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();setOpen(false);trigger.current?.focus();}
    if(open&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();event.stopPropagation();
      const items=Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')??[]);
      const index=items.indexOf(document.activeElement as HTMLButtonElement);
      const target=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;
      items[target]?.focus();
    }
    if(event.key==='Tab')setOpen(false);
  }}>
    <button ref={trigger} type="button" className="model-route-trigger" aria-label={`Reasoning for next answer: ${label}`} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} disabled={unavailable}
      title={desktop?`Reasoning for the next request: ${label}. Resets to Sol after submission.`:'Reasoning selection preview; requests run in the desktop app.'}
      onClick={()=>setOpen(value=>!value)} onKeyDown={event=>{if(!open&&['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();setOpen(true);}}}>
      <span className="model-route-prefix">MODEL · </span>{label}<span aria-hidden="true"> ▾</span>
    </button>
    {open&&<div id={menuId} className="model-route-menu" role="menu" aria-label="Reasoning for next answer">
      {routes.map(capability=><button type="button" role="menuitemradio" aria-checked={next===capability} key={capability} onClick={()=>{selectNextModel(capability);setOpen(false);trigger.current?.focus();}}>
        <strong>{routeNames[capability]??capability}</strong><small>{routeDescriptions[capability]??'Reasoning'}</small>
      </button>)}
      <p>{desktop?'Applies to one request, then returns to Sol.':'Browser preview · reasoning runs in the desktop app.'}</p>
    </div>}
  </div>;
}
export function ModelDiagnostics(){
 const [rows,setRows]=useState<ModelRequest[]>([]);const [error,setError]=useState<string|null>(null);const [catalog,setCatalog]=useState<ModelCatalog|null>(null);
 async function refresh(){try{setCatalog(await loadModelCatalog());setRows(await loadModelDiagnostics());setError(null);}catch{setError("Model diagnostics are available in the desktop app.");}}
 return <details className="model-diagnostics" onToggle={event=>{if(event.currentTarget.open)void refresh();}}><summary>Model diagnostics</summary>
 {catalog&&<p>Brain: {catalog.routes[0].model}<br/>Voice: {catalog.realtime}<br/>Transcription: {catalog.transcription}<br/>Coding driver: {catalog.coding}</p>}
 <button type="button" className="ghost-action" onClick={()=>void refresh()}>Refresh requests</button>
 {error&&<p role="status">{error}</p>}
 <div className="model-diagnostics-list">{rows.map(row=><details key={row.id}><summary>{row.actualModel??`${row.requestedModel} (requested)`} · {row.status}</summary><pre>{JSON.stringify(row,null,2)}</pre></details>)}</div>
 <p>Request metadata only. Costs are not estimated; reported token usage is available above. Deep Analysis is operator-selected and never recursive.</p>
 </details>;
}
