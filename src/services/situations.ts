import { invoke } from '@tauri-apps/api/core';
export interface Observation {
 threadId:string;situationId:string;summary:string;subject:string;timestamp:number;current:boolean;
 people:{email:string;name:string;role:string}[];relationships:{from:string;to:string;description:string}[];
 details:{kind:string;label:string;value:string;messageId:string;quote:string}[];
 evidenceRefs:{messageId:string;threadId:string;fingerprint:string;timestamp:number}[];
}
export interface ContextRef {sourceId:string;locator:string}
export interface SituationDocumentMeta {origin:'operator-created'|'received'|'local'|'generated'|'referenced';date?:string;description?:string;kind?:'contract'|'quote'|'design'|'invoice'|'photo'|'other';from?:string}
export interface SituationMilestone {id:string;title:string;date:string;state:'planned'|'reported'|'completed'|'verified'|'unknown';workstream:string;entityIds:string[];refs:ContextRef[]}
export interface SituationContext {
 version:1;asOf:string;summary:string;phase:string;coverage:string;
 milestones?:SituationMilestone[];
 sources:{id:string;title:string;path:string;sha256:string;category:string;document?:SituationDocumentMeta}[];
 workstreams:{id:string;title:string;summary:string;nextStep:string;refs:ContextRef[]}[];
 entities:{id:string;name:string;kind:'person'|'organization'|'service'|'unknown';role:string;status:string;workstream:string;notes:string;contacts:string[];refs:ContextRef[]}[];
 relationships:{from:string;to:string;description:string;refs:ContextRef[]}[];
 facts:{label:string;text:string;status:'documented'|'operator context'|'needs confirmation';workstream:string;refs:ContextRef[]}[];
}
export interface Situation {id:string;title:string;state:string;stale:boolean;updatedAt:string;localContext?:SituationContext;briefing:{whereThingsStand?:string;whatChanged?:string;nextMoves?:{threadId:string;explanation:string;suggestedAction:string}[];research?:{title:string;sourceFile?:string;excerpt:string}[]}}
export interface LocalDraft {id:string;situationId:string;threadId:string;revision:number;to:string[];subject:string;body:string;stale?:boolean}
export interface SituationSnapshot {accountId:string;backgroundError?:string|null;enabled:boolean;horizonDays:number;situations:Situation[];observations:Observation[];updates:{id:string;situationId:string;text:string;at:string}[];drafts:LocalDraft[];run:null|{status:string;phase:string;error?:string;finishedAt?:string}}
export const situationsClient={
 snapshot:()=>invoke<SituationSnapshot>('situation_snapshot'),
 refresh:()=>invoke<void>('situation_refresh'),
 background:(enabled:boolean)=>invoke<void>('situation_set_background',{enabled}),
 update:(situationId:string,text:string)=>invoke<void>('situation_update',{request:{situationId,text}}),
 edit:(id:string,action:string,value='')=>invoke<void>('situation_edit',{id,action,value}),
 draft:(situationId:string,threadId:string)=>invoke<LocalDraft>('situation_draft',{request:{situationId,threadId}}),
 save:(request:LocalDraft)=>invoke<void>('situation_save_draft',{request:{id:request.id,revision:request.revision,to:request.to,subject:request.subject,body:request.body}}),
};
export type SituationsClient=typeof situationsClient;
