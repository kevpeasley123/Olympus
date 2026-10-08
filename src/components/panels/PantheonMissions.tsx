import {useEffect, useRef, useSyncExternalStore} from 'react';
import type { Mission, CapabilitySnapshot } from '../../services/capabilities';
import { missionTelemetry } from '../../services/pantheonMissions';
import { MissionView } from './MissionView';

// Shared inspection is transient and independent of the selected mission.
const inspectionSources=new Map<string,string>();
const inspectionListeners=new Set<()=>void>();
let inspectedIds:readonly string[]=[];
const subscribeInspection=(listener:()=>void)=>{inspectionListeners.add(listener);return ()=>{inspectionListeners.delete(listener)};};
function setInspection(source:string,id:string|null){
  if(id===null)inspectionSources.delete(source);else inspectionSources.set(source,id);
  inspectedIds=[...new Set(inspectionSources.values())];
  inspectionListeners.forEach(listener=>listener());
}
function useMissionInspection(surface:string){
  const ids=useSyncExternalStore(subscribeInspection,()=>inspectedIds,()=>inspectedIds);
  useEffect(()=>()=>{setInspection(surface+'-pointer',null);setInspection(surface+'-focus',null);},[surface]);
  return (id:string)=>({
    'data-inspecting':ids.includes(id),
    onPointerEnter:()=>setInspection(surface+'-pointer',id),
    onPointerLeave:()=>setInspection(surface+'-pointer',null),
    onFocus:()=>setInspection(surface+'-focus',id),
    onBlur:()=>setInspection(surface+'-focus',null),
  });
}

export function MissionTargets({missions, selected, onSelect, fallback}: {missions: Mission[]; selected: string | null; onSelect?: (id:string)=>void; fallback:boolean}) {
  const inspect=useMissionInspection("planet");
  return <div className="mission-targets" data-fallback={fallback} data-selected={Boolean(selected)} aria-label="Active mission planets" role="group">
    {missions.map((m,i) => {const t=missionTelemetry(m);return <button {...inspect(m.id)} key={m.id} data-mission-id={m.id} data-tone={t.tone} className="mission-planet-target" aria-pressed={selected===m.id} aria-label={`Select mission: ${m.title}. ${t.state}. ${t.progressLabel}`} onClick={()=>onSelect?.(m.id)} style={{left:`${i%2 ? 78 : 22}%`,top:`${i%2 ? 70 : 28}%`}}>
      <span className="mission-fallback-body" aria-hidden="true"/><span className="mission-planet-label"><strong>{m.title}</strong><small><i/>{t.state} · {t.progressLabel}</small></span>
    </button>})}
  </div>;
}
export function ActiveMissionList({missions, selected, onSelect, capabilities, onOpen, error, loading}: {missions:Mission[]; selected:string|null; onSelect?:(id:string)=>void; capabilities:CapabilitySnapshot|null; onOpen?:(destination:Mission['destination'])=>void; error?:string|null;loading?:boolean}) {
  const inspect=useMissionInspection("directory");
  const chosen=missions.find(m=>m.id===selected);
  const list=useRef<HTMLElement>(null);
  useEffect(()=>{if(list.current)list.current.scrollTop=0;},[selected]);
  return <section ref={list} className="active-mission-list" aria-label="Active missions">
    <h3>Active missions <span>{loading?'—':missions.length}</span></h3>
    {error && missions.length>0 && <p className="mission-data-note">Mission refresh unavailable · showing the last snapshot.</p>}
    {!missions.length && <p className="mission-data-note">{error ? 'Mission state unavailable.' : loading ? 'Reading mission state…' : 'No active missions reported.'}</p>}
    {missions.map(m=>{const t=missionTelemetry(m);return <button {...inspect(m.id)} data-mission-card-id={m.id} className="active-mission-card" key={m.id} data-tone={t.tone} aria-pressed={m.id===selected} onClick={()=>onSelect?.(m.id)}>
      <span className="mission-card-orb" aria-hidden="true"/><span><strong>{m.title}</strong><small>{t.state}</small>{t.currentStep && <span className="mission-current-step">{t.currentStep}</span>}{t.progress!==null && <span className="mission-step-progress" role="progressbar" aria-label={`${m.title} recorded steps`} aria-valuenow={Math.round(t.progress*100)} aria-valuemin={0} aria-valuemax={100}><span style={{width:`${t.progress*100}%`}}/></span>}<em>{t.progressLabel}</em></span>
    </button>})}
    {chosen && <div className="selected-mission-context"><h4>{chosen.title}</h4><MissionView mission={chosen} capabilities={capabilities} onOpen={onOpen}/><p className="mission-data-note">Deadline not supplied by this workflow.</p></div>}
  </section>;
}
