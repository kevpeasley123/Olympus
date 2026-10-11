import { useState } from "react";
import { ApprovalSubject, PlanDisclosure } from "../DelegationPanel";
import { DelegationReview } from "../DelegationReview";
import { Modal } from "../../Modal";
import { SavedReview } from "./SavedReview";
import { cancelDelegationProposal, cancelDelegationRun, prepareDelegationResume, resumeDelegationRun, fetchReviewFingerprint, type ApprovalProposal, type DelegationRun } from "../../../services/delegation";
import { acceptResult, fetchTask, organizerMessage, type OrganizerResult, type OrganizerTask } from "../../../services/organizer";

/** Run actions stay with their task; all execution still uses backend approvals. */
export function TaskRun({ run, task, result, health, onRefresh }: { result?: OrganizerResult; health?: string; run: DelegationRun; task: OrganizerTask; onRefresh: () => Promise<void> }) {
  const [proposal, setProposal] = useState<ApprovalProposal | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const terminal = ["complete", "failed", "cancelled"].includes(run.phase);
  async function act(work: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await work(); }
    catch (e) { setError(organizerMessage(e)); }
    finally { await onRefresh().catch(e => setError(organizerMessage(e))); setBusy(false); }
  }
  async function finish(_run: DelegationRun, hash: string) {
    // Fetch the reconciled result created by the just-recorded review. Keep the
    // original task revision so an intervening task edit cannot be accepted.
    const latest = await fetchTask(task.id);
    const result = latest.results.find(r => r.runId === run.id && r.reviewState === "pending");
    if (!result) throw new Error("The reviewed result is not available yet. Refresh and try again.");
    await acceptResult(task, result, hash);
    await onRefresh();
  }
  return <section className="organizer-run" aria-label="Task progress" id={`delegation-run-${run.id}`}>
    <h5>{run.phase === "waiting" ? "Your plan is ready" : run.phase === "awaiting_review" || run.phase === "complete" ? "Your result" : "Progress"}</h5>
    <p>{run.outcome || run.milestone}</p>
    {run.checkpoint && <p className="organizer-muted">{run.checkpoint}</p>}
    {run.error && <p role="alert" className="organizer-error">{run.error}</p>}
    {error && <p role="alert" className="organizer-error">{error}</p>}
    {run.phase === "waiting" && <>
      <PlanDisclosure run={run} />
      {!proposal && <button className="organizer-primary" disabled={busy} onClick={() => void act(async () => setProposal(await prepareDelegationResume(run.id)))}>Review plan</button>}
      {proposal && <ApprovalSubject compact proposal={proposal} busy={busy ? "approve" : null}
        onCancel={() => void act(async () => { await cancelDelegationProposal(proposal.id); setProposal(null); })}
        onApprove={() => void act(async () => { await resumeDelegationRun(proposal.id); setProposal(null); })} />}
    </>}
    {run.phase === "awaiting_review" && !reviewing && <button className="organizer-primary" onClick={() => setReviewing(true)}>Review result</button>}
    {reviewing && ["awaiting_review", "testing"].includes(run.phase) && <DelegationReview compact runId={run.id} projectId={task.projectId} completeLabel="Accept result and finish" onComplete={async (completed, hash) => {
      try { await finish(completed, hash); }
      catch (e) { setError(`Review recorded; task not yet completed. ${organizerMessage(e)}`); throw e; }
      finally { await onRefresh(); }
    }} />}
    {run.phase === "complete" && task.state === "open" && result?.reviewState === "pending" && <button className="organizer-primary" disabled={busy} onClick={() => void act(async () => finish(run, await fetchReviewFingerprint(run.id)))}>Accept reviewed result</button>}
    {result?.reviewState === "superseded" && <p className="organizer-muted">This result belongs to an earlier version of the task.</p>}
    {health && <p className="organizer-muted">{health}</p>}
    {run.phase === "complete" && <SavedReview runId={run.id} />}
    <details><summary>Run details</summary>
      <p className="organizer-muted">{run.driver} · {run.model} · {run.phase}</p>
      <code>{run.branch}</code>
      {run.diffSummary && <pre>{run.diffSummary}</pre>}
      {run.changedFiles.length > 0 && <ul>{run.changedFiles.map(file => <li key={file}>{file}</li>)}</ul>}
      {!terminal && <button disabled={busy} onClick={() => setStopping(true)}>Stop work…</button>}
    </details>
    <Modal open={stopping} onClose={() => setStopping(false)} role="alertdialog" title="Stop this task's work?" description="The agent stops. Its files and results are kept, but this run cannot resume.">
      <button onClick={() => setStopping(false)}>Keep working</button>
      <button disabled={busy} onClick={() => void act(async () => { await cancelDelegationRun(run.id); setProposal(null); setStopping(false); })}>Stop work</button>
    </Modal>
  </section>;
}
