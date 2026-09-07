import { DelegationReview } from "./DelegationReview";
import { listen } from "@tauri-apps/api/event";
import { Bot, GitBranch, Square, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cancelDelegationRun,
  prepareDelegationRun,
  prepareDelegationResume,
  cancelDelegationProposal,
  type ApprovalProposal,
  fetchDelegationDiff,
  listDelegationRuns,
  resumeDelegationRun,
  startDelegationRun,
  type DelegationRun
} from "../../services/delegation";
import { isTauriRuntime } from "../../services/launcher";

export interface DelegationProposal {
  projectId: string;
  projectName: string;
  task: string;
}

interface DelegationPanelProps {
  proposal: DelegationProposal | null;
  onDismissProposal: () => void;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isActive(run: DelegationRun): boolean {
  return ["preparing", "planning", "editing", "testing", "reviewing"].includes(run.phase);
}

export function DelegationPanel({
  proposal,
  onDismissProposal
}: DelegationPanelProps) {
  const [draftTask, setDraftTask] = useState("");
  const [criteria, setCriteria] = useState("");
  const [prepared, setPrepared] = useState<ApprovalProposal | null>(null);
  const [resuming, setResuming] = useState(false);
  const [reviewRun, setReviewRun] = useState<string | null>(null);
  useEffect(() => { setDraftTask(proposal?.task ?? ""); setCriteria(""); setPrepared(null); }, [proposal]);
  const [runs, setRuns] = useState<DelegationRun[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<Record<string, string>>({});
  const desktop = isTauriRuntime();

  const refresh = useCallback(async () => {
    if (!desktop) return;
    try {
      setRuns(await listDelegationRuns());
    } catch (reason) {
      setError(message(reason));
    }
  }, [desktop]);

  useEffect(() => {
    void refresh();
    if (!desktop) return;

    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<DelegationRun>("delegation-run-updated", (event) => {
      if (disposed) return;
      setRuns((current) => [
        event.payload,
        ...current.filter((run) => run.id !== event.payload.id)
      ]);
    }).then((dispose) => {
      if (disposed) dispose();
      else unlisten = dispose;
    });
    const timer = window.setInterval(() => void refresh(), 3_000);
    return () => {
      disposed = true;
      unlisten?.();
      window.clearInterval(timer);
    };
  }, [desktop, refresh]);

  const visibleRuns = useMemo(() => runs.slice(0, 5), [runs]);

  async function act(label: string, action: () => Promise<DelegationRun>) {
    setBusy(label);
    setError(null);
    try {
      const run = await action();
      setRuns((current) => [run, ...current.filter((item) => item.id !== run.id)]);
      return run;
    } catch (reason) {
      setError(message(reason));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function prepare(runId?: string) {
    setBusy("prepare"); setError(null); setPrepared(null);
    try {
      setResuming(Boolean(runId));
      setPrepared(runId ? await prepareDelegationResume(runId) : await prepareDelegationRun(proposal!.projectId, draftTask, criteria.split("\n").map(s => s.trim()).filter(Boolean)));
    } catch (reason) { setError(message(reason)); }
    finally { setBusy(null); }
  }

  async function approve() {
    if (!prepared) return;
    const run = await act("approve", () => resuming ? resumeDelegationRun(prepared.id) : startDelegationRun(prepared.id));
    setPrepared(null);
    if (run && !resuming) onDismissProposal();
  }

  async function dismissReview() {
    if (prepared) await cancelDelegationProposal(prepared.id).catch(reason => setError(message(reason)));
    setPrepared(null);
  }

  async function reviewDiff(runId: string) {
    if (diffs[runId]) {
      setDiffs((current) => {
        const next = { ...current };
        delete next[runId];
        return next;
      });
      return;
    }
    setBusy(`diff-${runId}`);
    setError(null);
    try {
      const diff = await fetchDelegationDiff(runId);
      setDiffs((current) => ({ ...current, [runId]: diff }));
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(null);
    }
  }

  if (!proposal && visibleRuns.length === 0) return null;

  return (
    <section className="delegation-panel" aria-label="Coding agent delegation">
      <header className="delegation-panel__head">
        <div>
          <span className="delegation-panel__eyebrow">Coding agent</span>
          <h3>Claude Code delegation</h3>
        </div>
        <span className="delegation-panel__driver tabular-data">isolated · local · review first</span>
      </header>

      {proposal ? (
        <article className="delegation-proposal">
          <button
            type="button"
            className="delegation-proposal__dismiss"
            onClick={() => { void dismissReview(); onDismissProposal(); }}
            aria-label="Dismiss delegation proposal"
            disabled={busy !== null}
          >
            <X size={14} />
          </button>
          <span className="delegation-panel__label">Proposed task · {proposal.projectName}</span>
          <p>Proposed work — not execution approval.</p>
          <label className="delegation-panel__label" htmlFor="delegation-task">Task</label>
          <textarea id="delegation-task" className="observation-input" rows={4} value={draftTask} disabled={busy !== null || prepared !== null} onChange={e => setDraftTask(e.target.value)} />
          <label className="delegation-panel__label" htmlFor="delegation-criteria">Acceptance criteria — one per line</label>
          <textarea id="delegation-criteria" className="observation-input" rows={3} value={criteria} disabled={busy !== null || prepared !== null} onChange={e => setCriteria(e.target.value)} />
          <div className="delegation-proposal__boundary">
            Olympus will create a dedicated branch and worktree. Claude will plan first and stop
            for your approval before editing. Nothing will be pushed or merged.
          </div>
          <div className="delegation-actions">
            <button
              type="button"
              className="delegation-action delegation-action--primary"
              disabled={!desktop || busy !== null || prepared !== null || !draftTask.trim() || !criteria.trim()}
              onClick={() => void prepare()}
            >
              {busy === "prepare" ? "Preparing…" : "Review planning scope"}
            </button>
            <button
              type="button"
              className="delegation-action"
              onClick={() => { void dismissReview(); onDismissProposal(); }}
              disabled={busy !== null}
            >
              Not now
            </button>
          </div>
          {!desktop ? (
            <p className="delegation-error">Delegation is available only in the desktop app.</p>
          ) : null}
        </article>
      ) : null}

      {prepared && <article className="delegation-checkpoint">
        <span className="delegation-panel__label">Operator review · {prepared.subject.stage}</span>
        <p>{prepared.subject.projectName} · {prepared.subject.driver} · {prepared.subject.model}</p>
        <p className="tabular-data">Base: {prepared.subject.baseCommit}</p>
        <pre>{prepared.subject.task}</pre>
        <ul>{prepared.subject.criteria.map((criterion, i) => <li key={i}>{criterion}</li>)}</ul>
        {prepared.subject.plan && <><span className="delegation-panel__label">Plan to implement</span><pre>{prepared.subject.plan}</pre></>}
        <p>{prepared.subject.scope}</p>
        <p className="tabular-data">Preserved workspace: {prepared.subject.workspace}</p>
        <p>Review expires at {new Date(prepared.expiresAt * 1000).toLocaleTimeString()}. Changes require fresh review.</p>
        <div className="delegation-actions">
          <button className="delegation-action" disabled={busy !== null} onClick={() => void dismissReview()}>Cancel review</button>
          <button className="delegation-action delegation-action--primary" disabled={busy !== null} onClick={() => void approve()}>{busy === "approve" ? "Starting…" : prepared.subject.stage === "plan" ? "Approve planning" : "Approve implementation"}</button>
        </div>
      </article>}

      {error ? <p className="delegation-error">{error}</p> : null}

      {visibleRuns.length > 0 ? (
        <div className="delegation-runs">
          {visibleRuns.map((run) => (
            <article key={run.id} className={`delegation-run phase-${run.phase}`}>
              <div className="delegation-run__head">
                <div>
                  <span className="delegation-run__project">{run.projectName}</span>
                  <strong>{run.task}</strong>
                </div>
                <span className={`delegation-phase ${isActive(run) ? "is-active" : ""}`}>
                  {run.phase}
                </span>
              </div>

              <div className="delegation-run__meta tabular-data">
                <span>
                  <Bot size={12} /> {run.driver} · {run.model}
                </span>
                <span>
                  <GitBranch size={12} /> {run.branch}
                </span>
              </div>
              <p className="delegation-run__milestone">{run.milestone}</p>

              {run.checkpoint ? (
                <section className="delegation-checkpoint">
                  <span className="delegation-panel__label">Decision checkpoint</span>
                  <p>{run.checkpoint}</p>
                </section>
              ) : null}

              {run.outcome ? (
                <section className="delegation-outcome">
                  <span className="delegation-panel__label">Agent-reported outcome — unverified until review</span>
                  <p>{run.outcome}</p>
                  {run.diffSummary ? <pre>{run.diffSummary}</pre> : null}
                  {run.changedFiles.length > 0 ? (
                    <p>{run.changedFiles.join(" · ")}</p>
                  ) : null}
                </section>
              ) : null}

              {run.error ? <p className="delegation-error">{run.error}</p> : null}

              <div className="delegation-actions">
                {run.phase === "waiting" ? (
                  <button
                    type="button"
                    className="delegation-action delegation-action--primary"
                    disabled={busy !== null}
                    onClick={() =>
                      void prepare(run.id)
                    }
                  >
                    {busy === "prepare" ? "Preparing…" : "Review resume scope"}
                  </button>
                ) : null}
                {!["complete", "failed", "cancelled"].includes(run.phase) ? (
                  <button
                    type="button"
                    className="delegation-action"
                    disabled={busy !== null}
                    onClick={() =>
                      void act(`cancel-${run.id}`, () => cancelDelegationRun(run.id))
                    }
                  >
                    <Square size={10} />
                    {busy === `cancel-${run.id}` ? "Cancelling…" : "Cancel"}
                  </button>
                ) : null}
                {["awaiting_review", "complete", "failed", "cancelled"].includes(run.phase) ? (
                  <button
                    type="button"
                    className="delegation-action"
                    disabled={busy !== null}
                    onClick={() => void reviewDiff(run.id)}
                  >
                    {diffs[run.id] ? "Hide diff" : "Review diff"}
                  </button>
                ) : null}
              </div>

              {run.phase === "awaiting_review" && <button className="delegation-action delegation-action--primary" onClick={() => setReviewRun(reviewRun === run.id ? null : run.id)}>Review result and evidence</button>}
              {reviewRun === run.id && ["awaiting_review", "testing"].includes(run.phase) && <DelegationReview runId={run.id} onComplete={updated => { setRuns(current => [updated, ...current.filter(r => r.id !== updated.id)]); setReviewRun(null); }} />}
              {diffs[run.id] ? (
                <pre className="delegation-diff">{diffs[run.id]}</pre>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
