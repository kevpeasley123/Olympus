import {invoke} from "@tauri-apps/api/core";
import {isTauriRuntime} from "./launcher";
import type {UsageSnapshot} from "./usage";
export interface UsageClient {available:boolean; read:(provider:string)=>Promise<UsageSnapshot>}
export const usageClient:UsageClient={
 get available(){return isTauriRuntime()},
 async read(provider){
  if(!isTauriRuntime())throw Error("Account readings require desktop Olympus.");
  return invoke<UsageSnapshot>("account_usage_read",{provider});
 }
};
