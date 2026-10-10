import {invoke} from "@tauri-apps/api/core";
import {isTauriRuntime} from "./launcher";

export interface MemorySource {
  record: {id:string;path:string;title:string;kind:string;revision:string;provisional:boolean;status:string;sourceDate:string|null;observedAt:string|null;recordedAt:string|null;sourceSession:string|null;warnings:string[]};
  heading:string;excerpt:string;reason:string;start:number;end:number;truncated:boolean;
}
export interface MemoryPacket {
  policy:string;status:string;scope:string[];generation:number;indexedAt:string|null;
  sources:MemorySource[];warnings:string[];truncated:boolean;byteLimit:number;
}
export async function loadMemoryEvidence(requestId:string):Promise<MemoryPacket|null> {
  if(!isTauriRuntime())return null;
  return invoke<MemoryPacket|null>("memory_request_evidence",{requestId});
}
