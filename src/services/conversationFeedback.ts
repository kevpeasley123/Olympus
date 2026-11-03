import {invoke} from '@tauri-apps/api/core';
import type {BriefItem} from './briefingIntelligence';
import {spokenExcerpt,type AssistantReply} from './assistant';
export interface EmailFeedbackSource {accountId:string;threadId:string;signature:string;revision:number;subject:string}
export interface FeedbackContext {kind:'brief'|'clarification'|'acknowledgment';itemCount:number;sources:EmailFeedbackSource[];pendingMessageId?:string}
export interface FeedbackReply {content:string;feedback?:FeedbackContext|null}
export async function resolveConversationTurn(saved:Promise<boolean>,scope:{id:string;temporary:boolean;active?:()=>boolean;voiceDepth?:import('./voiceContract').VoiceDepth},messageId:string,provider:()=>Promise<AssistantReply>,client:typeof invoke=invoke):Promise<AssistantReply>{
 if(!await saved&&!scope.temporary)throw Error("Your message could not be saved. I haven't updated any understanding.");
 const requireActive=()=>{if(scope.active&&!scope.active())throw Error("Stopped before further interpretation.")};
 requireActive();
 const local=await requestConversationFeedback(scope.id,messageId,scope.temporary,client);
 if(!local){requireActive();return provider();}
 return {...local,model:'Olympus (local)',research:[],...(scope.voiceDepth?{voice:{spokenResponse:spokenExcerpt(local.content,scope.voiceDepth),visualResponse:local.content,proposedActions:[],requiresConfirmation:false,conversationState:'answered' as const}}:{})};
}
export function feedbackForBrief(items:BriefItem[]):FeedbackContext|undefined {
 const sources=items.flatMap(item=>item.emailSource?[item.emailSource]:[]);
 return sources.length?{kind:'brief',itemCount:items.length,sources}:undefined;
}
export async function requestConversationFeedback(conversationId:string|undefined,messageId:string,temporary:boolean,client:typeof invoke=invoke):Promise<FeedbackReply|null>{
 if(temporary||!conversationId)return null;
 return client<FeedbackReply|null>('conversation_feedback',{conversationId,messageId,temporary:false});
}
