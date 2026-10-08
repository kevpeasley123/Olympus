import {publishAgentConstellation,onConstellationAgent,useAgentHighlight,publishWorkingAgents} from "../../services/agentConstellation";
import { pantheonAgents } from "../../services/pantheonAgents";
import { AgentEmblem } from "./AgentEmblem";
import { ResourceIntake } from "./ResourceIntake";
import { onArmoryInspection } from "../../services/armoryNavigation";
import { useEffect, useState, useRef } from "react";
import { ArrowUpRight, CircleDot, Plug, Sparkles, X, ChevronRight, ShieldCheck, Plus } from "lucide-react";
import { Modal } from "../Modal";
import { commandCatalog, type CommandCatalog, type CommandRole } from "../../services/commandAgents";
import type { CapabilitySnapshot, MissionSnapshot, Mission, Capability } from "../../services/capabilities";
import { armoryPlugins, liveOperations, pluginStatus } from "../../services/armoryPresentation";
import { isTauriRuntime } from "../../services/launcher";
import fixture from "../../services/commandAgentsFixture.json";
import "./olympusCommand.css";

type Category = "Agents" | "Plugins" | "Skills";
const categories = ["Agents", "Plugins", "Skills"] as const;
const symbols = { Agents: CircleDot, Plugins: Plug, Skills: Sparkles };
interface Props {
  capabilities: CapabilitySnapshot | null; missions: MissionSnapshot | null;
  error?: string | null; missionsError?: string | null; preview: boolean;
  selectedAgent: string; onSelectAgent: (id: string) => void;
  onDestination: (destination: Mission["destination"]) => void;
  onInspectResearch?: (runId?: string) => void;
}
export function OlympusArmory({capabilities, missions, error, missionsError, preview, selectedAgent, onSelectAgent, onDestination, onInspectResearch}: Props) {
  const highlight=useAgentHighlight();
  const armoryRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    const emblems=armoryRef.current?.querySelectorAll<HTMLElement>('.armory-roster-emblem');
    if(!emblems)return;
    const visible=new Set<Element>();
    const refresh=()=>emblems.forEach(el=>{const paused=String(document.hidden||!visible.has(el));el.dataset.shinePaused=paused;const row=el.closest<HTMLElement>(".armory-roster-row");if(row)row.dataset.motionPaused=paused;});
    const observer=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting)visible.add(e.target);else visible.delete(e.target);});refresh();});
    emblems.forEach(el=>observer.observe(el));document.addEventListener('visibilitychange',refresh);refresh();
    return()=>{observer.disconnect();document.removeEventListener('visibilitychange',refresh);};
  });
  const [catalog, setCatalog] = useState<CommandCatalog | null>(preview ? fixture.empty as CommandCatalog : null);
  const [catalogError, setCatalogError] = useState("");
  const [revision, setRevision] = useState(0);
  const [agentFilter,setAgentFilter]=useState("All");
  const [category, setCategory] = useState<Category>("Agents");
  const [open, setOpen] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [item, setItem] = useState<Capability | null>(null);
  useEffect(()=>onArmoryInspection(target=>{
    const actual=[...(capabilities?.tools??[]),...(capabilities?.skills??[])].find(c=>c.id===target.id);
    if(!actual)return;
    setCategory(actual.kind==="skill"?"Skills":"Plugins");setAgentId(null);setItem(actual);setOpen(true);
  }),[capabilities]);
  useEffect(()=>{publishAgentConstellation(catalog);return ()=>publishAgentConstellation(null);},[catalog]);
  useEffect(()=>onConstellationAgent(id=>{
    const role=pantheonAgents(catalog).find(a=>a.id===id);
    if(role){setCategory("Agents");setOpen(true);setAgentId(id);setItem(null);onSelectAgent(id==="dionysus"?"olympus":id);}
  }),[catalog,onSelectAgent]);
  const loadoutHeading = useRef<HTMLHeadingElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  useEffect(()=>{if(agentId)loadoutHeading.current?.focus();},[agentId]);
  useEffect(()=>{if(item){detailRef.current?.scrollIntoView({block:"nearest"});detailRef.current?.focus();}},[item]);

  useEffect(() => {
    if (preview || !isTauriRuntime()) return;
    let live = true, busy = false;
    const read = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try { const value = await commandCatalog.read(); if(live){setCatalog(value);setCatalogError("");} }
      catch(e){if(live)setCatalogError(String(e));} finally{busy=false;}
    };
    void read(); const timer = window.setInterval(read, 30000);
    window.addEventListener("focus", read);
    return () => {live=false;window.clearInterval(timer);window.removeEventListener("focus",read);};
  }, [preview, revision]);
  const plugins = armoryPlugins(capabilities), operations = liveOperations(missions);
  const roles = pantheonAgents(catalog);
  const agent = roles.find(a => a.id === agentId);
  const loadout = capabilities?.agents.find(a => a.id === agentId);
  const numbers = [catalog ? roles.length : undefined, capabilities ? plugins.length : undefined, capabilities?.skills.length];
  function show(next: Category) {setCategory(next);setAgentId(null);setItem(null);setOpen(true);}
  function inspectAgent(role: CommandRole) {setAgentId(role.id);setItem(null);onSelectAgent(role.id==="dionysus"?"olympus":role.id);}
  function leave(){setOpen(false);onSelectAgent("olympus");}
  const status = (role: CommandRole) => role.kind==="orchestrator" ? "Core" : operations.some(m=>m.status==="waiting" && m.steps.some(s=>s.agent===role.id)) ? "Waiting" : operations.some(m => m.steps.some(s=>s.agent===role.id && s.state==="active")) ? "Working" : role.status === "AVAILABLE" ? "Ready" : role.status.toLowerCase();
  const workingIds=roles.filter(role=>status(role)==="Working").map(role=>role.id).sort().join('|');
  useEffect(()=>{publishWorkingAgents(workingIds?workingIds.split('|'):[]);return ()=>publishWorkingAgents([]);},[workingIds]);
  const activeAgent=(role:CommandRole)=>["Working","Waiting"].includes(status(role));
  const filterCounts={All:roles.length,Active:roles.filter(activeAgent).length??0,Idle:roles.filter(role=>status(role)==="Ready").length??0};
  const visibleAgents=roles.filter(role=>role.kind==="orchestrator"||agentFilter==="All"||(agentFilter==="Active"?activeAgent(role):status(role)==="Ready"));
  const openOperation = (m: Mission) => {leave();onDestination(m.destination);};
  return <aside ref={armoryRef} className="olympus-armory" aria-label="Olympus Armory">
    <div className="armory-heading"><h2>Armory</h2><p>Capabilities at your command</p></div>
    <div className="armory-index">{categories.map((name,i)=>{const Icon=symbols[name];return <button key={name} onClick={()=>show(name)} aria-haspopup="dialog"><Icon size={16}/><span>{name}</span><strong>{numbers[i] ?? "—"}</strong><ChevronRight size={12}/></button>;})}</div>

    {(error||catalogError||missionsError)&&<p className="armory-caution">Some observations are unavailable. <button onClick={()=>{setRevision(n=>n+1);show("Agents")}}>Review</button></p>}

    <div className="armory-presence">
      <span className="command-eyebrow">AGENTS</span>
      <nav className="armory-agent-filters" aria-label="Agent state filter">{(["All","Active","Idle"] as const).map(filter=><button key={filter} aria-pressed={agentFilter===filter} onClick={()=>setAgentFilter(filter)}>{filter} <b>{catalog?filterCounts[filter]:"—"}</b></button>)}</nav>
      <div className="armory-roster">{visibleAgents?.map(role=>{const state=status(role);return <button className="armory-roster-row" {...highlight.bind(role.id)} key={role.id} onClick={()=>{show("Agents");inspectAgent(role);}} aria-label={"Inspect "+role.name+" loadout"} data-selected={selectedAgent===role.id} data-status={state}>
        {state==="Working"&&<svg className="armory-working-sparks" viewBox="0 0 240 68" preserveAspectRatio="none" aria-hidden="true"><path d="M8 6 23 6 28 3 34 9 41 5 58 6 64 3 73 6 91 6 M34 9 38 14 45 12"/><path d="M149 61 162 62 169 58 177 65 184 60 197 62 205 58 220 61 234 60 M184 60 180 54 174 55"/></svg>}
        <span className="armory-roster-emblem"><AgentEmblem id={role.id} size={23}/></span>
        <span className="armory-roster-copy"><strong>{role.name}</strong><span>{role.description}</span><small>{state==="Ready"?"Ready for assignment":state==="Working"?"Assigned to active work":state==="Waiting"?"Waiting on mission checkpoint":role.kind==="orchestrator"?"Primary · always pinned":role.status==="PLACEHOLDER"?"Planned role · not executable":role.status==="UNPROVEN"?"Execution not yet verified":"Currently unavailable"}</small></span>
        <span className="armory-roster-status">{state==="Ready"?"Idle":state==="Working"?"Active":state}</span>
      </button>})}</div>
      {!catalog?<p>Reading catalog…</p>:!visibleAgents?.length?<p className="armory-filter-empty">No {agentFilter.toLowerCase()} agents in this snapshot.</p>:null}
    </div>
    <div className="armory-panel-actions"><button className="armory-deploy" onClick={()=>show("Agents")} title="Choose an agent and review its available workflows"><Plus size={14}/>Deploy agent</button><details className="armory-resource-drawer"><summary>Add resources &amp; skills</summary><ResourceIntake/></details></div>

    <Modal open={open} onClose={leave} title="Olympus Armory" showTitle={false} className="armory-dialog">
      <header className="armory-dialog-header"><div><h2>Olympus Armory</h2></div><button className="armory-close" onClick={leave} aria-label="Close Armory"><X size={20}/></button></header>
      <nav className="armory-tabs" aria-label="Armory categories">{categories.map((name,i)=>{const Icon=symbols[name];return <button key={name} aria-pressed={category===name} onClick={()=>{setCategory(name);setAgentId(null);setItem(null);}}><Icon size={16}/>{name}<small>{numbers[i]??"—"}</small></button>;})}</nav>
      <div className="armory-dialog-body">
      {(error||catalogError||missionsError)&&<p className="armory-caution">An observation failed. Retained observations may be stale; readiness is not confirmed. {catalogError&&<button onClick={()=>setRevision(n=>n+1)}>Retry catalog</button>}</p>}
      {agent ? <section className="agent-loadout"><button className="armory-back" onClick={()=>{setAgentId(null);onSelectAgent("olympus");}}>All agents</button><div className="loadout-title"><span className="agent-celestial"><AgentEmblem id={agent.id} size={30}/></span><div><span className="command-eyebrow">AGENT LOADOUT</span><h3 ref={loadoutHeading} tabIndex={-1}>{agent.name}</h3><span className="armory-state">{status(agent)}</span></div></div><p className="loadout-mission">{agent.description}</p><p className="armory-muted">{agent.role}</p>
        <div className="loadout-grid"><section><h4>Plugins & tools</h4>{loadout?.tools.map(id=>{const t=capabilities?.tools.find(t=>t.id===id);return t&&<button className="loadout-link" key={id} onClick={()=>setItem(t)}><Plug size={14}/>{t.name}<small>{t.state==="AVAILABLE"?"Available":"Unavailable"}</small></button>;})}{!loadout&&<p>Loadout unavailable.</p>}</section><section><h4>Skills</h4>{loadout?.skills.map(id=>{const s=capabilities?.skills.find(s=>s.id===id);return s&&<button className="loadout-link" key={id} onClick={()=>setItem(s)}><Sparkles size={14}/>{s.name}</button>;})}{loadout?.skills.length===0&&<p>No compiled skills assigned.</p>}</section></div>
        <section className="loadout-authority"><h4><ShieldCheck size={15}/> Authority & scope</h4><p>{agent.authority}</p><p>{agent.sourceScope}</p><small>{agent.availability ?? agent.evidence}</small></section>
        <section><h4>Current operation</h4>{operations.filter(m=>m.steps.some(s=>s.agent===agent.id)).map(m=><button className="loadout-link" key={m.id} onClick={()=>openOperation(m)}>{m.title}<ArrowUpRight size={14}/></button>)}{!operations.some(m=>m.steps.some(s=>s.agent===agent.id))&&<p className="armory-muted">No active operation recorded.</p>}</section>
        {agent.workflows?.length ? <section><h4>Open workflow</h4>{agent.workflows.map(w=><button className="loadout-link" key={w.id} onClick={()=>{leave();if(w.destination==="research"&&onInspectResearch)onInspectResearch();else onDestination(w.destination==="projects"?"project":"research");}}>{w.name}<ArrowUpRight size={14}/></button>)}</section> : null}
        {onInspectResearch && agent.history?.recent.map(run=><button className="loadout-link" key={run.id} onClick={()=>{leave();onInspectResearch(run.parentRunId);}}>{run.question}<small>{run.status}</small><ArrowUpRight size={14}/></button>)}
        {agent.history&&<p className="armory-muted">{agent.history.count} recorded {agent.history.unit}. {agent.history.lastAt?`Last observed ${new Date(agent.history.lastAt).toLocaleString()}`:"No execution history yet."}</p>}
      </section> : category==="Agents" ? <div className="armory-agent-list">{roles.map(role=><button className="armory-agent-entry" key={role.id} onClick={()=>inspectAgent(role)}><span className="agent-celestial"><AgentEmblem id={role.id} size={24}/></span><span><strong>{role.name}</strong><span>{role.description}</span></span><small>{status(role)}</small><ChevronRight size={16}/></button>)}{!catalog&&<p>Agent observations unavailable.</p>}<p className="armory-footnote">Zeus is Olympus Core, pinned above the filtered roles. Dionysus is a placeholder. Inspecting a loadout does not start work or grant permission.</p></div>
      : category==="Plugins" ? <><p className="armory-intro">Connections and local adapters. Model routes and delegated executors remain in agent loadouts.</p><div className="armory-plugin-list">{plugins.map(t=><button key={t.id} onClick={()=>setItem(t)}><span className="plugin-port"><Plug size={18}/></span><span><strong>{t.name}</strong><small>{t.toolKind}</small></span><span className="armory-state">{pluginStatus(t)}</span></button>)}</div>{!capabilities&&<p>Capabilities unavailable.</p>}<p className="armory-footnote">Available is configured readiness, not proof of authentication or a successful live call.</p></>
      : <div className="armory-skill-list">{capabilities?.skills.map((s,i)=><button key={s.id} onClick={()=>setItem(s)}><span className="skill-inscription">{String(i+1).padStart(2,"0")}</span><Sparkles size={16}/><span><strong>{s.name}</strong><small>{s.purpose}</small></span><ChevronRight size={16}/></button>)}{!capabilities&&<p>Skills unavailable.</p>}</div>}
      {item&&<section ref={detailRef} tabIndex={-1} className="armory-item-detail" aria-label="Capability detail"><button className="armory-close" aria-label="Close capability detail" onClick={()=>setItem(null)}><X size={16}/></button><span className="command-eyebrow">{item.kind==="skill"?"SKILL CONTRACT":"CAPABILITY CONTRACT"}</span><h3>{item.name}</h3>{item.kind==="tool"?<><p>{item.detail}</p><h4>Authority</h4><p>{item.authority}</p><h4>Approval</h4><p>{item.approval==="required"?"Required for every use":item.approval==="writes"?"Required for writes":"No additional approval in this contract"}</p><h4>Supported actions</h4><p>{item.capabilities.join(" / ")}</p></>:<><p>{item.purpose}</p><h4>Input / output</h4><p>{item.inputs}</p><p>{item.output}</p><h4>Effects</h4><p>{item.effects}</p>{item.instructions&&<><h4>Instructions</h4><p className="resource-guidance">{item.instructions}</p></>}</>}</section>}
      </div><footer className="armory-dialog-footer"><span>{preview?"Synthetic preview":"Observed runtime state"}</span></footer>
    </Modal>
  </aside>;
}
