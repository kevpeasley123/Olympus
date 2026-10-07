import type { Capability } from "./capabilities";
const listeners=new Set<(item:Capability)=>void>();
export function inspectArmoryCapability(item:Capability){listeners.forEach(listener=>listener(item));}
export function onArmoryInspection(listener:(item:Capability)=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
