import {useEffect,useState} from 'react';
import type {Mission} from '../../services/capabilities';
import {inspectConstellationAgent,useAgentHighlight} from '../../services/agentConstellation';
import {MANIFESTED_FIGURES,PANTHEON_FIGURES,agentSessions,sessionClock} from '../../services/pantheonFigureState';
import './pantheonFigures.css';

/**
 * The HTML half of each manifested god: hit target, name plate and session
 * indicator. The scene positions the element and writes `data-figure-state`;
 * the session text comes from the recorded mission, never from the animation.
 */
export function PantheonFigures({missions}:{missions:readonly Mission[]}){
 const highlight=useAgentHighlight();
 const sessions=agentSessions(missions);
 const live=[...sessions.values()].some(s=>s.kind==='active'&&s.startedAt);
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{if(!live)return;setNow(Date.now());const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[live]);
 return <div className="pantheon-figures" role="group" aria-label="Pantheon figures">
  {PANTHEON_FIGURES.filter(f=>MANIFESTED_FIGURES.includes(f.id)).map(f=>{
   const s=sessions.get(f.agent),clock=s?sessionClock(s.startedAt,now):null;
   const status=!s?null:s.kind==='failed'?'Step failed':s.kind==='waiting'?(s.approval?'Awaiting your approval':'Waiting'):clock?`Session active · ${clock}`:'Session active';
   return <button key={f.id} type="button" className="pantheon-figure" data-figure-id={f.id} {...highlight.bind(f.agent)} onClick={()=>inspectConstellationAgent(f.agent)} aria-label={`Inspect ${f.name}, ${f.role}${s?`: ${s.step}, ${status}`:''}`}>
    {s&&<span className="pantheon-figure__session" data-kind={s.kind}><b>{f.name}</b><span>{s.step}</span><small>{status}</small></span>}
    <span className="pantheon-figure__label"><strong>{f.name}</strong><em>{f.role}</em><small>{f.words}</small></span>
   </button>;
  })}
 </div>;
}
