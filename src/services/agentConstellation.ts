import {useEffect,useRef,useSyncExternalStore} from 'react';
import type {CommandCatalog} from './commandAgents';
let catalog:CommandCatalog|null=null;
const subscribers=new Set<()=>void>();
const inspectors=new Set<(id:string)=>void>();
export const agentConstellationSnapshot=()=>catalog;
export function publishAgentConstellation(value:CommandCatalog|null){catalog=value;subscribers.forEach(f=>f());}
export function subscribeAgentConstellation(f:()=>void){subscribers.add(f);return ()=>{subscribers.delete(f)};}
export function inspectConstellationAgent(id:string){inspectors.forEach(f=>f(id));}
export function onConstellationAgent(f:(id:string)=>void){inspectors.add(f);return ()=>{inspectors.delete(f)};}

// Transient inspection is separate from selection and execution authority.
const highlights=new Map<object,string>();
const highlightListeners=new Set<()=>void>();
let highlighted:string|null=null;
const highlightSnapshot=()=>highlighted;
const subscribeHighlight=(f:()=>void)=>{highlightListeners.add(f);return ()=>{highlightListeners.delete(f)};};
/** The agent under the pointer or keyboard focus anywhere (Armory row, god, constellation); read per frame by the scene. */
export const agentHighlightSnapshot=highlightSnapshot;
export function setAgentHighlight(source:object,id:string|null){
 highlights.delete(source);if(id!==null)highlights.set(source,id);
 const values=Array.from(highlights.values());highlighted=values[values.length-1]??null;
 highlightListeners.forEach(f=>f());
}
export function useAgentHighlight(){
 const pointer=useRef({}),keyboard=useRef({});
 const active=useSyncExternalStore(subscribeHighlight,highlightSnapshot,highlightSnapshot);
 useEffect(()=>()=>{setAgentHighlight(pointer.current,null);setAgentHighlight(keyboard.current,null);},[]);
 return {active,bind:(id:string)=>({
  'data-agent-id':id,'data-inspecting':active===id,
  onPointerEnter:()=>setAgentHighlight(pointer.current,id),onPointerLeave:()=>setAgentHighlight(pointer.current,null),
  onPointerCancel:()=>setAgentHighlight(pointer.current,null),
  onFocus:()=>setAgentHighlight(keyboard.current,id),onBlur:()=>setAgentHighlight(keyboard.current,null),
 })};
}

let workingAgents='';
const activityListeners=new Set<()=>void>();
export const workingAgentSnapshot=()=>workingAgents;
export function publishWorkingAgents(ids:string[]){const next=[...new Set(ids)].sort().join('|');if(next===workingAgents)return;workingAgents=next;activityListeners.forEach(f=>f());}
export function subscribeWorkingAgents(f:()=>void){activityListeners.add(f);return ()=>{activityListeners.delete(f)};}
