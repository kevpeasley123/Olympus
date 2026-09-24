import {invoke} from "@tauri-apps/api/core";
export interface AgentDefinition {
  id:string;version:number;name:string;purpose:string;handler:string;instructions:string;inputSchema:unknown;outputSchema:unknown;
  skills:string[];allowedSources:string[];capabilities:string[];prohibitedEffects:string[];peers:string[];
  maxClarifications:number;modelStrategy:{route:string;requestedModel:string;reasoningEffort:string;fallback:null};evidenceRequirements:string;
}
export interface Citation {sourceId:string;fingerprint:string;quote:string}
export interface Claim {id:string;text:string;evidence:Citation[]}
export interface Finding {claimId:string;status:"SUPPORTED"|"CONTRADICTED"|"INSUFFICIENT";explanation:string;evidence:Citation[]}
export interface ResearchOutput {claims:Claim[];contradictions:string[];unanswered:string[]}
export interface VerificationOutput {findings:Finding[];clarification:null|{question:string;claimIds:string[]}}
export interface Source {id:string;fingerprint:string;checkedAt:string;source:{sourceFile:string;title:string;stance:string;excerpt:string;truncated:boolean;origin:string|null;sourceDate:string|null}}
export interface Endpoint {agent:string;version:number;run:string}
export interface AgentMessage {
  id:string;sender:Endpoint;recipient:Endpoint;graph:string;parentRun:string;correlation:string;round:number;at:string;deadline:string;
  remainingRequests:number;evidence:string[];requestedAction:string;expectedResponse:string;
  packet:{type:"EvidencePacket"|"ClarificationRequest"|"ClarificationResponse"|"VerificationResult";data:unknown};
}
export interface ChildRun {
  id:string;parentRun:string;definition:AgentDefinition;definitionFingerprint:string;round:number;status:string;startedAt:string|null;finishedAt:string|null;
  input:unknown;output:ResearchOutput|VerificationOutput|null;
  request:null|{id:string;provider:string;requestedModel:string;actualModel:string|null;status:string;requestedAt:string;latencyMs:number|null;usage:unknown;errorCode:string|null};error:string|null;
}
export interface RunSummary {id:string;question:string;status:string;startedAt:string;agentIds:string[]}
export interface ResearchRun {
  id:string;graph:string;question:string;status:string;startedAt:string;finishedAt:string|null;deadline:string;definition:unknown;
  sources:Source[];agents:ChildRun[];messages:AgentMessage[];events:{sequence:number;at:string;node:string;state:string;detail:string}[];
  brief:null|{supported:{claim:Claim;verification:Finding}[];contradicted:{claim:Claim;verification:Finding}[];insufficient:{claim:Claim;verification:Finding}[];notice:string};
  error:string|null;evaluation:unknown;
}
export interface AgentCatalog {
  executable:AgentDefinition[];availability:{readyToAttempt:boolean;reason:string|null;providerAccess:string;checkedAt:string};
  evaluation:{recordedParentRuns:number;quality:string};codingDelegate:{name:string;implementation:string;version:number|null;versionNote:string;model:string;skills:string[];sources:string;capabilities:string;prohibitedEffects:string;graphs:string[];availability:string;recordedRuns:number;completedRuns:number;operationalStatus:string;location:string};
  orchestrator:{id:string;name:string;role:string};documentedCandidates:string[];externalRoles:string[];documentationNote:string;
  graph:{id:string;nodes:{id:string;kind:string;dependsOn:string[];maxIterations:number}[]};
  skills:{id:string;version:number;purpose:string;implementation:string;inputSchema:unknown;outputSchema:unknown;allowedCapabilities:string[];prohibitedEffects:string[];evidenceRequirements:string;loopBudget:number;successCriteria:string}[];
}
export interface ResearchClient {
  catalog():Promise<AgentCatalog>;list():Promise<RunSummary[]>;inspect(id:string):Promise<ResearchRun>;
  start(id:string,question:string):Promise<ResearchRun>;cancel(id:string):Promise<void>;
}
export const researchVerification:ResearchClient={
  catalog:()=>invoke("research_agent_catalog"),list:()=>invoke("list_research_verifications"),inspect:id=>invoke("inspect_research_verification",{id}),
  start:(id,question)=>invoke("start_research_verification",{request:{id,question}}),cancel:id=>invoke("cancel_research_verification",{id}),
};
