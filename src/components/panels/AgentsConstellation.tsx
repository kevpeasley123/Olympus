import {useEffect,useRef,useSyncExternalStore} from 'react';
import {agentConstellationSnapshot,subscribeAgentConstellation,inspectConstellationAgent,useAgentHighlight,workingAgentSnapshot,subscribeWorkingAgents} from '../../services/agentConstellation';
import {pantheonAgents} from '../../services/pantheonAgents';
import {AgentEmblem} from './AgentEmblem';
const positions=[[50,20],[22,50],[76,47],[65,82],[30,83]];
export function AgentsConstellation(){
 const highlight=useAgentHighlight();
 const group=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const element=group.current;if(!element)return;
  let visible=true;
  const refresh=()=>{element.dataset.motionPaused=String(!visible||document.hidden);};
  const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??false;refresh();});
  observer.observe(element);document.addEventListener('visibilitychange',refresh);refresh();
  return()=>{observer.disconnect();document.removeEventListener('visibilitychange',refresh);};
 },[]);
 const catalog=useSyncExternalStore(subscribeAgentConstellation,agentConstellationSnapshot,agentConstellationSnapshot);
 const working=useSyncExternalStore(subscribeWorkingAgents,workingAgentSnapshot,workingAgentSnapshot).split('|');
 const agents=pantheonAgents(catalog);
 return <div ref={group} className="agents-constellation" role="group" aria-label={'Agents constellation: '+agents.length+' roles'}>
  <span className="architecture-label">Agents <b>{catalog?agents.length:'…'}</b></span>
  <svg className="agent-architecture-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{agents.slice(1).map((a,i)=><line style={{display:working.includes(a.id)||working.includes(agents[0].id)?'none':undefined}} key={a.id} x1="50" y1="20" x2={positions[(i+1)%positions.length][0]} y2={positions[(i+1)%positions.length][1]}/>)}</svg>
  {agents.map((agent,i)=><button key={agent.id} className="agent-architecture-star" {...highlight.bind(agent.id)} data-active={agent.kind==="orchestrator"||working.includes(agent.id)} data-placeholder={agent.status==='PLACEHOLDER'} style={{left:positions[i%positions.length][0]+'%',top:positions[i%positions.length][1]+'%'}} aria-label={'Inspect '+agent.name+': '+agent.description+(agent.status==='PLACEHOLDER'?' (placeholder)':'')} onClick={()=>inspectConstellationAgent(agent.id)}>
   <AgentEmblem id={agent.id} size={13}/><span className="agent-architecture-name">{agent.name}<small>{agent.description}{agent.status==='PLACEHOLDER'?' · Placeholder':''}</small></span>
  </button>)}
 </div>;
}
