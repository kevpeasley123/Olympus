import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import type {Mission} from '../../services/capabilities';
import {inspectConstellationAgent,useAgentHighlight} from '../../services/agentConstellation';
import {MANIFESTED_FIGURES,PANTHEON_FIGURES,agentSessions,sessionClock} from '../../services/pantheonFigureState';
import {SKINS,SKIN_PICKER,pantheonSkin,setPantheonSkin,subscribePantheonSkin} from '../../services/pantheonSkins';
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
   return <button key={f.id} type="button" className="pantheon-figure" data-figure-id={f.id} data-side={f.station[0]>0?"left":"right"} {...highlight.bind(f.agent)} onClick={()=>inspectConstellationAgent(f.agent)} aria-label={`Inspect ${f.name}, ${f.role}${s?`: ${s.step}, ${status}`:''}`}>
    {s&&<span className="pantheon-figure__session" data-kind={s.kind}><b>{f.name}</b><span>{s.step}</span><small>{status}</small></span>}
    <span className="pantheon-figure__label"><strong>{f.name}</strong><em>{f.role}</em></span>
   </button>;
  })}
  {SKIN_PICKER&&<SkinPicker/>}
 </div>;
}

/**
 * Evaluation only (while a skin is being chosen, in dev builds, or with VITE_PANTHEON_SKIN_PICKER=1): a small
 * dot in the scene's corner that opens the skin list, and closes on a choice, Escape or a click elsewhere.
 */
function SkinPicker(){
 const skin=useSyncExternalStore(subscribePantheonSkin,pantheonSkin,pantheonSkin);
 const [open,setOpen]=useState(false);
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!open)return;
  const away=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};
  document.addEventListener('pointerdown',away);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',away);document.removeEventListener('keydown',escape);};
 },[open]);
 return <div ref={root} className="pantheon-skin-picker" data-open={open}>
  <button type="button" className="pantheon-skin-picker__toggle" aria-expanded={open} aria-label="Pantheon skin" title="Skin" onClick={()=>setOpen(o=>!o)}/>
  {open&&<div className="pantheon-skin-picker__list" role="group" aria-label="Pantheon skin (evaluation)">{SKINS.map(s=><button key={s.id} type="button" aria-pressed={skin===s.id} onClick={()=>{setPantheonSkin(s.id);setOpen(false);}}>{s.name}</button>)}</div>}
 </div>;
}
