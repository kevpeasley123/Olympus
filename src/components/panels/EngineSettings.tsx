import { Fragment, useRef, useState } from "react";
import { isTauriRuntime } from "../../services/launcher";
import { describeBilling, describeSignIn, loadEngineStatus, type EngineStatus } from "../../services/engines";
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
        <option value="codex">Codex subscription — blocked pending verification</option>
        <option value="legacy-api">Legacy API — API charges may apply</option>
        <option disabled>Claude subscription — not implemented</option>
      </select></label>
      <p>Selection lasts for this app session. No automatic fallback. Subscription chat is text-only; billing and tool isolation remain unverified.</p>
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
        Sign-in is not proof that paid overage is disabled. Subscription generation and delegation stay blocked. Legacy API conversation requires an explicit choice.
      </p>
      <p>To select an exact installation, set OLYMPUS_CODEX or OLYMPUS_CLAUDE_CODE to its full executable path before starting Olympus. An invalid override is refused, without selecting another installation. This check never changes sign-in or billing.</p>
    </details>
  );
}
