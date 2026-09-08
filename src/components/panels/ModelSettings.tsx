import {useEffect,useState} from "react";
import {loadModelCatalog,loadModelDiagnostics,selectNextModel,useNextModel,type ModelCatalog,type ModelCapability,type ModelRequest} from "../../services/modelRouting";
import {isTauriRuntime} from "../../services/launcher";
export function ModelRouteControl({disabled=false}:{disabled?:boolean}) {
  const [catalog,setCatalog]=useState<ModelCatalog|null>(null);const next=useNextModel();
  useEffect(()=>{if(isTauriRuntime())void loadModelCatalog().then(setCatalog).catch(()=>{});},[]);
  if(!catalog)return null;
  return <label className="model-route-control">Next answer <select aria-label="Reasoning for next answer" disabled={disabled} value={next} onChange={e=>selectNextModel(e.target.value as ModelCapability)}>
    {catalog.routes.map(route=><option key={route.capability} value={route.capability}>{route.label}</option>)}
  </select>{next!=="PRIMARY"&&<small>One request · returns to Sol</small>}</label>;
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
