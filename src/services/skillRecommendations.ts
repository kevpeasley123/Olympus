import {invoke} from "@tauri-apps/api/core";
import type {ModelCapability} from "./modelRouting";

export interface SkillRecommendation {skillId:string;name:string;description:string;version:string;source:string;contentHash:string;byteCount:number;reason:string;proposalId:string;expiresAt:number;provider:string;model:string}
export interface SkillReview {task:string;requestId:string;recommendations:SkillRecommendation[]}
let review:SkillReview|null=null;
let settle:((id:string|null|undefined)=>void)|null=null;
let checking:string|null=null;
let generation=0;
const listeners=new Set<()=>void>();
export const skillReviewSnapshot=()=>review;
export const subscribeSkillReview=(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};};
const emit=()=>listeners.forEach(l=>l());
const cancelProposals=(items:SkillRecommendation[],except?:string)=>Promise.all(items.filter(r=>r.proposalId!==except).map(r=>invoke("cancel_delegation_proposal",{proposalId:r.proposalId}).catch(()=>undefined)));

/** null skips guidance; undefined cancels the request; an ID approves one exact proposal. */
export function resolveSkillReview(id:string|null|undefined){
 if(!review||!settle)return;
 if(id&&!review.recommendations.some(r=>r.proposalId===id&&r.expiresAt*1000>Date.now()))return;
 const items=review.recommendations,done=settle;
 review=null;settle=null;checking=null;emit();
 void cancelProposals(items,id??undefined);
 done(id);
}
export function cancelSkillReview(requestId:string):boolean{
 if(checking!==requestId&&review?.requestId!==requestId)return false;
 generation++;checking=null;
 resolveSkillReview(undefined);
 return true;
}
export async function requestSkillReview(task:string,capability:ModelCapability,requestId:string):Promise<string|null>{
 if(checking||review)throw Error("Another skill review is waiting for a decision.");
 const current=++generation;checking=requestId;
 let items:SkillRecommendation[];
 try{items=await invoke("recommend_resource_skills",{task,capability,requestId});}
 catch(error){if(current===generation)checking=null;throw error;}
 if(current!==generation){void cancelProposals(items);throw Error("Request cancelled before skill review.");}
 if(!items.length){checking=null;return null;}
 const selected=await new Promise<string|null|undefined>(resolve=>{settle=resolve;review={task,requestId,recommendations:items};emit();});
 if(selected===undefined)throw Error("Request cancelled. No skill was applied and no assistant request was sent.");
 return selected;
}
