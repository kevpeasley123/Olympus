import {invoke} from "@tauri-apps/api/core";
export interface PlanConnection {available:boolean;phase:string;message:string;generationEnabled:boolean;synthetic?:boolean}
export type PlanClient=(action:string)=>Promise<PlanConnection>;
export const nativePlanClient:PlanClient=action=>invoke("chatgpt_plan_action",{action,registration:null});
