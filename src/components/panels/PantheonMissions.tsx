import {useEffect, useRef} from 'react';
import type { Mission, CapabilitySnapshot } from '../../services/capabilities';
import { missionTelemetry } from '../../services/pantheonMissions';
import { MissionView } from './MissionView';

export function MissionTargets({missions, selected, onSelect, fallback}: {missions: Mission[]; selected: string | null; onSelect?: (id:string)=>void; fallback:boolean}) {
  return <div className="mission-targets" data-fallback={fallback} data-selected={Boolean(selected)} aria-label="Active mission planets" role="group">
    {missions.map((m,i) => {const t=missionTelemetry(m);return <button key={m.id} data-mission-id={m.id} data-tone={t.tone} className="mission-planet-target" aria-pressed={selected===m.id} aria-label={`Select mission: ${m.title}. ${t.state}. ${t.progressLabel}`} onClick={()=>onSelect?.(m.id)} style={{left:`${i%2 ? 78 : 22}%`,top:`${i%2 ? 70 : 28}%`}}>
      <span className="mission-fallback-body" aria-hidden="true"/><span className="mission-planet-label"><strong>{m.title}</strong><small><i/>{t.state} · {t.progressLabel}</small></span>
    </button>})}
  </div>;
}
export function ActiveMissionList({missions, selected, onSelect, capabilities, onOpen, error, loading}: {missions:Mission[]; selected:string|null; onSelect?:(id:string)=>void; capabilities:CapabilitySnapshot|null; onOpen?:(destination:Mission['destination'])=>void; error?:string|null;loading?:boolean}) {
  const chosen=missions.find(m=>m.id===selected);
  const list=useRef<HTMLElement>(null);
  useEffect(()=>{if(list.current)list.current.scrollTop=0;},[selected]);
  return <section ref={list} className="active-mission-list" aria-label="Active missions">
    <h3>Active missions <span>{loading?'—':missions.length}</span></h3>
    {error && missions.length>0 && <p className="mission-data-note">Mission refresh unavailable · showing the last snapshot.</p>}
    {!missions.length && <p className="mission-data-note">{error ? 'Mission state unavailable.' : loading ? 'Reading mission state…' : 'No active missions reported.'}</p>}
    {missions.map(m=>{const t=missionTelemetry(m);return <button className="active-mission-card" key={m.id} data-tone={t.tone} aria-pressed={m.id===selected} onClick={()=>onSelect?.(m.id)}>
      <span className="mission-card-orb" aria-hidden="true"/><span><strong>{m.title}</strong><small>{t.state}</small>{t.currentStep && <span className="mission-current-step">{t.currentStep}</span>}{t.progress!==null && <span className="mission-step-progress" role="progressbar" aria-label={`${m.title} recorded steps`} aria-valuenow={Math.round(t.progress*100)} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${t.progress*100}%`}}/></span>}<em>{t.progressLabel}</em></span>
    </button>})}
    {chosen && <div className="selected-mission-context"><h4>{chosen.title}</h4><MissionView mission={chosen} capabilities={capabilities} onOpen={onOpen}/><p className="mission-data-note">Deadline not supplied by this workflow.</p></div>}
  </section>;
}
