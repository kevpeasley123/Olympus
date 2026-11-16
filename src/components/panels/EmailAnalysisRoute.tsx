import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../../services/launcher";

const SETTING = "email.analysis.provider.v1";

/** Sits beside the analysis status so the fix is where the problem is reported. */
export function EmailAnalysisRoute({ onChange }: { onChange?: () => void }) {
  const [route, setRoute] = useState<string | null>(null), [error, setError] = useState("");
  useEffect(() => {
    if (!isTauriRuntime()) return;
    void invoke<{ settings: Record<string, string> }>("load_persisted_state")
      .then(({ settings }) => setRoute(settings[SETTING] ?? ""), () => setRoute(null));
  }, []);
  if (route === null) return null;
  async function save(provider: string) {
    try { await invoke("save_settings", { settings: { [SETTING]: provider } }); setRoute(provider); setError(""); onChange?.(); }
    catch (e) { setError(String(e)); }
  }
  return <>
    <label className="gmail-horizon">Email analysis <select aria-label="Email analysis" value={route} onChange={e => void save(e.target.value)}>
      <option value="" disabled>From .env (not chosen here)</option>
      <option value="claude-code">Claude subscription</option>
      <option value="codex">Codex subscription</option>
      <option value="ollama">Local model</option>
    </select></label>
    {error && <p role="alert">{error}</p>}
  </>;
}
