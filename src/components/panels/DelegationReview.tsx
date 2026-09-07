import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { fetchDelegationDiff, type DelegationRun } from "../../services/delegation";

interface Check { id: string; checkName: string; exitCode: number | null; output: string; workspaceHash: string }
interface Details { criteria: string[]; plan: string; checks: Check[]; approvals: string[] }

export function DelegationReview({ runId, onComplete }: { runId: string; onComplete: (run: DelegationRun) => void }) {
  const [details, setDetails] = useState<Details | null>(null);
  const [diff, setDiff] = useState("");
  const [hash, setHash] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [checkIds, setCheckIds] = useState<string[]>([]);
  const [issues, setIssues] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const before = await invoke<string>("delegation_review_fingerprint", { request: { runId } });
    const record = await invoke<Details>("fetch_delegation_review", { request: { runId } });
    const changes = await fetchDelegationDiff(runId);
    const after = await invoke<string>("delegation_review_fingerprint", { request: { runId } });
    if (before !== after) throw new Error("The workspace changed while loading review. Reopen it for a fresh diff.");
    setDetails(record); setDiff(changes); setHash(after); setReviewed(false);
    setNotes(record.criteria.map(() => "")); setCheckIds(record.criteria.map(() => ""));
  }, [runId]);
  useEffect(() => { void refresh().catch(e => setError(String(e))); }, [refresh]);

  async function check(checkId: string) {
    setBusy(true); setError("");
    try { await invoke("run_delegation_check", { request: { runId, checkId } }); await refresh(); }
    catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }
  async function complete() {
    if (!details) return;
    setBusy(true); setError("");
    try {
      const run = await invoke<DelegationRun>("complete_delegation_review", { request: {
        runId, workspaceHash: hash, unresolvedIssues: issues,
        evidence: details.criteria.map((criterion, i) => ({ criterion, note: notes[i], checkId: checkIds[i] || null }))
      } });
      onComplete(run);
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }
  return <section className="delegation-checkpoint" aria-label="Result review">
    <h4>Review the preserved result</h4>
    {error && <p className="delegation-error" role="alert">{error}</p>}
    {details && <>
      <details><summary>Recorded approvals</summary>{details.approvals.map(row => <p key={row}>{row}</p>)}</details>
      <details><summary>Plan</summary><pre>{details.plan}</pre></details>
      <details><summary>Workspace diff</summary><pre className="delegation-diff">{diff}</pre></details>
      <p>Run applicable checks. A successful process exit alone does not establish the requested outcome.</p>
      <div className="delegation-actions">
        {[["frontend-build", "Frontend build"], ["rust-tests", "Rust tests"], ["npm-test", "npm test"]].map(([id, label]) => <button className="delegation-action" key={id} disabled={busy} onClick={() => void check(id)}>{label}</button>)}
      </div>
      {details.checks.map(check => <details key={check.id}><summary>{check.checkName} · exit {check.exitCode ?? "unavailable"}{check.workspaceHash !== hash ? " · stale" : ""}</summary><pre className="delegation-diff">{check.output}</pre></details>)}
      {details.criteria.map((criterion, i) => <div key={i}>
        <label htmlFor={`evidence-${runId}-${i}`}>{criterion}</label>
        <textarea id={`evidence-${runId}-${i}`} className="observation-input" rows={3} value={notes[i] ?? ""} disabled={busy} placeholder="Describe what you observed and where to find the evidence (at least 20 characters)." onChange={e => setNotes(current => current.map((note, n) => n === i ? e.target.value : note))} />
        <label htmlFor={`check-${runId}-${i}`}>Evidence type</label>
        <select id={`check-${runId}-${i}`} className="observation-input" value={checkIds[i] ?? ""} disabled={busy} onChange={e => setCheckIds(current => current.map((id, n) => n === i ? e.target.value : id))}>
          <option value="">Manual artifact or behavior review — no automated test claim</option>
          {details.checks.filter(c => c.exitCode === 0 && c.workspaceHash === hash).map(c => <option key={c.id} value={c.id}>{c.checkName} · {c.id.slice(0, 8)}</option>)}
        </select>
      </div>)}
      <label htmlFor={`issues-${runId}`}>Unresolved issues (must be empty to complete)</label>
      <textarea id={`issues-${runId}`} className="observation-input" value={issues} disabled={busy} onChange={e => setIssues(e.target.value)} />
      <label><input type="checkbox" checked={reviewed} disabled={busy} onChange={e => setReviewed(e.target.checked)} /> I reviewed the diff and the evidence for every criterion.</label>
      <button className="delegation-action delegation-action--primary" disabled={busy || !reviewed || !!issues.trim() || notes.some(n => n.trim().length < 20)} onClick={() => void complete()}>{busy ? "Working…" : "Record review and complete"}</button>
    </>}
  </section>;
}
