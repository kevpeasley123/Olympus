import { executableSkills } from "../../services/executableSkills";
import { ProjectChangeReview } from "./ProjectChangeReview";
import {onManagementHandoff} from "../../services/managementNavigation";
import {SkillCollection} from "./SkillCollection";
import {onSuperpowersInspection} from "../../services/skillCollections";
import {publishAgentConstellation,onConstellationAgent,useAgentHighlight,publishWorkingAgents} from "../../services/agentConstellation";
import { pantheonAgents } from "../../services/pantheonAgents";
import { AgentEmblem } from "./AgentEmblem";
import { ActivityDeck } from "./ActivityDeck";
import { DECK_ROLES } from "../../services/activityDeck";
import { GmailSettings } from "./GmailSettings";
import { ResourceIntake } from "./ResourceIntake";
import { onArmoryInspection } from "../../services/armoryNavigation";
import { useEffect, useState, useRef } from "react";
import { ArrowUpRight, CircleDot, Plug, Sparkles, X, ChevronRight, ShieldCheck } from "lucide-react";
import { Modal } from "../Modal";
import { commandCatalog, type CommandCatalog, type CommandRole } from "../../services/commandAgents";
import type { CapabilitySnapshot, MissionSnapshot, Mission, Capability } from "../../services/capabilities";
import { armoryPlugins, liveOperations, pluginStatus } from "../../services/armoryPresentation";
import { isTauriRuntime } from "../../services/launcher";
import fixture from "../../services/commandAgentsFixture.json";
import "./olympusCommand.css";

type Category = "Agents" | "Plugins" | "Skills";
// The Activity Deck's order, so both tabs list the Olympians alike.
const armoryOrder = (id: string) => { const order = Object.keys(DECK_ROLES); const at = order.indexOf(id); return at < 0 ? order.length : at; };
const categories = ["Agents", "Plugins", "Skills"] as const;
const symbols = { Agents: CircleDot, Plugins: Plug, Skills: Sparkles };
interface Props {
  projectNames?:string[];
  capabilities: CapabilitySnapshot | null; missions: MissionSnapshot | null;
  error?: string | null; missionsError?: string | null; preview: boolean;
  selectedAgent: string; onSelectAgent: (id: string) => void;
  onDestination: (destination: Mission["destination"]) => void;
  onInspectResearch?: (runId?: string) => void;
}
export function OlympusArmory({projectNames,capabilities, missions, error, missionsError, preview, selectedAgent, onSelectAgent, onDestination, onInspectResearch}: Props) {
  const highlight=useAgentHighlight();
  const [catalog, setCatalog] = useState<CommandCatalog | null>(preview ? fixture.empty as CommandCatalog : null);
  const [catalogError, setCatalogError] = useState("");
  const [revision, setRevision] = useState(0);
  const intakeDrawer=useRef<HTMLDetailsElement>(null);
  // The left column is either the Activity Deck or the Armory; the full Armory dialog opens from either.
  const [pane,setPane]=useState<"activity"|"armory">("activity");
  const [intakeReturn,setIntakeReturn]=useState<(()=>void)|null>(null);
  useEffect(()=>onManagementHandoff(request=>{if(request.target!=="armory")return;setIntakeReturn(()=>request.returnToUsage);setPane("armory");requestAnimationFrame(()=>{if(intakeDrawer.current){intakeDrawer.current.open=true;intakeDrawer.current.scrollIntoView({block:"nearest"});intakeDrawer.current.querySelector<HTMLElement>("summary")?.focus();}});}),[]);
  const [category, setCategory] = useState<Category>("Agents");
  const [open, setOpen] = useState(false);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [collectionOpen,setCollectionOpen]=useState(false);
  useEffect(()=>onSuperpowersInspection(()=>{setCategory("Skills");setAgentId(null);setItem(null);setCollectionOpen(true);setOpen(true);}),[]);
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
  const numbers = [catalog ? roles.length : undefined, capabilities ? plugins.length : undefined, capabilities ? capabilities.skills.length+executableSkills.length : executableSkills.length];
  function show(next: Category) {setCollectionOpen(false);setCategory(next);setAgentId(null);setItem(null);setOpen(true);}
  useEffect(()=>{
    const openReview=()=>{show("Skills");requestAnimationFrame(()=>document.querySelector<HTMLDetailsElement>(".project-change-review")?.setAttribute("open",""));};
    window.addEventListener("olympus:open-review",openReview);
    return ()=>window.removeEventListener("olympus:open-review",openReview);
  },[]);
  function inspectAgent(role: CommandRole) {setAgentId(role.id);setItem(null);onSelectAgent(role.id==="dionysus"?"olympus":role.id);}
  function leave(){setOpen(false);onSelectAgent("olympus");}
  const status = (role: CommandRole) => role.kind==="orchestrator" ? "Core" : operations.some(m=>m.status==="waiting" && m.steps.some(s=>s.agent===role.id)) ? "Waiting" : operations.some(m => m.steps.some(s=>s.agent===role.id && s.state==="active")) ? "Working" : role.status === "AVAILABLE" ? "Ready" : role.status.toLowerCase();
  const workingIds=roles.filter(role=>status(role)==="Working").map(role=>role.id).sort().join('|');
  useEffect(()=>{publishWorkingAgents(workingIds?workingIds.split('|'):[]);return ()=>publishWorkingAgents([]);},[workingIds]);
  const openOperation = (m: Mission) => {leave();onDestination(m.destination);};
  const armoryDialog=<>
    <Modal open={open} onClose={leave} title="Olympus Armory" showTitle={false} className="armory-dialog">
      <header className="armory-dialog-header"><div><h2>Olympus Armory</h2></div><button className="armory-close" onClick={leave} aria-label="Close Armory"><X size={20}/></button></header>
      <nav className="armory-tabs" aria-label="Armory categories">{categories.map((name,i)=>{const Icon=symbols[name];return <button key={name} aria-pressed={category===name} onClick={()=>{setCategory(name);setCollectionOpen(false);setAgentId(null);setItem(null);}}><Icon size={16}/>{name}<small>{numbers[i]??"—"}</small></button>;})}</nav>
      <div className="armory-dialog-body">
      {(error||catalogError||missionsError)&&<p className="armory-caution">An observation failed. Retained observations may be stale; readiness is not confirmed. {catalogError&&<button onClick={()=>setRevision(n=>n+1)}>Retry catalog</button>}</p>}
      {agent ? <section className="agent-loadout"><button className="armory-back" onClick={()=>{setAgentId(null);onSelectAgent("olympus");}}>All agents</button><div className="loadout-title"><span className="agent-celestial"><AgentEmblem id={agent.id} size={30}/></span><div><span className="command-eyebrow">AGENT LOADOUT</span><h3 ref={loadoutHeading} tabIndex={-1}>{agent.name}</h3><span className="armory-state">{status(agent)}</span></div></div><p className="loadout-mission">{agent.description}</p><p className="armory-muted">{agent.role}</p>
        <div className="loadout-grid"><section><h4>Plugins & tools</h4>{loadout?.tools.map(id=>{const t=capabilities?.tools.find(t=>t.id===id);return t&&<button className="loadout-link" key={id} onClick={()=>setItem(t)}><Plug size={14}/>{t.name}<small>{t.state==="AVAILABLE"?"Available":"Unavailable"}</small></button>;})}{!loadout&&<p>Loadout unavailable.</p>}</section><section><h4>Skills</h4>{loadout?.skills.map(id=>{const s=capabilities?.skills.find(s=>s.id===id);return s&&<button className="loadout-link" key={id} onClick={()=>setItem(s)}><Sparkles size={14}/>{s.name}</button>;})}{loadout?.skills.length===0&&<p>No compiled skills assigned.</p>}</section></div>
        {agent.id==="coding-delegate"&&<button className="collection-launch" onClick={()=>{setAgentId(null);setCategory("Skills");setCollectionOpen(true);setItem(null);}}><span>Superpowers<small>{loadout?.skills.includes("hephaestus-engineering") ? "Engineering pilot guidance v1" : "Suggested collection · not assigned"}</small></span><span>Inspect</span></button>}
        <section className="loadout-authority"><h4><ShieldCheck size={15}/> Authority & scope</h4><p>{agent.authority}</p><p>{agent.sourceScope}</p><small>{agent.availability ?? agent.evidence}</small></section>
        <section><h4>Current operation</h4>{operations.filter(m=>m.steps.some(s=>s.agent===agent.id)).map(m=><button className="loadout-link" key={m.id} onClick={()=>openOperation(m)}>{m.title}<ArrowUpRight size={14}/></button>)}{!operations.some(m=>m.steps.some(s=>s.agent===agent.id))&&<p className="armory-muted">No active operation recorded.</p>}</section>
        {agent.workflows?.length ? <section><h4>Open workflow</h4>{agent.workflows.map(w=><button className="loadout-link" key={w.id} onClick={()=>{leave();if(w.destination==="research"&&onInspectResearch)onInspectResearch();else onDestination(w.destination==="projects"?"project":"research");}}>{w.name}<ArrowUpRight size={14}/></button>)}</section> : null}
        {onInspectResearch && agent.history?.recent.map(run=><button className="loadout-link" key={run.id} onClick={()=>{leave();onInspectResearch(run.parentRunId);}}>{run.question}<small>{run.status}</small><ArrowUpRight size={14}/></button>)}
        {agent.history&&<p className="armory-muted">{agent.history.count} recorded {agent.history.unit}. {agent.history.lastAt?`Last observed ${new Date(agent.history.lastAt).toLocaleString()}`:"No execution history yet."}</p>}
      </section> : category==="Agents" ? <div className="armory-agent-list">{roles.map(role=><button className="armory-agent-entry" key={role.id} onClick={()=>inspectAgent(role)}><span className="agent-celestial"><AgentEmblem id={role.id} size={24}/></span><span><strong>{role.name}</strong><span>{role.description}</span></span><small>{status(role)}</small><ChevronRight size={16}/></button>)}{!catalog&&<p>Agent observations unavailable.</p>}<p className="armory-footnote">Zeus is Olympus Core, pinned above the filtered roles. Dionysus is a placeholder. Inspecting a loadout does not start work or grant permission.</p></div>
      : category==="Plugins" ? <><p className="armory-intro">Connections and local adapters. Model routes and delegated executors remain in agent loadouts.</p><div className="armory-plugin-list">{plugins.map(t=>t.id==="gmail"?<GmailSettings key={t.id} pluginRow/>:<button key={t.id} onClick={()=>setItem(t)}><span className="plugin-port"><Plug size={18}/></span><span><strong>{t.name}</strong><small>{t.toolKind}</small></span><span className="armory-state">{pluginStatus(t)}</span></button>)}</div>{!capabilities&&<p>Capabilities unavailable.</p>}<p className="armory-footnote">Available is configured readiness, not proof of authentication or a successful live call.</p></>
      : <><ProjectChangeReview projects={projectNames} /><button className="collection-launch" onClick={()=>{setCollectionOpen(!collectionOpen);setItem(null);}} aria-expanded={collectionOpen}><span>Superpowers<small>Skill collection · curated reference</small></span><span>{collectionOpen?"Close":"Inspect"}</span></button>{collectionOpen&&<SkillCollection connected={!!capabilities?.skills.some(s=>s.id==="hephaestus-engineering")}/>}<div className="armory-skill-list">{capabilities?.skills.map((s,i)=><button key={s.id} onClick={()=>setItem(s)}><span className="skill-inscription">{String(i+1).padStart(2,"0")}</span><Sparkles size={16}/><span><strong>{s.name}</strong><small>{s.purpose}</small></span><ChevronRight size={16}/></button>)}{!capabilities&&<p>Skills unavailable.</p>}</div></>}
      {item?.id==="gmail" && (agent || category!=="Plugins") && <GmailSettings pluginRow/>}
      {item&&item.id!=="gmail"&&<section ref={detailRef} tabIndex={-1} className="armory-item-detail" aria-label="Capability detail"><button className="armory-close" aria-label="Close capability detail" onClick={()=>setItem(null)}><X size={16}/></button><span className="command-eyebrow">{item.kind==="skill"?"SKILL CONTRACT":"CAPABILITY CONTRACT"}</span><h3>{item.name}</h3>{item.kind==="tool"?<><p>{item.detail}</p><h4>Authority</h4><p>{item.authority}</p><h4>Approval</h4><p>{item.approval==="required"?"Required for every use":item.approval==="writes"?"Required for writes":"No additional approval in this contract"}</p><h4>Supported actions</h4><p>{item.capabilities.join(" / ")}</p></>:<><p>{item.purpose}</p><h4>Input / output</h4><p>{item.inputs}</p><p>{item.output}</p><h4>Effects</h4><p>{item.effects}</p>{item.instructions&&<><h4>Instructions</h4><p className="resource-guidance">{item.instructions}</p></>}</>}</section>}
      </div><footer className="armory-dialog-footer"><span>{preview?"Synthetic preview":"Observed runtime state"}</span></footer>
    </Modal>
  </>;
  const tabs=<nav className="deck-tabs" aria-label="Left column views">{(["activity","armory"] as const).map(name=><button key={name} type="button" aria-pressed={pane===name} onClick={()=>setPane(name)}>{name==="activity"?"Activity":"Armory"}</button>)}</nav>;
  const skillCount=capabilities ? capabilities.skills.length+executableSkills.length : executableSkills.length;
  if(pane==="armory") return <aside className="olympus-armory activity-deck" aria-label="Armory">
    <header className="armory-heading deck-heading">
      <Sparkles className="deck-heading-mark" size={24} strokeWidth={1.4} aria-hidden="true"/>
      <div><h2>Armory</h2><p>Agents · plugins · skills</p></div>
      <button type="button" className="deck-manage" onClick={()=>show(category)} aria-haspopup="dialog" aria-label="Open the Armory" title="Open the full Armory"><ArrowUpRight size={14}/></button>
    </header>
    {tabs}
    {(error||catalogError||missionsError)&&<p className="armory-caution">Some observations are unavailable. <button onClick={()=>{setRevision(n=>n+1);show("Agents")}}>Review</button></p>}
    <section className="deck-section deck-idle armory-pane" aria-label="Agents">
      <h3>Agents <span>({catalog?roles.length:"—"})</span></h3>
      {!catalog?<p className="deck-note">Reading the roster…</p>:<ul>{[...roles].sort((a,b)=>armoryOrder(a.id)-armoryOrder(b.id)).map(role=><li key={role.id}><button type="button" className="deck-idle-row" onClick={()=>{show("Agents");inspectAgent(role);}} {...highlight.bind(role.id)}>
        <span className="deck-emblem deck-emblem--small"><AgentEmblem id={role.id} size={17}/></span><strong>{role.name}</strong><span className="deck-status" data-status={status(role).toLowerCase()}>{({unproven:"Unverified",placeholder:"Planned",unavailable:"Unavailable"} as Record<string,string>)[status(role)]??status(role)}</span><ChevronRight size={13} aria-hidden="true"/></button></li>)}</ul>}
    </section>
    <section className="deck-section deck-idle armory-pane" aria-label="Plugins">
      <h3>Plugins <span>({capabilities?plugins.length:"—"})</span></h3>
      {!capabilities?<p className="deck-note">Plugins unavailable.</p>:<ul>{plugins.map(t=><li key={t.id}><button type="button" className="deck-idle-row armory-pane-row" onClick={()=>{show("Plugins");setItem(t);}}>
        <Plug size={15} aria-hidden="true"/><strong>{t.name}</strong><span className="deck-status" data-status={pluginStatus(t).toLowerCase()}>{pluginStatus(t)}</span><ChevronRight size={13} aria-hidden="true"/></button></li>)}</ul>}
    </section>
    <section className="deck-section deck-idle armory-pane" aria-label="Skills">
      <h3>Skills <span>({skillCount})</span></h3>
      <ul>{executableSkills.map(skill=><li key={skill.command}><button type="button" className="deck-idle-row armory-pane-row" onClick={()=>show("Skills")}><Sparkles size={15} aria-hidden="true"/><strong>{skill.name}</strong><ChevronRight size={13} aria-hidden="true"/></button></li>)}
        {capabilities?.skills.map(skill=><li key={skill.id}><button type="button" className="deck-idle-row armory-pane-row" onClick={()=>{show("Skills");setItem(skill);}}><Sparkles size={15} aria-hidden="true"/><strong>{skill.name}</strong><ChevronRight size={13} aria-hidden="true"/></button></li>)}</ul>
    </section>
    <div className="deck-actions">
      <details ref={intakeDrawer} className="armory-resource-drawer"><summary>Add resources &amp; skills</summary>{intakeReturn&&<button onClick={()=>{const back=intakeReturn;setIntakeReturn(null);if(intakeDrawer.current)intakeDrawer.current.open=false;back();}}>Back to API management</button>}<ResourceIntake/></details>
    </div>
    {armoryDialog}
  </aside>;
  return <aside className="olympus-armory activity-deck" aria-label="Activity Deck">
    <ActivityDeck roster={catalog?roles.map(role=>{const held=operations.find(m=>m.steps.some(s=>s.agent===role.id&&s.state==="active")),waiting=operations.find(m=>m.status==="waiting"&&m.steps.some(s=>s.agent===role.id));const mission=waiting??held;
      return {id:role.id,name:role.name,description:role.description,readiness:role.kind==="orchestrator"||role.status==="AVAILABLE"?"Idle":role.status==="PLACEHOLDER"?"Planned":role.status==="UNPROVEN"?"Unverified":"Unavailable",
        mission:mission&&role.kind!=="orchestrator"?{title:mission.title,step:mission.steps.find(s=>s.agent===role.id&&s.state==="active")?.label??mission.title,waiting:!!waiting}:null,bind:highlight.bind(role.id)};}):null}
      tabs={tabs} onInspectProfile={id=>{const role=roles.find(r=>r.id===id);if(role){show("Agents");inspectAgent(role);}}}>
      {(error||catalogError||missionsError)&&<p className="armory-caution">Some observations are unavailable. <button onClick={()=>{setRevision(n=>n+1);show("Agents")}}>Review</button></p>}
    </ActivityDeck>

    {armoryDialog}
  </aside>;
}
