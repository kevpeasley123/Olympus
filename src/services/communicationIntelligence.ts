import { invoke } from '@tauri-apps/api/core';
export interface EvidenceRef {messageId:string;threadId:string;fingerprint:string;timestamp:number}
export interface BriefItem {
 threadId:string;subject:string;sender:string;
 assessment?:{evidenceState:string;missingContextReason:string|null;attention:string;priority:string};stopReason?:string;
 triage:{attention:string;summary:string;reasonCodes:string[];evidenceRefs:EvidenceRef[]};
 summary:{whatHappened:string;whatChanged:string;whatMatters:string;likelyNextMove?:string;evidenceRefs:EvidenceRef[]};
 project:{state:string;reason:string;ambiguity:boolean;suggestedProjects:{name:string;source:string;fingerprint:string}[];method?:string;iterations?:{iteration:number;source:string;stopReason:string;matches:unknown[]}[]};
 recommendation:{disposition:string;guidance:string;priority:string;evidenceRefs:EvidenceRef[]};
}
export interface IntelligenceRun {feedbackCount?:number;model?:string|null;usage?:unknown[];selectedThreads?:number;loop?:{passes:number;maxPasses:number};id:string;graph:string;status:string;startedAt:string;finishedAt:string|null;durationMs:number|null;days:number;stale:boolean;error:string|null;items:BriefItem[];snapshot?:{cachedThreads:number;candidateMessages:number};skills:unknown[];definition:{id:string;kind:string;dependsOn:string[];maxIterations:number}[]}
export interface WorkflowNode {id:string;kind:string;dependsOn:string[];maxIterations:number}
export interface WorkflowDescriptor {id:string;name:string;version:number;purpose:string;trigger:string;completion:string;recovery:string;allowedCapabilities:string[];prohibitedEffects:string[];execution:string;loop:string;definition:WorkflowNode[];skills:unknown[];nodeSkills:Record<string,string[]>}
export interface RunEvent {sequence?:number;node:string;state:string;at:string;result:unknown}
export interface InspectionPage {run:IntelligenceRun & {workflow?:WorkflowDescriptor;traceVersion?:number;definitionFingerprint?:string;buildVersion?:string};events:RunEvent[];through:number;next:number;hasMore:boolean}
export const intelligenceClient={
 list:(days:number)=>invoke<IntelligenceRun[]>('communication_runs',{days}),
 analyze:(days:number)=>invoke<IntelligenceRun>('analyze_communications',{request:{id:crypto.randomUUID(),days}}),
 events:(id:string)=>invoke<RunEvent[]>('communication_run_events',{id}),
 workflow:()=>invoke<WorkflowDescriptor>('communication_workflow'),
 inspect:(id:string,after=0,through?:number)=>invoke<InspectionPage>('inspect_communication_run',{request:{id,after,through:through??null}}),
 feedback:(id:string,threadId:string,event:'opened'|'false_response'|'false_deadline'|'project_dismissed'|'useful'|'incorrect'|'missed_needs_me')=>invoke<void>('communication_feedback',{id,threadId,event}),
};
export type IntelligenceClient=typeof intelligenceClient;
