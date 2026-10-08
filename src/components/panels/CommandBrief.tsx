import type {Mission} from '../../services/capabilities';
import {missionTelemetry} from '../../services/pantheonMissions';
import './commandBrief.css';

/** Compact read-only orientation; mission cards own inspection and actions. */
export function CommandBrief({missions,error,loading}:{missions:Mission[];error?:string|null;loading?:boolean}){
 const approvals=missions.filter(m=>m.approval?.required);
 return <section className="command-brief" aria-label="Mission brief">
  <h3>Mission brief</h3>
  <p className="command-brief-summary">{loading?'Reading mission activity…':error?'Mission observations are unavailable.':missions.length?`${missions.length} active ${missions.length===1?'mission':'missions'}.${approvals.length?` ${approvals.length} awaiting approval.`:''}`:'No active missions reported.'}</p>
  {!loading&&!error&&missions.slice(0,2).map(m=><p className="command-brief-line" key={m.id}>{m.title} <span>{missionTelemetry(m).state==='Working'?'is in progress.':`is ${missionTelemetry(m).state.toLowerCase()}.`}</span></p>)}
 </section>;
}
