import { Fragment, useEffect, useRef, useState } from "react";
import { isTauriRuntime } from "../../services/launcher";
import { confirmClaudeSubscription, describeBilling, describeSignIn, loadClaudeAuthorization, loadEngineStatus, revokeClaudeSubscription, type ClaudeSubscriptionAuthorization, type EngineStatus } from "../../services/engines";
import "./command.css";
import {useConversationProvider,selectConversationProvider} from "../../services/conversationProvider";

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
        <option value="claude-code">{claude?.confirmedAt ? "Claude subscription — Max allowance only" : "Claude subscription — needs your confirmation"}</option>
      </select></label>
      <p>Selection lasts for this app session. No automatic fallback. Subscription chat is text-only. Included-plan billing must be verified before generation; quota readings do not grant permission to spend.</p>
      {desktop && claude ? (
        <fieldset className="claude-subscription-confirmation">
          <legend>Claude subscription chat</legend>
          {claude.confirmedAt ? (
            <p role="status">Confirmed for {claude.email} on {new Date(claude.confirmedAt).toLocaleString()}. Each message first checks that this Max account is still the one signed in, and stops otherwise.</p>
          ) : (
            <p>Olympus cannot see your Claude billing settings. Confirm only after turning off usage credits at claude.ai, Settings &gt; Usage. Olympus records the Max account signed in now and refuses to chat under any other.</p>
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
        No-extra-spend policy: API reasoning, OpenAI voice, background analysis and memory synthesis are blocked without separate spending approval. ElevenLabs speaks only while usage-based billing is off and your plan has characters left for the reply. Your saved settings are preserved. Subscription sign-in is not proof that usage credits are disabled: Claude chat needs your confirmation above, and Codex chat runs only while the account reports no purchased credits. Delegation stays blocked.
      </p>
      <p>To select an exact installation, set OLYMPUS_CODEX or OLYMPUS_CLAUDE_CODE to its full executable path before starting Olympus. An invalid override is refused, without selecting another installation. This check never changes sign-in or billing.</p>
    </details>
  );
}
