/** Navigation only. A destination explicitly owns the return callback. */
export type ManagementDestination = "voice" | "gmail" | "models" | "armory";
export interface ManagementHandoff {target:ManagementDestination; returnToUsage:()=>void}
const listeners=new Set<(request:ManagementHandoff)=>void>();
export function onManagementHandoff(listener:(request:ManagementHandoff)=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export function handoffManagement(request:ManagementHandoff){listeners.forEach(listener=>listener(request));}
