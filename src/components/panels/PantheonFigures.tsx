import {useEffect,useState,useSyncExternalStore} from 'react';
import type {Mission} from '../../services/capabilities';
import {inspectConstellationAgent,useAgentHighlight} from '../../services/agentConstellation';
import {MANIFESTED_FIGURES,PANTHEON_FIGURES,agentSessions,sessionClock} from '../../services/pantheonFigureState';
import {SKINS,SKIN_PICKER,pantheonSkin,setPantheonSkin,subscribePantheonSkin} from '../../services/pantheonSkins';
import './pantheonFigures.css';

/**
 * The HTML half of each manifested god: hit target, name plate and session
 * indicator. The scene positions the element and writes `data-figure-state`;
 * the session text comes from the recorded mission, never from the animation.
 * The hover card's state line is read from that attribute by CSS, so it
 * names the state the scene is actually showing.
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
   return <button key={f.id} type="button" className="pantheon-figure" data-figure-id={f.id} data-side={f.station[0]>0?"left":"right"} {...highlight.bind(f.agent)} onClick={()=>inspectConstellationAgent(f.agent)} aria-label={`Inspect ${f.name}, ${f.role}${s?`: ${s.step}, ${status}`:''}`}>
    {s&&<span className="pantheon-figure__session" data-kind={s.kind}><b>{f.name}</b><span>{s.step}</span><small>{status}</small></span>}
    <span className="pantheon-figure__label"><strong>{f.name}</strong><em>{f.role}</em><small>{f.words}</small></span>
    <span className="pantheon-figure__card" aria-hidden="true"><b>{f.name}</b><span>{f.role}</span><small className="pantheon-figure__state"/></span>
   </button>;
  })}
  {SKIN_PICKER&&<SkinPicker/>}
 </div>;
}

/** Evaluation only (while a skin is being chosen, in dev builds, or with VITE_PANTHEON_SKIN_PICKER=1): compares the statue skins in place. */
function SkinPicker(){
 const skin=useSyncExternalStore(subscribePantheonSkin,pantheonSkin,pantheonSkin);
 return <div className="pantheon-skin-picker" role="group" aria-label="Pantheon skin (evaluation)"><span>Skin</span>{SKINS.map(s=><button key={s.id} type="button" aria-pressed={skin===s.id} onClick={()=>setPantheonSkin(s.id)}>{s.name}</button>)}</div>;
}
