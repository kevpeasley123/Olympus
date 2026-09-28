import { useCallback, useEffect, useState } from "react";
import {
  completeDelegationReview,
  fetchDelegationDiff,
  fetchDelegationReview,
  fetchReviewFingerprint,
  runDelegationCheck,
  type DelegationRun,
  type ReviewDetails
} from "../../services/delegation";
import {
  checkLabel,
  checkSupportsWorkspace,
  completionChecklist,
  MIN_NOTE_CHARS,
  noteLength,
  reconcileReviewNotes
} from "../../services/delegationReview";
import { EMPTY_REVIEW_NOTES, useViewEntry } from "../../state/viewState";
import { formatWhen } from "../../services/time";
import "./projects.css";

interface DelegationReviewProps {
  runId: string;
  projectId: string;
  onComplete: (run: DelegationRun) => void;
}

/**
 * The operator's review of a preserved result. Notes, check selections, the
 * acknowledgement and unresolved issues live in the session view store
 * (`reviewNotes`), so a check, a poll, a refresh or a mode switch never erases
 * them (review U3). Validity is re-derived on every read.
 */
export function DelegationReview({ runId, projectId, onComplete }: DelegationReviewProps) {
  const [entry, setEntry] = useViewEntry("reviewNotes", runId, EMPTY_REVIEW_NOTES);
  const [details, setDetails] = useState<ReviewDetails | null>(null);
  const [diff, setDiff] = useState("");
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [invalidated, setInvalidated] = useState<string | null>(null);
  const checklistId = `review-checklist-${runId}`;

  const refresh = useCallback(async () => {
    const before = await fetchReviewFingerprint(runId);
    const record = await fetchDelegationReview(runId);
    const changes = await fetchDelegationDiff(runId);
    const after = await fetchReviewFingerprint(runId);
    if (before !== after) throw new Error("The workspace changed while loading review. Reopen it for a fresh diff.");
    setDetails(record); setDiff(changes); setHash(after);
    let message: string | null = null;
    setEntry(current => {
      const { next, invalidated: reason } = reconcileReviewNotes(current, {
        hash: after, approvals: record.approvals, checks: record.checks, criteriaCount: record.criteria.length
      }, projectId);
      message = reason;
      return next;
    });
    if (message) setInvalidated(message);
    return record;
  }, [runId, projectId, setEntry]);
  useEffect(() => { void refresh().catch(e => setError(String(e))); }, [refresh]);

  const notes = entry.notes;
  const evidence = entry.evidence;
  const issues = entry.issues ?? "";
  const setField = (index: number, key: "notes" | "evidence", value: string) =>
    setEntry(current => ({ ...current, projectId, [key]: current[key].map((item, i) => i === index ? value : item) }));

  async function check(checkId: string) {
    const previous = new Set(details?.checks.map(item => item.id) ?? []);
    setBusy(true); setRunning(checkId); setError("");
    try {
      await runDelegationCheck(runId, checkId);
    } catch (e) { setError(String(e)); }
    try {
      const record = await refresh();
      // The fresh result opens so its output is read, not assumed.
      const fresh = record.checks.find(item => !previous.has(item.id));
      if (fresh) setExpanded(fresh.id);
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); setRunning(null); }
  }

  const checklist = details ? completionChecklist({
    criteria: details.criteria, notes, evidence, checks: details.checks, options: details.availableChecks,
    hash, reviewed: entry.reviewed, issues, running
  }) : [];
  const unmet = checklist.filter(item => !item.met);

  async function complete() {
    if (!details || unmet.length) return;
    setBusy(true); setError("");
    try {
      const run = await completeDelegationReview({
        runId, workspaceHash: hash, unresolvedIssues: issues,
        evidence: details.criteria.map((criterion, i) => ({ criterion, note: notes[i] ?? "", checkId: evidence[i] || null }))
      });
      setEntry(null);
      onComplete(run);
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  }

  const runningLabel = running && details ? checkLabel(running, details.availableChecks) : null;

  return <section className="delegation-review" aria-label="Result review">
    <h4>Review the preserved result</h4>
    {error && <p className="delegation-error" role="alert">{error}</p>}
    {invalidated && <div className="delegation-review__notice" role="status">
      <p>{invalidated}</p>
      <button type="button" className="delegation-action" onClick={() => setInvalidated(null)}>Dismiss</button>
    </div>}
    {!details && !error && <p className="delegation-review__hint">Reading the recorded contract, checks and diff…</p>}
    {details && <>
      <details className="delegation-review__disclosure"><summary>Recorded approvals</summary>{details.approvals.map(row => <p key={row}>{row}</p>)}</details>
      <details className="delegation-review__disclosure"><summary>Plan</summary><pre>{details.plan || "No plan recorded."}</pre></details>
      <details className="delegation-review__disclosure"><summary>Workspace diff · fingerprint {hash.slice(0, 8)}</summary><pre className="delegation-diff">{diff}</pre></details>

      <div className="delegation-review__group">
        <h5>Checks</h5>
        <p className="delegation-review__hint">A successful process exit alone does not establish the requested outcome. Each check runs build and test scripts from this worktree, which the agent could have changed. It runs without API keys in its environment, but it is not sandboxed.</p>
        <div className="delegation-actions">
          {details.availableChecks.map(option => <button type="button" className="delegation-action" key={option.id} disabled={busy || !!option.unavailable} title={option.unavailable ?? "Runs code written by the agent"} onClick={() => void check(option.id)}>{running === option.id ? `Running ${option.label}…` : `${option.label} · runs agent code`}</button>)}
        </div>
        {runningLabel && <p className="delegation-review__running" role="status">Running {runningLabel}… The result opens here when it finishes.</p>}
        {details.availableChecks.filter(option => option.unavailable).map(option => <p className="delegation-review__hint" key={option.id}>{option.label}: {option.unavailable}</p>)}
        {details.checks.map(item => {
          const stale = item.workspaceHash !== hash;
          const status = item.exitCode === null ? "did not finish" : item.exitCode === 0 ? "passed" : `failed · exit ${item.exitCode}`;
          return <details key={item.id} className={`delegation-review__check ${item.exitCode === 0 && !stale ? "is-pass" : "is-fail"}`} open={expanded === item.id}
            onToggle={event => { const open = (event.currentTarget as HTMLDetailsElement).open; setExpanded(current => open ? item.id : current === item.id ? null : current); }}>
            <summary>{checkLabel(item.checkName, details.availableChecks)} · {status}{stale ? " · stale" : ""}{item.finishedAt ? ` · ${formatWhen(item.finishedAt)}` : ""}</summary>
            <pre className="delegation-diff">{item.output}</pre>
          </details>;
        })}
      </div>

      <div className="delegation-review__group">
        <h5>Evidence per criterion</h5>
        {details.criteria.map((criterion, i) => {
          const length = noteLength(notes[i] ?? "");
          const valid = details.checks.filter(item => checkSupportsWorkspace(item, hash));
          return <div className="delegation-review__criterion" key={i}>
            <label htmlFor={`evidence-${runId}-${i}`}><span className="delegation-review__index">{i + 1}</span>{criterion}</label>
            <textarea id={`evidence-${runId}-${i}`} className="observation-input" rows={3} value={notes[i] ?? ""} disabled={busy}
              aria-describedby={`evidence-count-${runId}-${i}`}
              placeholder="What you observed and where to find it (at least 20 characters)."
              onChange={e => setField(i, "notes", e.target.value)} />
            <span id={`evidence-count-${runId}-${i}`} className={`delegation-review__count ${length >= MIN_NOTE_CHARS ? "is-met" : ""}`}>{length}/{MIN_NOTE_CHARS} characters minimum</span>
            <label htmlFor={`check-${runId}-${i}`} className="delegation-review__sublabel">Evidence type</label>
            <select id={`check-${runId}-${i}`} className="observation-input" value={evidence[i] ?? ""} disabled={busy} onChange={e => setField(i, "evidence", e.target.value)}>
              <option value="">Manual artifact or behavior review — no automated test claim</option>
              {valid.map(item => <option key={item.id} value={item.id}>{checkLabel(item.checkName, details.availableChecks)} · passed{item.finishedAt ? ` ${formatWhen(item.finishedAt)}` : ` · ${item.id.slice(0, 8)}`}</option>)}
            </select>
          </div>;
        })}
      </div>

      <div className="delegation-review__group">
        <label htmlFor={`issues-${runId}`}>Unresolved issues <span>must be empty to complete; not stored</span></label>
        <textarea id={`issues-${runId}`} className="observation-input" rows={2} value={issues} disabled={busy} onChange={e => setEntry(current => ({ ...current, projectId, issues: e.target.value }))} />
        <label className="delegation-review__ack"><input type="checkbox" checked={entry.reviewed} disabled={busy} onChange={e => setEntry(current => ({ ...current, projectId, reviewed: e.target.checked }))} /> I reviewed the diff and the evidence for every criterion.</label>
      </div>

      <div className="delegation-review__complete">
        <ul id={checklistId} className="delegation-review__checklist" aria-label="Completion requirements">
          {checklist.map(item => <li key={item.text} className={item.met ? "is-met" : "is-unmet"}><span aria-hidden="true">{item.met ? "✓" : "✗"}</span><span className="projects-sr-only">{item.met ? "Met: " : "Not met: "}</span>{item.text}</li>)}
        </ul>
        <button type="button" className="delegation-action delegation-action--primary" aria-describedby={checklistId} disabled={busy || unmet.length > 0} onClick={() => void complete()}>
          {busy && !running ? "Working…" : "Record review and complete"}
        </button>
        {unmet.length > 0 && <p className="delegation-review__hint">{unmet.length} {unmet.length === 1 ? "condition" : "conditions"} left.</p>}
      </div>
    </>}
  </section>;
}
