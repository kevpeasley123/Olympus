import {invoke} from "@tauri-apps/api/core";
export interface AuditEvidence {
  source:{title:string;sourceFile:string;stance:string;excerpt:string;truncated:boolean;fingerprint:string};
  fileFingerprint:string;checkedAt:string;authority:string;freshness:string;
}
export interface AuditHealth {runId:string;sourceFile:string;state:string;checkedAt:string}
export interface AuditRun {
  id:string;graph:string;topic:string;status:string;startedAt:string;finishedAt:string|null;error:string|null;
  route:{id:string;primary:string[];supplementary:string[];cannotOverride:string[]};
  definition:{id:string;kind:string;dependsOn:string[];maxIterations:number}[];
  report:null|{evidence:AuditEvidence[];findings:{kind:string;message:string;evidenceRefs:string[];proposal:string}[];
    priorHealth:AuditHealth[];reviews:{id:string;project:string;phase:string;updatedAt:string}[];
    errors:string[];outcome:string;epistemicState:string;verification:string};
}
export interface AuditDetail {run:AuditRun;events:{sequence:number;node:string;state:string;detail:string;at:string}[];currentHealth:AuditHealth[]}
export interface AuditClient {list():Promise<AuditRun[]>;start(id:string,topic:string):Promise<AuditRun>;inspect(id:string):Promise<AuditDetail>}
export const knowledgeAudit:AuditClient={
  list:()=>invoke("list_knowledge_audits"),
  start:(id,topic)=>invoke("start_knowledge_audit",{request:{id,topic}}),
  inspect:id=>invoke("inspect_knowledge_audit",{id}),
};
