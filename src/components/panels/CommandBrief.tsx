import {EmailAttentionBrief} from './EmailAttentionBrief';
import type {Mission} from '../../services/capabilities';
import {missionTelemetry} from '../../services/pantheonMissions';
import {useSyncExternalStore} from 'react';
import {agentEventsSnapshot,subscribeAgentEvents} from '../../services/agentEvents';
import {skillRunsSnapshot,subscribeSkillRuns} from '../../services/skillRuns';
import {buildDeck,deckStages} from '../../services/activityDeck';
import './commandBrief.css';

/** Compact read-only orientation; mission cards own inspection and actions. */
export function CommandBrief({missions,error,loading}:{missions:Mission[];error?:string|null;loading?:boolean}){
 const approvals=missions.filter(m=>m.approval?.required);
 // The operation the Activity Deck is showing, as context for the conversation: what was asked and where it stands.
 const {runs,skills}=useSyncExternalStore(subscribeSkillRuns,skillRunsSnapshot);
 const deck=buildDeck(runs,useSyncExternalStore(subscribeAgentEvents,agentEventsSnapshot),skills);
 const operation=deck.operation?.status==='running'?deck.operation:null,stages=deckStages(deck);
 return <section className="command-brief" aria-label="Mission brief">
  <h3>Mission brief</h3>
  {operation&&<div className="command-brief-operation">
   <strong>{operation.title}</strong><p>{operation.line}</p>
   {operation.progress&&<><span className="command-brief-progress-label">Progress<b>{operation.progress.done} of {operation.progress.total} stages</b></span><span className="deck-bar" data-measured role="progressbar" aria-valuemin={0} aria-valuemax={operation.progress.total} aria-valuenow={operation.progress.done}><i style={{width:`${operation.progress.done/operation.progress.total*100}%`}}/></span></>}
   {stages.length>0&&<ol aria-label="Current status">{stages.map(stage=><li key={stage.label} data-state={stage.state}>{stage.label}</li>)}</ol>}
  </div>}
  {!(operation&&!missions.length&&!loading&&!error)&&<p className="command-brief-summary">{loading?'Reading mission activity…':error?'Mission observations are unavailable.':missions.length?`${missions.length} active ${missions.length===1?'mission':'missions'}.${approvals.length?` ${approvals.length} awaiting approval.`:''}`:'No active missions reported.'}</p>}
  {!loading&&!error&&missions.slice(0,2).map(m=><p className="command-brief-line" key={m.id}>{m.title} <span>{missionTelemetry(m).state==='Working'?'is in progress.':`is ${missionTelemetry(m).state.toLowerCase()}.`}</span></p>)}
  <EmailAttentionBrief/>
 </section>;
}
