import {BookOpen,ShieldCheck,Code2,Network,ChevronRight,RefreshCw} from "lucide-react";
import {useEffect,useState} from "react";
import {commandCatalog,type CommandCatalogClient,type CommandCatalog,type CommandRole} from "../../services/commandAgents";
import {isTauriRuntime} from "../../services/launcher";
import "./commandAgents.css";

function RoleIcon({id}:{id:string}) {
  return id==="olympus"?<span className="agent-core-mark" aria-hidden="true">Ω</span>:id==="research"?<BookOpen/>:id==="verification"?<ShieldCheck/>:id==="coding-delegate"?<Code2/>:<Network/>;
}
function Stamp({role}:{role:CommandRole}) {return <span className="agent-status" data-tone={role.tone}><i aria-hidden="true"/>{role.status}</span>}
function Row({role,selected,onSelect}:{role:CommandRole;selected:boolean;onSelect:()=>void}) {
  return <button className="agent-role-row" data-selected={selected} aria-pressed={selected} onClick={onSelect}>
    <span className="agent-role-icon"><RoleIcon id={role.id}/></span>
    <span className="agent-role-copy"><strong>{role.name}{role.version!==null&&<small> @{role.version}</small>}</strong><span>{role.description}</span></span>
    <span className="agent-role-status"><Stamp role={role}/><ChevronRight size={13} aria-hidden="true"/></span>
  </button>;
}
const date=(value:string)=>new Date(value).toLocaleString(undefined,{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
export function CommandAgentCatalog({client=commandCatalog,available=isTauriRuntime(),selectedId,onSelect,onResearch,onProjects}:{
  client?:CommandCatalogClient;available?:boolean;selectedId?:string;onSelect?:(id:string)=>void;
  onResearch:(runId?:string)=>void;onProjects:()=>void;
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
  return <aside className="command-agent-catalog" aria-label="Agent Catalog" aria-busy={loading}>
    <header className="agent-catalog-header"><Network aria-hidden="true"/><div><h2>Agent Catalog</h2><p>{catalog?`1 orchestrator · ${catalog.agents.length} agents`:"Runtime inspection"}</p></div><button className="agent-refresh" title="Refresh runtime observations" aria-label="Refresh agent catalog" disabled={loading||!available} onClick={()=>setRevision(r=>r+1)}><RefreshCw size={14}/></button></header>
    {!available?<p className="agent-catalog-notice">Runtime catalog is available in the desktop app. Browser preview has no live agent observations.</p>:!catalog?<p className="agent-catalog-notice" role={error?"alert":"status"}>{error?`Catalog unavailable. ${error}`:"Reading runtime catalog…"}</p>:<>
      <div className="agent-catalog-list" aria-label="Operational runtime roles">
        <h3>Main orchestrator</h3><Row role={catalog.orchestrator} selected={role?.id===catalog.orchestrator.id} onSelect={()=>select(catalog.orchestrator.id)}/>
        <h3>Executable agents</h3>{catalog.agents.map(a=><Row key={a.id} role={a} selected={role?.id===a.id} onSelect={()=>select(a.id)}/>)}
      </div>
      {role&&<section className="agent-selected-detail" aria-label="Selected agent details" key={role.id}>
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
        </dl>
        {role.availability&&<p className="agent-observation">{role.availability}</p>}
        {role.kind==="legacy"&&<p className="agent-observation">{role.evidence}</p>}
        {Boolean(role.history?.recent.length)&&<div className="agent-recent-runs"><h4>Recent executions</h4>{role.history!.recent.map(r=><button key={r.id} onClick={()=>onResearch(r.parentRunId)} title={r.question}><span>{date(r.startedAt)} · @{r.version} · {r.status}</span><ChevronRight size={12}/></button>)}</div>}
      </section>}
      <footer>Read-only inspection <span>Observed {date(catalog.observedAt)}</span></footer>
    </>}
  </aside>;
}
