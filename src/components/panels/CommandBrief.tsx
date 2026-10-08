import {ArrowUpRight, ChevronRight, ClipboardCheck, ScanLine} from 'lucide-react';

import type {Mission} from '../../services/capabilities';

import {missionTelemetry} from '../../services/pantheonMissions';

import './commandBrief.css';



/** A read-only summary of observed missions; actions only open existing inspection. */

export function CommandBrief({missions,selected,onSelect,onOpen,error,loading}:{missions:Mission[];selected:string|null;onSelect?:(id:string)=>void;onOpen?:(destination:Mission['destination'])=>void;error?:string|null;loading?:boolean}){

 const approvals=missions.filter(m=>m.approval?.required);

 const working=missions.filter(m=>missionTelemetry(m).state==='Working');

 const prioritized=[...missions].sort((a,b)=>Number(Boolean(b.approval?.required))-Number(Boolean(a.approval?.required)));

 return <section className="command-brief" aria-label="Command brief">

  <h3>Command brief</h3>

  <p className="command-brief-summary">{loading?'Reading mission activity…':error?'Mission observations are unavailable.':missions.length?`${missions.length} active ${missions.length===1?'mission':'missions'}. ${approvals.length?`${approvals.length} awaiting approval.`:working.length?'Work is in progress.':'Waiting for a checkpoint.'}`:'No active missions reported.'}</p>

  {!loading&&!error&&missions.slice(0,2).map(m=><p className="command-brief-line" key={m.id}>{m.title} <span>{missionTelemetry(m).state==='Working'?'is in progress.':`is ${missionTelemetry(m).state.toLowerCase()}.`}</span></p>)}

  {!loading&&!error&&<dl className="command-brief-metrics"><div><dt>Active</dt><dd>{missions.length}</dd></div><div><dt>Awaiting approval</dt><dd>{approvals.length}</dd></div><div><dt>Working</dt><dd>{working.length}</dd></div></dl>}

  {!loading&&!error&&missions.length>0&&<div className="command-next-actions"><h3>Next actions</h3>{prioritized.slice(0,2).map(m=>{const t=missionTelemetry(m),Icon=m.approval?.required?ClipboardCheck:ScanLine;return <button key={m.id} onClick={()=>{if(selected!==m.id)onSelect?.(m.id)}}><Icon size={16}/><span><strong>{m.approval?.required?'Review approval':'Review'} · {m.title}</strong><small>{t.state} · {t.progressLabel}</small></span><ChevronRight size={13}/></button>})}{onOpen&&working[0]&&<button onClick={()=>onOpen(working[0].destination)}><ArrowUpRight size={16}/><span><strong>Open {working[0].title}</strong><small>Go to mission workspace</small></span><ChevronRight size={13}/></button>}</div>}

  {!loading&&!error&&!missions.length&&<p className="command-brief-line">Ready for your next request.</p>}

 </section>;

}
