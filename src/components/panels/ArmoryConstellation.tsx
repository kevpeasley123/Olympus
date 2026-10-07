import type { CapabilitySnapshot } from "../../services/capabilities";
import { armoryPlugins, pluginStatus } from "../../services/armoryPresentation";
import { inspectArmoryCapability } from "../../services/armoryNavigation";
/** One stable, inspectable star per adapter; never mixes decorative dust into counts. */
export function ArmoryConstellation({capabilities}:{capabilities:CapabilitySnapshot|null}){
 const plugins=armoryPlugins(capabilities);
 if(!capabilities)return null;
 return <div className="armory-constellation" role="group" aria-label={`Plugins constellation: ${plugins.length} plugins`}>
  <span className="armory-constellation__label">Plugins <b>{plugins.length}</b></span>
  <div className="armory-constellation__orbit">{plugins.map((plugin,i)=>{
   const angle=i*2.399963, radius=18+Math.sqrt(i+1)*14;
   return <button key={plugin.id} className="armory-star" style={{left:`${50+Math.cos(angle)*radius*.6}%`,top:`${50+Math.sin(angle)*radius*.6}%`}} data-available={plugin.state==="AVAILABLE"} aria-label={`Inspect plugin: ${plugin.name}. ${pluginStatus(plugin)}`} onClick={()=>inspectArmoryCapability(plugin)}>
    <span className="armory-star__light" aria-hidden="true"/><span className="armory-star__name">{plugin.name}<small>{pluginStatus(plugin)}</small></span>
   </button>;
  })}</div>
 </div>;
}
