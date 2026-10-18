import {invoke} from "@tauri-apps/api/core";
import {isTauriRuntime} from "./launcher";
import {loadEngineStatus,type EngineStatus} from "./engines";
import type {GmailStatus} from "./gmail";
import type {ModelCatalog} from "./modelRouting";
export type ManagedService="elevenlabs"|"gmail"|"models";
export interface ManagementClient {available:boolean; engines:()=>Promise<EngineStatus[]>; inspect:(service:ManagedService)=>Promise<string>}
export const managementClient:ManagementClient={
 get available(){return isTauriRuntime()},engines:loadEngineStatus,
 async inspect(service){
  if(!isTauriRuntime())throw Error("Local configuration checks require desktop Olympus.");
  if(service==="elevenlabs"){const s=await invoke<{configured:boolean}>("elevenlabs_status");return s.configured?"Key saved on this device; provider connection not verified.":"No API key saved on this device.";}
  if(service==="gmail"){const s=await invoke<GmailStatus>("gmail_status");return s.account?.enabled?`Saved account: ${s.account.status}. Read-only mailbox scope. This check does not sync mail.`:s.configured?"OAuth client configured; no enabled account.":"Desktop OAuth client not configured.";}
  const s=await invoke<ModelCatalog>("model_routes");return s.routes.map(r=>`${r.label}: ${r.model} / ${r.available?"configured":r.unavailableReason??"unavailable"}`).join("\n");
 }
};
