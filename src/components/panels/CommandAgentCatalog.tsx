import {BookOpen,ShieldCheck,Code2,Network,ChevronRight,ChevronLeft,RefreshCw} from "lucide-react";
import {useEffect,useState} from "react";
import {commandCatalog,type CommandCatalogClient,type CommandCatalog,type CommandRole} from "../../services/commandAgents";
import {isTauriRuntime} from "../../services/launcher";
import {CAPABILITY_WORD,findCapability,type Capability,type CapabilitySnapshot} from "../../services/capabilities";
import "./commandAgents.css";

function RoleIcon({id}:{id:string}) {
  return id==="olympus"?<span className="agent-core-mark" aria-hidden="true">Ω</span>:id==="research"?<BookOpen/>:id==="verification"?<ShieldCheck/>:id==="coding-delegate"?<Code2/>:<Network/>;
}
function Stamp({role}:{role:CommandRole}) {return <span className="agent-status" data-tone={role.tone}><i aria-hidden="true"/>{role.status}</span>}
function Row({role,selected,working,onSelect}:{role:CommandRole;selected:boolean;working?:"active"|"completed";onSelect:()=>void}) {
  return <button className="agent-role-row" data-selected={selected} data-working={working} aria-pressed={selected} onClick={onSelect}
    aria-label={`${role.name}${role.version!==null?` @${role.version}`:""} · ${role.status}${working==="active"?" · working now":""}`}>
    <span className="agent-role-icon"><RoleIcon id={role.id}/></span>
    <span className="agent-role-copy"><strong>{role.name}{role.version!==null&&<small> @{role.version}</small>}</strong><span>{role.description}</span></span>
    <span className="agent-role-status"><Stamp role={role}/>{working==="active"?<span className="agent-working" aria-hidden="true"><i/>Working</span>:<ChevronRight size={13} aria-hidden="true"/>}</span>
  </button>;
}
const date=(value:string)=>new Date(value).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
export function CommandAgentCatalog({client=commandCatalog,available=isTauriRuntime(),selectedId,onSelect,onResearch,onProjects,
  capabilities=null,working=new Map(),orchestrating=false,selectedCapability=null,onSelectCapability}:{
  client?:CommandCatalogClient;available?:boolean;selectedId?:string;onSelect?:(id:string)=>void;
  onResearch:(runId?:string)=>void;onProjects:()=>void;
  /** The armory projection: what each role is armed with, from its contract. */
  capabilities?:CapabilitySnapshot|null;
  /** Roles a recorded mission step is using, from the same projection. */
  working?:ReadonlyMap<string,"active"|"completed">;
  /** A recorded run is in progress: Olympus Core owns every mission, including ones no executable agent runs. */
  orchestrating?:boolean;
  selectedCapability?:string|null;onSelectCapability?:(id:string|null)=>void;
}) {
  const [catalog,setCatalog]=useState<CommandCatalog|null>(null),[localSelection,setSelection]=useState("olympus");
  const [error,setError]=useState(""),[loading,setLoading]=useState(false),[revision,setRevision]=useState(0);
  useEffect(()=>{
    if(!available){setCatalog(null);return}
    let active=true;let busy=false;
    async function read(){if(busy)return;busy=true;setLoading(true);try{const value=await client.read();if(active){setCatalog(value);setError("")}}catch(e){if(active){setCatalog(null);setError(String(e))}}finally{busy=false;if(active)setLoading(false)}}
    void read();const timer=setInterval(()=>void read(),30000);const focus=()=>void read();window.addEventListener("focus",focus);
    return()=>{active=false;clearInterval(timer);window.removeEventListener("focus",focus)};
  },[client,available,revision]);
  const id=selectedId??localSelection;
  const role=catalog?(id===catalog.orchestrator.id?catalog.orchestrator:catalog.agents.find(a=>a.id===id)??catalog.orchestrator):null;
  function select(id:string){setSelection(id);onSelect?.(id)}
  const armory=capabilities?.agents.find(agent=>agent.id===(role?.id??"olympus"))??null;
  const inspected=findCapability(capabilities,selectedCapability);
  const capabilityState=(item:Capability)=>item.kind==="skill"?"Compiled contract":CAPABILITY_WORD[item.state==="AVAILABLE"?(item.approval==="required"?"requires-approval":"available"):"unavailable"];
  const Links=({ids}:{ids:string[]})=><>{ids.map((id,index)=><span key={id}>{index>0&&" · "}<button type="button" className="agent-inspect-link"
    onClick={()=>onSelectCapability?.(id)}>{findCapability(capabilities,id)?.name??id}</button></span>)}</>;
  return <aside className="command-agent-catalog" aria-label="Agent Catalog" aria-busy={loading}>
    <header className="agent-catalog-header"><Network aria-hidden="true"/><div><h2>Agent Catalog</h2><p>{catalog?`1 orchestrator · ${catalog.agents.length} agents`:"Runtime inspection"}</p></div><button className="agent-refresh" title="Refresh runtime observations" aria-label="Refresh agent catalog" disabled={loading||!available} onClick={()=>setRevision(r=>r+1)}><RefreshCw size={14}/></button></header>
    {!available?<p className="agent-catalog-notice">Runtime catalog is available in the desktop app. Browser preview has no live agent observations.</p>:!catalog?(error
      // Plain words first, the database's own message behind a disclosure (review D3).
      ?<div className="agent-catalog-notice agent-catalog-error" role="alert"><p>Agent catalog could not be read from the local database. Showing no availability claims.</p>
        <button type="button" className="ghost-action" disabled={loading} onClick={()=>setRevision(r=>r+1)}>Retry</button>
        <details><summary>Technical detail</summary><p>{error}</p></details></div>
      :<p className="agent-catalog-notice" role="status">Reading runtime catalog…</p>):<>
      <div className="agent-catalog-list" aria-label="Operational runtime roles">
        <h3>Main orchestrator</h3><Row role={catalog.orchestrator} selected={role?.id===catalog.orchestrator.id} working={orchestrating?"active":undefined} onSelect={()=>select(catalog.orchestrator.id)}/>
        <h3>Executable agents</h3>{catalog.agents.map(a=><Row key={a.id} role={a} selected={role?.id===a.id} working={working.get(a.id)} onSelect={()=>select(a.id)}/>)}
      </div>
      {inspected&&onSelectCapability?<CapabilityDetail item={inspected} snapshot={capabilities!} state={capabilityState(inspected)}
        back={role?.name??"Olympus Core"} onBack={()=>onSelectCapability(null)} agentName={id=>id===catalog.orchestrator.id?catalog.orchestrator.name:catalog.agents.find(a=>a.id===id)?.name??id}/>
      :role&&<section className="agent-selected-detail" aria-label="Selected agent details" key={role.id}>
        <div className="agent-detail-eyebrow">Selected {role.kind==="orchestrator"?"orchestrator":"agent"}</div>
        <header><span className="agent-detail-icon"><RoleIcon id={role.id}/></span><div><h3>{role.name}{role.version!==null&&` @${role.version}`}</h3><span className="agent-definition-kind">{role.kind==="orchestrator"?"Main orchestrator":role.version===null?"Legacy / unversioned":"Compiled executable role"}</span></div><Stamp role={role}/></header>
        <dl><dt>Role</dt><dd>{role.role}</dd>
          {role.capabilities&&<><dt>Capabilities</dt><dd>{role.capabilities.join(" · ")}</dd></>}
          {role.skills&&<><dt>Skills</dt><dd>{role.skills.length?role.skills.map(s=>s.name).join(" · "):"Existing bounded adapter; no versioned skill bindings"}</dd></>}
          <dt>Authority</dt><dd>{role.authority}</dd>
          <dt>Sources</dt><dd>{role.sourceScope}</dd>
          <dt>Used by</dt><dd>{role.usedBy??role.workflows?.map(w=><button key={w.id} className="agent-inspect-link" onClick={()=>w.destination==="research"?onResearch():onProjects()}>{w.name}<ChevronRight size={12}/></button>)}</dd>
          {role.peers&&role.peers.length>0&&<><dt>Linked to</dt><dd>{role.peers.map(peer=>catalog.agents.find(a=>a.id===peer)?.name??peer).join(", ")} · within the declared workflow only</dd></>}
          {role.history&&<><dt>Runs</dt><dd>{role.history.count===0?"No recorded executions yet":`${role.history.count} ${role.history.unit}`}</dd><dt>Last execution</dt><dd>{role.history.lastAt?<time dateTime={role.history.lastAt}>{date(role.history.lastAt)}</time>:"None"}</dd></>}
          {role.modelStrategy&&<><dt>Model</dt><dd>{role.modelStrategy}</dd></>}
          {armory&&<><dt>Tools</dt><dd>{role.id===catalog.orchestrator.id?`${armory.tools.length} · the full armory`:<Links ids={armory.tools}/>}</dd>
            <dt>Skills</dt><dd>{role.id===catalog.orchestrator.id?`${armory.skills.length} · every compiled contract`:armory.skills.length?<Links ids={armory.skills}/>:"None bound"}</dd></>}
        </dl>
        {armory?.note&&<p className="agent-observation">{armory.note}</p>}
        {role.availability&&<p className="agent-observation">{role.availability}</p>}
        {role.kind==="legacy"&&<p className="agent-observation">{role.evidence}</p>}
        {Boolean(role.history?.recent.length)&&<div className="agent-recent-runs"><h4>Recent executions</h4>{role.history!.recent.map(r=><button key={r.id} onClick={()=>onResearch(r.parentRunId)} title={r.question}><span>{date(r.startedAt)} · @{r.version} · {r.status}</span><ChevronRight size={12}/></button>)}</div>}
      </section>}
      <footer>Read-only inspection <span>Observed {date(catalog.observedAt)}</span></footer>
    </>}
  </aside>;
}

/** One Tool or Skill, as the armory projection records it. Inspection only. */
function CapabilityDetail({item,snapshot,state,back,onBack,agentName}:{item:Capability;snapshot:CapabilitySnapshot;state:string;back:string;onBack:()=>void;agentName:(id:string)=>string}) {
  const domain=snapshot.domains.find(d=>d.id===item.domain);
  return <section className="agent-selected-detail capability-detail" aria-label={`${item.name} details`} key={item.id}>
    <button type="button" className="agent-inspect-link capability-detail__back" onClick={onBack}><ChevronLeft size={12} aria-hidden="true"/>{back}</button>
    <div className="agent-detail-eyebrow">{item.kind==="tool"?"Tool":"Skill"} · {domain?.label??item.domain}</div>
    <header><span className="capability-detail__glyph" data-kind={item.kind} aria-hidden="true"/><div><h3>{item.name}{item.kind==="skill"&&` @${item.version}`}</h3>
      <span className="agent-definition-kind">{item.kind==="tool"?toolKind(item.toolKind):"Compiled skill contract"}</span></div>
      <span className="agent-status" data-tone={item.kind==="tool"&&item.state!=="AVAILABLE"?"unavailable":"ready"}><i aria-hidden="true"/>{state}</span></header>
    <dl>
      {item.kind==="tool"?<><dt>Status</dt><dd>{item.detail}</dd><dt>Can</dt><dd>{item.capabilities.join(" · ")}</dd><dt>Authority</dt><dd>{item.authority}</dd>
        {item.model&&<><dt>Model</dt><dd>{item.model}</dd></>}</>
        :<><dt>Purpose</dt><dd>{item.purpose}</dd><dt>Inputs</dt><dd>{item.inputs}</dd><dt>Output</dt><dd>{item.output}</dd><dt>Effects</dt><dd>{item.effects}</dd>
        <dt>Uses</dt><dd>{item.allowedTools.map(id=>snapshot.tools.find(t=>t.id===id)?.name??id).join(" · ")}</dd></>}
      <dt>Used by</dt><dd>{[...item.usedBy.map(agentName),...item.workflows].join(" · ")}</dd>
      <dt>{item.kind==="tool"?"Last used":"Runs"}</dt><dd>{item.usage?`${item.usage.count} ${item.usageUnit??""}${item.usage.lastAt?` · last ${date(item.usage.lastAt)}`:""}`:"Not recorded for this capability"}</dd>
    </dl>
    <p className="agent-observation">Inspection only. Selecting a capability never invokes it; use happens through its workflow and approvals.</p>
  </section>;
}
function toolKind(kind:string){return ({connection:"Connection",source:"Source",handoff:"Handoff to the operating system",local:"Local access",executor:"Executor · approval required",model:"Model route"} as Record<string,string>)[kind]??kind}
