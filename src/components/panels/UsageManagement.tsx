import {useEffect,useState} from "react";
import {ArrowLeft,ChevronRight,ExternalLink,Plus,ShieldCheck} from "lucide-react";
import {EngineSettings} from "./EngineSettings";
import {managementClient,type ManagementClient,type ManagedService} from "../../services/usageManagement";
import type {ManagementDestination} from "../../services/managementNavigation";
import {openExternalLink} from "../../services/externalLink";
export type ManagementView="subscriptions"|"apis";
const services=[
 {id:"elevenlabs",name:"ElevenLabs",description:"Voice synthesis",auth:"In voice settings, choose ElevenLabs as the speech provider if desired. Its existing setup opens a Windows password dialog and saves the key in Windows Credential Manager. No key is entered in this screen.",cost:"Speech synthesis and voice previews can consume paid credits. A saved key does not establish balance or connection health.",verify:"Use Check connection in the existing voice settings when you choose. Voice preview is a separate paid action.",url:"https://elevenlabs.io/",target:"voice"},
 {id:"gmail",name:"Gmail",description:"Read-only mailbox context",auth:"The existing setup uses a Desktop OAuth client and your browser's consent flow. Tokens stay in Windows Credential Manager.",cost:"Mailbox sync imports a bounded local cache. Background AI understanding may use separately configured metered reasoning; no Gmail quota is inferred here.",verify:"Review saved account state and the existing sync status. Connecting or synchronizing is an explicit action in Gmail settings.",url:"https://myaccount.google.com/",target:"gmail"},
 {id:"models",name:"API model routes",description:"Reasoning, transcription and speech",auth:"API keys are configured in the native backend environment. This screen has no key field. API routes are separate from subscription engines.",cost:"API inference and audio may incur provider charges. No automatic fallback or model request occurs here.",verify:"Inspect the existing model diagnostics. Availability means configured, not a successful paid request. Choose a supported route explicitly from the conversation model picker.",url:"https://platform.openai.com/",target:"models"}
] as const;
export function UsageManagement({view,selection,onSelect,onBack,onHandoff,readings,onReading,client=managementClient}:{readings:Partial<Record<ManagedService,string>>;onReading:(id:ManagedService,value:string)=>void;view:ManagementView;selection:string|null;onSelect:(value:string|null)=>void;onBack:()=>void;onHandoff:(target:ManagementDestination)=>void;client?:ManagementClient}){
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 useEffect(()=>setError(""),[selection]);
 const service=services.find(s=>s.id===selection);
 async function inspect(id:ManagedService){setBusy(true);setError("");try{const result=await client.inspect(id);onReading(id,result);}catch(e){setError(String(e));}finally{setBusy(false);}}
 return <section className="usage-management">
 <button className="usage-management__back" onClick={()=>{if(selection)onSelect(null);else onBack()}}><ArrowLeft size={16}/>{selection?"Back to services":"Back to usage"}</button>
 <h2 tabIndex={-1}>{view==="subscriptions"?"Manage subscriptions":selection==="add"?"Add a service":service?.name??"Manage APIs"}</h2>
 {view==="subscriptions"?<>
 <p>Codex and Claude Code are supported subscription engines. Subscription sign-in, billing eligibility and account telemetry are separate checks.</p>
 <div className="usage-management__surface"><EngineSettings autoInspect={false} inspection={{available:client.available,load:client.engines}}/></div>
 <div className="usage-management__steps"><div><span>01</span><h3>Choose an engine</h3><p>Use the existing session-only provider choice. Nothing changes until you select it.</p></div><div><span>02</span><h3>Sign in outside Olympus</h3><p>Use the engine's own subscription login. Executable overrides are user-managed environment configuration.</p></div><div><span>03</span><h3>Inspect before use</h3><p>Check installed engines explicitly. Billing and tool-isolation gates remain closed.</p></div></div>
 <p className="usage-management__notice"><ShieldCheck size={16}/> Installed CLI capabilities are evidence, not a live model catalog. Subscription model discovery and local-model onboarding are not wired.</p>
 <div className="usage-management__links"><a href="https://chatgpt.com/" onClick={e=>openExternalLink(e,"https://chatgpt.com/")}>ChatGPT account <ExternalLink size={13}/></a><a href="https://claude.ai/" onClick={e=>openExternalLink(e,"https://claude.ai/")}>Claude account <ExternalLink size={13}/></a></div>
 </>:selection==="add"?<>
 <p>Grow the Armory from provider documentation, integration requirements and reusable skills.</p>
 <div className="usage-management__surface"><h3>Record integration material</h3><p>The existing Armory intake saves resources or review instructions. It does not install code, connect an account, grant tools or activate a service.</p><ol><li>Choose the provider or service you want to explore.</li><li>Capture its capabilities, authentication requirements and cost terms as a resource.</li><li>Review whether a supported adapter exists before any separate connection or installation.</li></ol><button onClick={()=>onHandoff("armory")}><Plus size={16}/>Continue in Armory intake</button></div>
 <p>Return from the Armory drawer to this management view. New executable integrations remain future work.</p>
 </>:service?<>
 <p>{service.description}</p><div className="usage-management__steps"><div><span>01</span><h3>Authentication</h3><p>{service.auth}</p></div><div><span>02</span><h3>Cost &amp; scope</h3><p>{service.cost}</p></div><div><span>03</span><h3>Verify deliberately</h3><p>{service.verify}</p></div></div>
 <div className="usage-management__surface"><h3>Local configuration evidence</h3><p className="usage-management__reading">{readings[service.id]??"Not checked. Opening this view does not inspect credentials or contact the provider."}</p><button disabled={!client.available||busy} onClick={()=>void inspect(service.id)}>{busy?"Checking local state...":"Check local configuration"}</button>{!client.available&&<p>Configuration inspection is available in desktop Olympus.</p>}<p>Account telemetry is not connected. No balance, quota or live connection is inferred.</p></div>
 <div className="usage-management__actions"><button onClick={()=>onHandoff(service.target)}>Open existing {service.id==="elevenlabs"?"voice":service.id==="models"?"model":"Gmail"} settings <ChevronRight size={15}/></button><a href={service.url} onClick={e=>openExternalLink(e,service.url)}>Provider account <ExternalLink size={13}/></a></div>
 </>:<>
 <p>Inspect supported integrations and continue through their existing setup paths. Nothing is checked or connected automatically.</p><div className="usage-management__services">{services.map(s=><button aria-label={s.name} key={s.id} onClick={()=>onSelect(s.id)}><span><strong>{s.name}</strong><small>{s.description}</small></span><ChevronRight size={18}/></button>)}</div><button onClick={()=>onSelect("add")}><Plus size={16}/>Add service</button><p className="usage-management__notice">These are supported integration paths, not a claim that accounts are connected. Generic service installation is not implemented.</p>
 </>}{error&&<p role="alert">{error}</p>}
 </section>;
}
