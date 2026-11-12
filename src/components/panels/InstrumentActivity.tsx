import {PANTHEON_FIGURES} from "../../services/pantheonFigureState";
import { useReviewHistory } from "../../services/projectReviews";
import type { GalaxyAsset } from "../../services/pantheonGalaxy";
import { useSyncExternalStore } from "react";
import { accessSnapshot, subscribeAccess } from "../../services/sourceActivity";
import type { Mission } from "../../services/capabilities";
import { AgentActivityFeed } from "./AgentActivityFeed";
import { Modal } from "../Modal";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

export function InstrumentActivity({missions,assets,onInspect,vaultStatus}:{vaultStatus:string;missions:readonly Mission[];assets:readonly GalaxyAsset[];onInspect:(asset:GalaxyAsset)=>void}) {
  const reviews=useReviewHistory();
  const latest=reviews[0];
  const events=useSyncExternalStore(subscribeAccess,accessSnapshot);
  const [open,setOpen]=useState(false);
  useEffect(()=>{const show=()=>setOpen(true);window.addEventListener("olympus:open-diagnostics",show);return ()=>window.removeEventListener("olympus:open-diagnostics",show);},[]);
  // The step-by-step record, off the Command scene: opened from the Activity Deck when it is wanted.
  return <Modal open={open} onClose={()=>setOpen(false)} title="Diagnostics" showTitle={false} className="deck-dialog"><header><div><small>Diagnostics</small><h2>Step-by-step record</h2><p>Every recorded step of recent runs, and what each read.{latest && <span className="latest-skill-result"> {latest.project} · {latest.outcome}</span>}</p></div><button type="button" className="armory-close" onClick={()=>setOpen(false)} aria-label="Close diagnostics"><X size={18}/></button></header><div className="deck-dialog-body instrument-activity">
    {latest && <p><button type="button" onClick={()=>window.dispatchEvent(new Event("olympus:open-review"))}>Review #{latest.id} · {latest.detail}</button></p>}
    <AgentActivityFeed />
    <small>{vaultStatus}</small>
    <label>Inspect asset <select defaultValue="" onChange={e=>{const item=assets.find(a=>a.id===e.target.value);if(item)onInspect(item);e.target.value="";}}>
      <option value="">Choose an asset</option>{assets.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}
    </select></label>
    {missions.filter(m=>m.status==="running"||m.status==="waiting").map(m=><p key={m.id}>{m.title} · {m.status}</p>)}
    <ol aria-label="Source access history">{events.map((e,i)=><li key={e.at+"-"+i}>
      {PANTHEON_FIGURES.find(f=>f.agent===e.actor)?.name??e.actor} → {e.source} · {!e.success?"unavailable":e.operation==="cite"?"cited source":"read source"} <small>{e.run}</small>
    </li>)}</ol>
    {!events.length && <p>No observed source interactions in this session.</p>}
  </div></Modal>;
}
