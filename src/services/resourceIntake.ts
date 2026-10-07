import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./launcher";
import type { SkillDescriptor } from "./capabilities";
export interface ResourceSkill{id:string;name:string;instructions:string;createdAt:string}
export interface ResourceOutline{passages:string[];headings:string[];wordCount:number}
export const INTAKE_CHANGED="olympus-intake-changed";
const SKILLS="olympus.preview.resource-skills.v1",RESOURCES="olympus.preview.resources.v1";
export interface SavedResource{id:string;title:string;body:string;sourceFile:string;createdAt:string;sourceUrl?:string}
export function readPreview<T>(key:string):T[]{try{return JSON.parse(localStorage.getItem(key)??"[]")}catch{return []}}
export const previewResources=()=>readPreview<SavedResource>(RESOURCES);
export async function resourceSkills():Promise<ResourceSkill[]>{return isTauriRuntime()?invoke("resource_skills"):readPreview(SKILLS)}
export async function saveResourceSkill(name:string,instructions:string):Promise<ResourceSkill>{
 if(!name.trim()||!instructions.trim()||new TextEncoder().encode(name).length>160||new TextEncoder().encode(instructions).length>20000)throw Error("Enter a name and instructions (maximum 20 KB).");
 let skill:ResourceSkill;
 if(isTauriRuntime())skill=await invoke("add_resource_skill",{name,instructions});
 else{const all=await resourceSkills();if(all.length>=100)throw Error("Skill limit reached.");if(all.some(s=>s.name.toLowerCase()===name.trim().toLowerCase()))throw Error("A skill with this name already exists.");skill={id:`resource-skill-${crypto.randomUUID()}`,name:name.trim(),instructions:instructions.trim(),createdAt:new Date().toISOString()};localStorage.setItem(SKILLS,JSON.stringify([skill,...all]));}
 window.dispatchEvent(new Event(INTAKE_CHANGED));return skill;
}
export function skillDescriptor(s:ResourceSkill):SkillDescriptor{return {id:s.id,name:s.name,kind:"skill",version:1,instructions:s.instructions,domain:"research",purpose:"User-authored resource analysis instructions",inputs:"An explicitly selected resource",output:"Reusable analysis guidance",effects:"Instructions only; no execution or tool authority",allowedTools:[],usedBy:["olympus"],workflows:["Resource review"],usage:null,usageUnit:null}}
/** Extractive local outline: never labels selected sentences as AI conclusions. */
export function outlineResource(source:string):ResourceOutline{
 const text=source.trim();if(!text)throw Error("Add source text first.");if(new TextEncoder().encode(text).length>180000)throw Error("Source exceeds 180 KB. Use a smaller section.");
 const headings=Array.from(text.matchAll(/^#{1,6}\s+(.+)$/gm),m=>m[1]).slice(0,12);
 const sentences=text.split(/(?<=[.!?])\s+|\n\s*\n/).map(s=>s.trim()).filter(s=>s.length>=35&&s.length<=1200);
 const stop=new Set("about after again also been before being between could from have into more most other over same should some such than that their them there these they this those through under very what when where which while with would your".split(" "));
 const terms=(s:string)=>s.toLowerCase().match(/[a-z]{4,}/g)?.filter(w=>!stop.has(w))??[];
 const counts=new Map<string,number>();for(const w of terms(text))counts.set(w,(counts.get(w)??0)+1);
 const ranked=sentences.map((sentence,index)=>({sentence,index,score:Array.from(new Set(terms(sentence))).reduce((n,w)=>n+Math.log(1+(counts.get(w)??0)),0)/Math.sqrt(Math.max(1,terms(sentence).length))}));
 const passages=ranked.sort((a,b)=>b.score-a.score||a.index-b.index).filter((v,i,a)=>a.findIndex(x=>x.sentence===v.sentence)===i).slice(0,5).sort((a,b)=>a.index-b.index).map(v=>v.sentence);
 return {headings,passages:passages.length?passages:[text.slice(0,1200)],wordCount:text.split(/\s+/).length};
}
export function resourceBody(source:string,outline:ResourceOutline,skill:ResourceSkill|undefined,notes:string){return `## Local outline

Extractive passages selected locally; not an AI summary or verified claims.

${outline.passages.map(s=>`> ${s.replace(/\n/g,"\n> ")}`).join("\n\n")}

${skill?`## Review guidance: ${skill.name}

${skill.instructions}

`:""}${notes.trim()?`## Review notes

${notes.trim()}

`:""}## Original source

${source}`}
export async function saveResource(title:string,body:string,sourceUrl:string,attachment:string|null){
 if(isTauriRuntime())return invoke<string>("write_pantheon_entry",{req:{title,body,sourceType:"article",sourceUrl:sourceUrl||undefined,additionalTags:["resource-capture"],attachments:attachment?[attachment]:[],stance:"unevaluated",origin:"collected"}});
 const id=crypto.randomUUID();const item={id,title,body,sourceUrl:sourceUrl||undefined,sourceFile:`preview/${id}.md`,createdAt:new Date().toISOString()};localStorage.setItem(RESOURCES,JSON.stringify([item,...previewResources()]));window.dispatchEvent(new Event(INTAKE_CHANGED));return item.sourceFile;
}
