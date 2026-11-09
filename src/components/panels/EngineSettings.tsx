import { Fragment, useEffect, useRef, useState } from "react";
import { isTauriRuntime } from "../../services/launcher";
import { confirmClaudeSubscription, describeBilling, describeSignIn, loadClaudeAuthorization, loadEngineStatus, revokeClaudeSubscription, type ClaudeSubscriptionAuthorization, type EngineStatus } from "../../services/engines";
import "./command.css";
import {useConversationProvider,selectConversationProvider} from "../../services/conversationProvider";
import {loadCodexAuthorization,confirmCodexSubscription,revokeCodexSubscription,type CodexSubscriptionAuthorization} from "../../services/engines";
import {invoke} from "@tauri-apps/api/core";

/**
 * Codex and Claude Code, checked the way Olympus launches them: which install it
 * found and which sign-in that launch would use. The check runs when opened, not
 * at startup, because each one starts both CLIs.
 */
export function EngineSettings({autoInspect=true,inspection}:{autoInspect?:boolean;inspection?:{available:boolean;load:()=>Promise<EngineStatus[]>}}={}) {
  const provider = useConversationProvider();
  const [engines, setEngines] = useState<EngineStatus[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const desktop = inspection?.available ?? isTauriRuntime();
  const inFlight = useRef(false);
  const [claude, setClaude] = useState<ClaudeSubscriptionAuthorization | null>(null);
  const [claudeBusy, setClaudeBusy] = useState(false);
  const [codex, setCodex] = useState<CodexSubscriptionAuthorization|null>(null);
  const [codexBusy, setCodexBusy] = useState(false);
  const [briefRoute,setBriefRoute] = useState("ollama");
  const [briefWorkflow,setBriefWorkflow] = useState("legacy");
  const [memoryRoute,setMemoryRoute] = useState("claude-code");
  const [routesLoaded,setRoutesLoaded] = useState(false);
  useEffect(()=>{if(desktop&&!inspection){
    void loadCodexAuthorization().then(setCodex,()=>setCodex(null));
    void invoke<{settings:Record<string,string>}>("load_persisted_state").then(({settings})=>{
      setBriefRoute(settings["briefing.provider.v1"]??"ollama");setBriefWorkflow(settings["briefing.workflow.v1"]??"legacy");setRoutesLoaded(true);
      setMemoryRoute(settings["chatMemory.provider.v1"]??"claude-code");
    },()=>setRoutesLoaded(false));
  }},[desktop,inspection]);
  async function changeCodex(action:()=>Promise<CodexSubscriptionAuthorization>){setCodexBusy(true);try{setCodex(await action());setError(null)}catch(e){setError(String(e))}finally{setCodexBusy(false)}}
  async function saveBriefRoute(provider:string,workflow:string){
    try{await invoke("save_settings",{settings:{"briefing.provider.v1":provider,"briefing.workflow.v1":workflow}});setBriefRoute(provider);setBriefWorkflow(workflow);setError(null)}catch(e){setError(String(e))}
  }
  async function saveMemoryRoute(provider:string){
    try{await invoke("save_settings",{settings:{"chatMemory.provider.v1":provider}});setMemoryRoute(provider);setError(null)}catch(e){setError(String(e))}
  }
  useEffect(() => { if (desktop && !inspection) loadClaudeAuthorization().then(setClaude, () => setClaude(null)); }, [desktop, inspection]);

  async function changeClaude(action: () => Promise<ClaudeSubscriptionAuthorization>) {
    setClaudeBusy(true);
    try { setClaude(await action()); setError(null); }
    catch (reason) { setError(String(reason)); }
    finally { setClaudeBusy(false); }
  }

  async function check() {
    if (!desktop || inFlight.current) return;
    inFlight.current = true;
    setChecking(true);
    try {
      setEngines(await (inspection?.load ?? loadEngineStatus)());
      setError(null);
    } catch (reason) {
      setEngines(null);
      setError(String(reason));
    } finally {
      inFlight.current = false;
      setChecking(false);
    }
  }

  return (
    <details className="model-diagnostics engine-settings" onToggle={event => { if (autoInspect && event.currentTarget.open && !engines) void check(); }}>
      <summary>Subscription engines</summary>
      <label>Conversation provider <select aria-label="Conversation provider" value={provider ?? ""} onChange={event=>selectConversationProvider(event.target.value)}>
        <option value="" disabled>Choose explicitly</option>
        <option value="codex">Codex subscription — only with no purchased credits</option>
        <option value="legacy-api">Legacy API — blocked without spending approval</option>
        <option value="claude-code">{claude?.confirmedAt ? "Claude subscription" : "Claude subscription — needs your confirmation"}</option>
      </select></label>
      <p>Your subscription choice is remembered. Each turn still checks eligibility. No automatic fallback. Subscription reasoning uses your provider-owned sign-in and requires your account confirmation.</p>
      {desktop&&codex?<fieldset><legend>Codex subscription</legend>
        <p>{codex.confirmed?`Confirmed for ${codex.email}. Olympus checks this account and its available allowance before each turn.`:"Turn off paid extra usage and automatic credit purchases in your ChatGPT account before confirming."}</p>
        <p><q>{codex.statement}</q></p>
        <button type="button" className="ghost-action" disabled={codexBusy} onClick={()=>void changeCodex(codex.confirmed?revokeCodexSubscription:()=>confirmCodexSubscription(codex.statement))}>{codexBusy?"Checking sign-in…":codex.confirmed?"Withdraw confirmation":"I confirm"}</button>
      </fieldset>:null}
      {desktop&&routesLoaded?<fieldset><legend>Opening briefs</legend>
        <label>Reasoning engine <select aria-label="Reasoning engine" value={briefRoute} onChange={e=>void saveBriefRoute(e.target.value,briefWorkflow)}><option value="codex">Codex subscription</option><option value="claude-code">Claude subscription</option><option value="ollama">Local model</option></select></label>
        <label>Briefing workflow <select aria-label="Briefing workflow" value={briefWorkflow} onChange={e=>void saveBriefRoute(briefRoute,e.target.value)}><option value="investigative">Investigate changes and context</option><option value="legacy">Previous briefing workflow</option><option value="shadow">Compare without publishing; keep previous brief</option></select></label>
        <p>Applies to the next brief. An unavailable engine reports the problem without switching providers.</p>
        <label>Memory updates <select aria-label="Memory updates" value={memoryRoute} onChange={e=>void saveMemoryRoute(e.target.value)}><option value="codex">Codex subscription</option><option value="claude-code">Claude subscription</option><option value="ollama">Local model</option></select></label>
        <p>When conversation memory is enabled, this engine prepares durable notes from eligible conversations.</p>
      </fieldset>:null}
      {desktop && claude ? (
        <fieldset className="claude-subscription-confirmation">
          <legend>Claude subscription chat</legend>
          {claude.confirmedAt ? (
            <p role="status">Confirmed for {claude.email} on {new Date(claude.confirmedAt).toLocaleString()}. Each message checks that this subscription account is still signed in.</p>
          ) : (
            <p>Olympus cannot see your Claude billing settings. Confirm after turning off extra usage at claude.ai. Confirmation is bound to the subscription account signed in now.</p>
          )}
          <p><q>{claude.statement}</q></p>
          {claude.confirmedAt
            ? <button type="button" className="ghost-action" disabled={claudeBusy} onClick={() => void changeClaude(revokeClaudeSubscription)}>Withdraw confirmation</button>
            : <button type="button" className="ghost-action" disabled={claudeBusy} onClick={() => void changeClaude(() => confirmClaudeSubscription(claude.statement))}>{claudeBusy ? "Checking sign-in…" : "I confirm"}</button>}
        </fieldset>
      ) : null}
      {!desktop ? <p role="status">Engine checks run in the desktop app.</p> : null}
      {engines ? (
        <dl className="model-diagnostics-routes">
          {engines.map(engine => (
            <Fragment key={engine.engine}>
              <dt>{engine.name}</dt>
              <dd>
                {describeSignIn(engine)}
                {engine.version ? <><br />{engine.version}</> : null}
                {engine.executable ? <><br /><small>{engine.executable}</small></> : null}
                <br /><small>Selection: {engine.selection}. CLI status checked {new Date(engine.observedAt).toLocaleString()}.</small>
                <br />{describeBilling(engine.billing)}
                <br /><small>{engine.capabilities.source}</small>
              </dd>
            </Fragment>
          ))}
        </dl>
      ) : null}
      {desktop ? (
        <button type="button" className="ghost-action" onClick={() => void check()} disabled={checking}>
          {checking ? "Checking…" : "Check again"}
        </button>
      ) : null}
      {error ? <p role="status">{error}</p> : null}
      <p>
        Paid API fallback is disabled. Your confirmation records that extra usage is off; it is not a provider-enforced per-request spending cap. Olympus checks account identity, isolates tools, and stops when the runtime reports a limit or extra-credit use. Coding delegation has separate checks.
      </p>
      <p>To select an exact installation, set OLYMPUS_CODEX or OLYMPUS_CLAUDE_CODE to its full executable path before starting Olympus. An invalid override is refused, without selecting another installation. This check never changes sign-in or billing.</p>
    </details>
  );
}
