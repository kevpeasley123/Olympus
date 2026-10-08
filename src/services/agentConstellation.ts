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
const highlightSnapshot=()=>{const values=Array.from(highlights.values());return values[values.length-1]??null;};
const subscribeHighlight=(f:()=>void)=>{highlightListeners.add(f);return ()=>{highlightListeners.delete(f)};};
export function useAgentHighlight(){
 const pointer=useRef({}),keyboard=useRef({});
 const active=useSyncExternalStore(subscribeHighlight,highlightSnapshot,highlightSnapshot);
 function set(source:object,id:string|null){
  if(id===null)highlights.delete(source);else{highlights.delete(source);highlights.set(source,id);}
  highlightListeners.forEach(f=>f());
 }
 useEffect(()=>()=>{set(pointer.current,null);set(keyboard.current,null);},[]);
 return {active,bind:(id:string)=>({
  'data-agent-id':id,'data-inspecting':active===id,
  onPointerEnter:()=>set(pointer.current,id),onPointerLeave:()=>set(pointer.current,null),
  onPointerCancel:()=>set(pointer.current,null),
  onFocus:()=>set(keyboard.current,id),onBlur:()=>set(keyboard.current,null),
 })};
}

let workingAgents='';
const activityListeners=new Set<()=>void>();
export const workingAgentSnapshot=()=>workingAgents;
export function publishWorkingAgents(ids:string[]){const next=[...new Set(ids)].sort().join('|');if(next===workingAgents)return;workingAgents=next;activityListeners.forEach(f=>f());}
export function subscribeWorkingAgents(f:()=>void){activityListeners.add(f);return ()=>{activityListeners.delete(f)};}
