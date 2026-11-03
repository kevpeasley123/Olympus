import type { GalaxyAsset } from "../../services/pantheonGalaxy";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { accessSnapshot, recordSourceAccess, subscribeAccess } from "../../services/sourceActivity";
import type { Mission } from "../../services/capabilities";

export function InstrumentActivity({missions,assets,onInspect}:{missions:readonly Mission[];assets:readonly GalaxyAsset[];onInspect:(asset:GalaxyAsset)=>void}) {
  const events=useSyncExternalStore(subscribeAccess,accessSnapshot);
  const observed=useRef<Set<string>|null>(null);
  useEffect(()=>{
    const known=observed.current, next=new Set<string>();
    for(const mission of missions) for(const step of mission.steps) {
      if(!step.agent || !step.recorded || !["completed","failed"].includes(step.state))continue;
      for(const tool of step.tools) {
        const id=JSON.stringify([mission.id,step.id,step.recorded,tool]);
        next.add(id);
        if(known && !known.has(id))recordSourceAccess(step.agent,tool,step.state!=="failed",mission.title);
      }
    }
    observed.current=next;
  },[missions]);
  return <details className="instrument-activity"><summary>Agent activity</summary>
    <label>Inspect asset <select defaultValue="" onChange={e=>{const item=assets.find(a=>a.id===e.target.value);if(item)onInspect(item);e.target.value="";}}>
      <option value="">Choose an asset</option>{assets.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}
    </select></label>
    {missions.filter(m=>m.status==="running"||m.status==="waiting").map(m=><p key={m.id}>{m.title} · {m.status}</p>)}
    <ol aria-label="Source access history">{events.map((e,i)=><li key={e.at+"-"+i}>
      {e.actor} → {e.source} · {e.success?"observed":"unavailable"} <small>{e.run}</small>
    </li>)}</ol>
    {!events.length && <p>No observed source interactions in this session.</p>}
  </details>;
}
