import {invoke} from "@tauri-apps/api/core";
import {useSyncExternalStore} from "react";
export type ModelCapability="PRIMARY"|"DEEP_REASONING"|"CLAUDE_COMPARISON";
export interface ModelRoute {capability:ModelCapability;provider:string;model:string;effort:string;label:string}
export interface ModelCatalog {routes:ModelRoute[];realtime:string;transcription:string;coding:string}
export interface ModelRequest {id:string;provider:string;requestedModel:string;actualModel:string|null;capability:string;purpose:string;reasoningEffort:string|null;requestedAt:string;latencyMs:number|null;firstTokenMs:number|null;status:string;fallbackFrom:string|null;escalationReason:string|null;usage:Record<string,unknown>|null;errorCode:string|null}
let next:ModelCapability="PRIMARY";
const listeners=new Set<()=>void>();
export function selectNextModel(value:ModelCapability){next=value;listeners.forEach(listener=>listener());}
export function consumeNextModel(){const value=next;selectNextModel("PRIMARY");return value;}
export function useNextModel(){return useSyncExternalStore(listener=>{listeners.add(listener);return ()=>{listeners.delete(listener);};},()=>next);}
export const loadModelCatalog=()=>invoke<ModelCatalog>("model_routes");
export const loadModelDiagnostics=()=>invoke<ModelRequest[]>("model_diagnostics");
