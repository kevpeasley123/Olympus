import {invoke} from "@tauri-apps/api/core";
export interface AgentHistory {
  count:number;lastAt:string|null;unit:string;
  recent:{id:string;parentRunId:string;question:string;startedAt:string;status:string;version:number}[];
}
export interface CommandRole {
  id:string;name:string;version:number|null;kind:"agent"|"legacy"|"orchestrator";
  status:string;tone:"ready"|"unavailable"|"muted";description:string;role:string;authority:string;sourceScope:string;
  capabilities?:string[];usedBy?:string;skills?:{id:string;name:string}[];
  workflows?:{id:string;name:string;destination:"research"|"projects"}[];peers?:string[];modelStrategy?:string;
  availability?:string;history?:AgentHistory;evidence?:string;
}
export interface CommandCatalog {observedAt:string;orchestrator:CommandRole;agents:CommandRole[]}
/** Inspection only: this client deliberately has no start/cancel/mutation methods. */
export interface CommandCatalogClient {read():Promise<CommandCatalog>}
export const commandCatalog:CommandCatalogClient={read:()=>invoke("command_agent_catalog")};
export interface ResearchInspectionTarget {runId?:string;revision:number}
