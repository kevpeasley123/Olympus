export interface SourceAccess { actor:string; source:string; success:boolean; at:number; run:string }
let recent:SourceAccess[]=[];
const listeners=new Set<()=>void>();
export function recordSourceAccess(actor:string,source:string,success:boolean,run:string) {
  recent=[{actor,source,success,run,at:performance.now()},...recent].slice(0,40);
  listeners.forEach(fn=>fn());
}
export const accessSnapshot=()=>recent;
export function subscribeAccess(fn:()=>void){listeners.add(fn);return ()=>{listeners.delete(fn);};}
