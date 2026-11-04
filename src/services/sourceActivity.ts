export interface SourceAccess { actor:string; source:string; sourceId?:string; operation:"read"|"cite"; success:boolean; at:number; run:string }
let recent:SourceAccess[]=[];
const listeners=new Set<()=>void>();
export function recordSourceAccess(actor:string,source:string,success:boolean,run:string,operation:"read"|"cite"="read",sourceId?:string) {
  recent=[{actor,source,success,run,operation,sourceId,at:performance.now()},...recent].slice(0,40);
  listeners.forEach(fn=>fn());
}
export const accessSnapshot=()=>recent;
export function subscribeAccess(fn:()=>void){listeners.add(fn);return ()=>{listeners.delete(fn);};}


// Each session observes the immutable citations in all recent mission records,
// including a child whose parent completed between two polls.
export function missionCitationObserver(started=Date.now()) {
  const seen=new Set<string>();
  return (missions:readonly import("./capabilities").Mission[])=>{
    for(const mission of missions)for(const cite of mission.citations??[]){
      if(!(Date.parse(cite.at)>=started))continue;
      const id=JSON.stringify([mission.id,cite.child,cite.file,cite.fingerprint]);
      if(seen.has(id))continue;
      seen.add(id);
      const file=cite.file.replace(/\\/g,"/");
      recordSourceAccess(cite.actor,file,true,mission.id,"cite","note:"+file);
    }
  };
}
