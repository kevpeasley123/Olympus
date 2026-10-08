import {invoke} from "@tauri-apps/api/core";
import {useSyncExternalStore} from "react";
import {isTauriRuntime} from "./launcher";
import previewCatalog from "./modelCatalogFixture.json";
export type ModelCapability="PRIMARY"|"DEEP_REASONING"|"CLAUDE_COMPARISON";
export type ModelScope="next"|"chat";
export interface ModelRoute {capability:ModelCapability;provider:string;providerLabel:string;model:string;effort:string;label:string;description:string;available:boolean;unavailableReason:string|null}
export interface ModelSelection {capability:ModelCapability;scope:ModelScope}
export interface ModelCatalog {routes:ModelRoute[];defaultCapability:ModelCapability;selection:ModelSelection|null;realtime:string;transcription:string;coding:string}
export interface ModelRequest {id:string;provider:string;requestedModel:string;actualModel:string|null;capability:string;purpose:string;reasoningEffort:string|null;requestedAt:string;latencyMs:number|null;firstTokenMs:number|null;status:string;fallbackFrom:string|null;escalationReason:string|null;usage:Record<string,unknown>|null;errorCode:string|null}
let selection:ModelSelection={capability:"PRIMARY",scope:"next"};
let catalog:ModelCatalog|null=null;
let loading:Promise<ModelCatalog>|null=null;
let restored=false;
let savingSelection=false;
const listeners=new Set<()=>void>();
const emit=()=>listeners.forEach(listener=>listener());
export function selectNextModel(capability:ModelCapability,scope:ModelScope=selection.scope){selection={capability,scope};emit();}
export function resetModelSelection(){selection={capability:catalog?.defaultCapability??"PRIMARY",scope:"next"};emit();}
export function consumeNextModel(){
 if(savingSelection)throw Error("Model selection is still saving. Try sending again in a moment.");
 const route=catalog?.routes.find(r=>r.capability===selection.capability);
 if(!route?.available)throw Error(route?.unavailableReason??"The selected model is unavailable. Open the model picker to choose a model.");
 const value=selection.capability;
 if(selection.scope==="next")resetModelSelection();
 return value;
}
export function useModelSelection(){return useSyncExternalStore(listener=>{listeners.add(listener);return ()=>{listeners.delete(listener);};},()=>selection);}
export function useNextModel(){return useModelSelection().capability;}
export async function loadModelCatalog():Promise<ModelCatalog>{
 if(loading)return loading;
 loading=(async()=>{
  const value=isTauriRuntime()?await invoke<ModelCatalog>("model_routes"):previewCatalog as ModelCatalog;
  catalog=value;
  if(!restored){selection=value.selection??{capability:value.defaultCapability,scope:"next"};restored=true;emit();}
  return value;
 })();
 try{return await loading;}finally{loading=null;}
}
export async function saveModelSelection(capability:ModelCapability,scope:ModelScope){
 const route=catalog?.routes.find(r=>r.capability===capability);
 if(!route?.available)throw Error(route?.unavailableReason??"This model is unavailable.");
 if(savingSelection)throw Error("Model selection is still saving.");
 savingSelection=true;
 try{
  if(isTauriRuntime())await invoke("save_model_selection",{capability,scope});
  selectNextModel(capability,scope);
 }finally{savingSelection=false;}
}
export const loadModelDiagnostics=()=>invoke<ModelRequest[]>("model_diagnostics");
