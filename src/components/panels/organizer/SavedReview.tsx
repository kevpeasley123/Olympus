import { useState } from "react";
import { fetchDelegationDiff, fetchDelegationReview, type ReviewDetails } from "../../../services/delegation";
import { organizerMessage } from "../../../services/organizer";

export function SavedReview({ runId }: { runId: string }) {
  const [review, setReview] = useState<ReviewDetails | null>(null);
  const [diff, setDiff] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true); setError("");
    try {
      // Retain recorded evidence even if the workspace has gone away.
      setReview(await fetchDelegationReview(runId));
      setDiff(await fetchDelegationDiff(runId));
    } catch (e) { setError(organizerMessage(e)); }
    finally { setBusy(false); }
  }
  return <details onToggle={e => { if (e.currentTarget.open && !review && !busy) void load(); }}>
    <summary>Inspect saved review</summary>
    {busy && <p role="status">Loading review…</p>}
    {error && <p role="alert">{error} <button disabled={busy} onClick={() => void load()}>Retry</button></p>}
    {review && <>
      <p className="organizer-muted">Review recorded {review.reviewedAt ?? "at an unknown time"}. The diff below reflects the current preserved workspace.</p>
      <h5>Plan</h5><pre>{review.plan || "No plan recorded."}</pre>
      <h5>Completion evidence</h5>
      {review.recordedEvidence?.map((item, i) => <section key={i}><strong>{item.criterion}</strong><p>{item.note}</p><small>{item.checkId ? `Recorded check: ${item.checkId}` : "Manual review"}</small></section>)}
      {!review.recordedEvidence?.length && <p>No criterion notes available in this record.</p>}
      <h5>Checks</h5>{review.checks.length === 0 && <p>No automated checks recorded.</p>}
      {review.checks.map(check => <details key={check.id}><summary>{check.checkName} · recorded exit {check.exitCode ?? "unknown"}</summary><pre>{check.output}</pre></details>)}
      <details><summary>Recorded approvals</summary>{review.approvals.map((item, i) => <p key={i}>{item}</p>)}</details>
    </>}
    {diff && <><h5>Current workspace diff</h5><pre>{diff}</pre></>}
  </details>;
}
