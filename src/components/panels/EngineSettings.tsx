import { Fragment, useState } from "react";
import { isTauriRuntime } from "../../services/launcher";
import { describeSignIn, loadEngineStatus, type EngineStatus } from "../../services/engines";
import "./command.css";

/**
 * Codex and Claude Code, checked the way Olympus launches them: which install it
 * found and which sign-in that launch would use. The check runs when opened, not
 * at startup, because each one starts both CLIs.
 */
export function EngineSettings() {
  const [engines, setEngines] = useState<EngineStatus[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const desktop = isTauriRuntime();

  async function check() {
    if (!desktop) return;
    setChecking(true);
    try {
      setEngines(await loadEngineStatus());
      setError(null);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setChecking(false);
    }
  }

  return (
    <details className="model-diagnostics engine-settings" onToggle={event => { if (event.currentTarget.open && !engines) void check(); }}>
      <summary>Subscription engines</summary>
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
        Olympus runs engines only on a subscription sign-in and never passes them an API key. Delegated Claude Code
        runs are refused otherwise. Codex is checked here; nothing in Olympus launches it yet.
      </p>
    </details>
  );
}
