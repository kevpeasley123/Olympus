import { useEffect, useState, useRef } from "react";
import { ArrowUpRight, CircleDot, Plug, Sparkles, Activity, X, ChevronRight, ShieldCheck } from "lucide-react";
import { Modal } from "../Modal";
import { commandCatalog, type CommandCatalog, type CommandRole } from "../../services/commandAgents";
import type { CapabilitySnapshot, MissionSnapshot, Mission, Capability } from "../../services/capabilities";
import { armoryPlugins, liveOperations, pluginStatus } from "../../services/armoryPresentation";
import { isTauriRuntime } from "../../services/launcher";
import fixture from "../../services/commandAgentsFixture.json";
import "./olympusCommand.css";

type Category = "Agents" | "Plugins" | "Skills" | "Operations";
const categories = ["Agents", "Plugins", "Skills", "Operations"] as const;
const symbols = { Agents: CircleDot, Plugins: Plug, Skills: Sparkles, Operations: Activity };
interface Props {
  capabilities: CapabilitySnapshot | null; missions: MissionSnapshot | null;
  error?: string | null; missionsError?: string | null; preview: boolean;
  selectedAgent: string; onSelectAgent: (id: string) => void;
  onDestination: (destination: Mission["destination"]) => void;
  onInspectResearch?: (runId?: string) => void;
}
export function OlympusArmory({capabilities, missions, error, missionsError, preview, selectedAgent, onSelectAgent, onDestination, onInspectResearch}: Props) {
  const [catalog, setCatalog] = useState<CommandCatalog | null>(preview ? fixture.empty as CommandCatalog : null);
  const [catalogError, setCatalogError] = useState("");
  const [revision, setRevision] = useState(0);
  const [category, setCategory] = useState<Category>("Agents");
  const [open, setOpen] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [item, setItem] = useState<Capability | null>(null);
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
  const agent = catalog?.agents.find(a => a.id === agentId);
  const loadout = capabilities?.agents.find(a => a.id === agentId);
  const numbers = [catalog?.agents.length, capabilities ? plugins.length : undefined, capabilities?.skills.length, missions ? operations.length : undefined];
  function show(next: Category) {setCategory(next);setAgentId(null);setItem(null);setOpen(true);}
  function inspectAgent(role: CommandRole) {setAgentId(role.id);setItem(null);onSelectAgent(role.id);}
  function leave(){setOpen(false);onSelectAgent("olympus");}
  const status = (role: CommandRole) => operations.some(m=>m.status==="waiting" && m.steps.some(s=>s.agent===role.id)) ? "Waiting" : operations.some(m => m.steps.some(s=>s.agent===role.id && s.state==="active")) ? "Working" : role.status === "AVAILABLE" ? "Ready" : role.status.toLowerCase();
  const openOperation = (m: Mission) => {leave();onDestination(m.destination);};
  return <aside className="olympus-armory" aria-label="Olympus Armory">
    <div className="armory-heading"><span className="command-eyebrow">OLYMPUS</span><h2>Armory</h2></div>
    <div className="armory-index">{categories.map((name,i)=>{const Icon=symbols[name];return <button key={name} onClick={()=>show(name)} aria-haspopup="dialog"><Icon size={16}/><span>{name}</span><strong>{numbers[i] ?? "—"}</strong><ChevronRight size={12}/></button>;})}</div>
    <button className="armory-open" onClick={()=>show("Agents")}>Explore capabilities <ArrowUpRight size={13}/></button>
    {(error||catalogError||missionsError)&&<p className="armory-caution">Some observations are unavailable. <button onClick={()=>{setRevision(n=>n+1);show("Agents")}}>Review</button></p>}
    <div className="armory-presence"><span className="command-eyebrow">EXECUTABLE AGENTS</span>{catalog?.agents.map(role=><button key={role.id} onClick={()=>{show("Agents");inspectAgent(role);}} aria-label={`Inspect ${role.name} loadout`} data-selected={selectedAgent===role.id}><i data-status={status(role)}/><span>{role.name.replace(" Agent","")}</span><small>{status(role)}</small></button>)}{!catalog&&<p>Reading catalog...</p>}</div>
    <div className="armory-operation-summary"><span className="command-eyebrow">OPERATIONS</span>{missionsError ? <p>Activity status unavailable</p> : !missions ? <p>Reading activity...</p> : operations.length ? operations.slice(0,2).map(m=><button key={m.id} onClick={()=>show("Operations")}><span className="operation-pulse"/><span>{m.title}<small>{m.status==="waiting"?"Waiting for your review":"In progress"}</small></span></button>) : <p>No active runs reported<span>Workflow telemetry only.</span></p>}</div>
    {preview && <footer>Preview / synthetic state</footer>}
    <Modal open={open} onClose={leave} title="Olympus Armory" showTitle={false} className="armory-dialog">
      <header className="armory-dialog-header"><div><h2>Olympus Armory</h2></div><button className="armory-close" onClick={leave} aria-label="Close Armory"><X size={20}/></button></header>
      <nav className="armory-tabs" aria-label="Armory categories">{categories.map((name,i)=>{const Icon=symbols[name];return <button key={name} aria-pressed={category===name} onClick={()=>{setCategory(name);setAgentId(null);setItem(null);}}><Icon size={16}/>{name}<small>{numbers[i]??"—"}</small></button>;})}</nav>
      <div className="armory-dialog-body">
      {(error||catalogError||missionsError)&&<p className="armory-caution">An observation failed. Retained observations may be stale; readiness is not confirmed. {catalogError&&<button onClick={()=>setRevision(n=>n+1)}>Retry catalog</button>}</p>}
      {agent ? <section className="agent-loadout"><button className="armory-back" onClick={()=>{setAgentId(null);onSelectAgent("olympus");}}>All agents</button><div className="loadout-title"><span className="agent-celestial"><CircleDot size={30}/></span><div><span className="command-eyebrow">AGENT LOADOUT</span><h3 ref={loadoutHeading} tabIndex={-1}>{agent.name}</h3><span className="armory-state">{status(agent)}</span></div></div><p className="loadout-mission">{agent.description}</p>
        <div className="loadout-grid"><section><h4>Plugins & tools</h4>{loadout?.tools.map(id=>{const t=capabilities?.tools.find(t=>t.id===id);return t&&<button className="loadout-link" key={id} onClick={()=>setItem(t)}><Plug size={14}/>{t.name}<small>{t.state==="AVAILABLE"?"Available":"Unavailable"}</small></button>;})}{!loadout&&<p>Loadout unavailable.</p>}</section><section><h4>Skills</h4>{loadout?.skills.map(id=>{const s=capabilities?.skills.find(s=>s.id===id);return s&&<button className="loadout-link" key={id} onClick={()=>setItem(s)}><Sparkles size={14}/>{s.name}</button>;})}{loadout?.skills.length===0&&<p>No compiled skills assigned.</p>}</section></div>
        <section className="loadout-authority"><h4><ShieldCheck size={15}/> Authority & scope</h4><p>{agent.authority}</p><p>{agent.sourceScope}</p><small>{agent.availability ?? agent.evidence}</small></section>
        <section><h4>Current operation</h4>{operations.filter(m=>m.steps.some(s=>s.agent===agent.id)).map(m=><button className="loadout-link" key={m.id} onClick={()=>openOperation(m)}>{m.title}<ArrowUpRight size={14}/></button>)}{!operations.some(m=>m.steps.some(s=>s.agent===agent.id))&&<p className="armory-muted">No active operation recorded.</p>}</section>
        {agent.workflows?.length ? <section><h4>Open workflow</h4>{agent.workflows.map(w=><button className="loadout-link" key={w.id} onClick={()=>{leave();if(w.destination==="research"&&onInspectResearch)onInspectResearch();else onDestination(w.destination==="projects"?"project":"research");}}>{w.name}<ArrowUpRight size={14}/></button>)}</section> : null}
        {onInspectResearch && agent.history?.recent.map(run=><button className="loadout-link" key={run.id} onClick={()=>{leave();onInspectResearch(run.parentRunId);}}>{run.question}<small>{run.status}</small><ArrowUpRight size={14}/></button>)}
        {agent.history&&<p className="armory-muted">{agent.history.count} recorded {agent.history.unit}. {agent.history.lastAt?`Last observed ${new Date(agent.history.lastAt).toLocaleString()}`:"No execution history yet."}</p>}
      </section> : category==="Agents" ? <div className="armory-agent-list">{catalog?.agents.map(role=><button className="armory-agent-entry" key={role.id} onClick={()=>inspectAgent(role)}><span className="agent-celestial"><CircleDot size={24}/></span><span><strong>{role.name}</strong><span>{role.description}</span></span><small>{status(role)}</small><ChevronRight size={16}/></button>)}{!catalog&&<p>Agent observations unavailable.</p>}<p className="armory-footnote">Olympus Core orchestrates these roles. Inspecting a loadout does not start work or grant permission.</p></div>
      : category==="Plugins" ? <><p className="armory-intro">Connections and local adapters. Model routes and delegated executors remain in agent loadouts.</p><div className="armory-plugin-list">{plugins.map(t=><button key={t.id} onClick={()=>setItem(t)}><span className="plugin-port"><Plug size={18}/></span><span><strong>{t.name}</strong><small>{t.toolKind}</small></span><span className="armory-state">{pluginStatus(t)}</span></button>)}</div>{!capabilities&&<p>Capabilities unavailable.</p>}<p className="armory-footnote">Available is configured readiness, not proof of authentication or a successful live call.</p></>
      : category==="Skills" ? <div className="armory-skill-list">{capabilities?.skills.map((s,i)=><button key={s.id} onClick={()=>setItem(s)}><span className="skill-inscription">{String(i+1).padStart(2,"0")}</span><Sparkles size={16}/><span><strong>{s.name}</strong><small>{s.purpose}</small></span><ChevronRight size={16}/></button>)}{!capabilities&&<p>Skills unavailable.</p>}</div>
      : <div className="armory-operation-list">{!missions?<p>Operation observations unavailable.</p>:operations.length===0?<div className="armory-empty"><Activity size={30}/><h3>All quiet.</h3><p>No active operations in the current runtime snapshot.</p><small>Background sync and scheduled monitors are not reported by this endpoint.</small></div>:operations.map(m=><button key={m.id} onClick={()=>openOperation(m)}><span className="operation-pulse"/><span><strong>{m.title}</strong><small>{m.status==="waiting"?"Awaiting review":m.phase??"Working"}</small><span>{m.steps.filter(s=>s.state==="completed").length} / {m.steps.length} recorded steps</span></span><ArrowUpRight size={16}/></button>)}{missions?.missions.some(m=>m.status==="failed")&&<details><summary>Recent failures</summary>{missions.missions.filter(m=>m.status==="failed").map(m=><button className="loadout-link" key={m.id} onClick={()=>openOperation(m)}>{m.title} <span>Failed</span></button>)}</details>}</div>}
      {item&&<section ref={detailRef} tabIndex={-1} className="armory-item-detail" aria-label="Capability detail"><button className="armory-close" aria-label="Close capability detail" onClick={()=>setItem(null)}><X size={16}/></button><span className="command-eyebrow">{item.kind==="skill"?"SKILL CONTRACT":"CAPABILITY CONTRACT"}</span><h3>{item.name}</h3>{item.kind==="tool"?<><p>{item.detail}</p><h4>Authority</h4><p>{item.authority}</p><h4>Approval</h4><p>{item.approval==="required"?"Required for every use":item.approval==="writes"?"Required for writes":"No additional approval in this contract"}</p><h4>Supported actions</h4><p>{item.capabilities.join(" / ")}</p></>:<><p>{item.purpose}</p><h4>Input / output</h4><p>{item.inputs}</p><p>{item.output}</p><h4>Effects</h4><p>{item.effects}</p></>}</section>}
      </div><footer className="armory-dialog-footer"><span>{preview?"Synthetic preview":"Observed runtime state"}</span></footer>
    </Modal>
  </aside>;
}
