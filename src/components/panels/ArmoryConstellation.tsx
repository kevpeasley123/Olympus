import type { CapabilitySnapshot } from "../../services/capabilities";
import { armoryPlugins, pluginStatus } from "../../services/armoryPresentation";
import { inspectArmoryCapability } from "../../services/armoryNavigation";

/** Stable adapter stars; edges indicate shared recorded workflow membership. */
export function ArmoryConstellation({capabilities}:{capabilities:CapabilitySnapshot|null}) {
  const plugins=armoryPlugins(capabilities);
  const points=plugins.map((_,i)=>{const angle=i*2.399963,radius=18+Math.sqrt(i+1)*14;return {x:50+Math.cos(angle)*radius*.6,y:50+Math.sin(angle)*radius*.6}});
  const edges=plugins.flatMap((a,i)=>plugins.slice(i+1).flatMap((b,j)=>a.workflows.some(id=>b.workflows.includes(id))?[{a:points[i],b:points[i+j+1],id:`${a.id}/${b.id}`}]:[])).slice(0,12);
  return <div className="armory-constellation" role="group" aria-label={`Plugins constellation: ${capabilities?plugins.length:'unknown'} plugins`}>
    <span className="armory-constellation__label">Plugins <b>{capabilities?plugins.length:'—'}</b></span>
    <div className="armory-constellation__orbit">
      <svg className="architecture-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{edges.map(e=><line key={e.id} x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y}/>)}</svg>
      {plugins.map((plugin,i)=><button key={plugin.id} className="armory-star" style={{left:`${points[i].x}%`,top:`${points[i].y}%`}} data-available={plugin.state==="AVAILABLE"} aria-label={`Inspect plugin: ${plugin.name}. ${pluginStatus(plugin)}`} onClick={()=>inspectArmoryCapability(plugin)}>
        <span className="armory-star__light" aria-hidden="true"/><span className="armory-star__name">{plugin.name}<small>{pluginStatus(plugin)}</small></span>
      </button>)}
    </div>
  </div>;
}
