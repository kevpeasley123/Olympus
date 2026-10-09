import { DelegationReview } from "./DelegationReview";
import { useDelegationRuns } from "../../hooks/useDelegationRuns";
import { Bot, GitBranch, Square, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  cancelDelegationRun,
  prepareDelegationRun,
  prepareDelegationResume,
  cancelDelegationProposal,
  fetchDelegationReview,
  type ApprovalProposal,
  type ReviewDetails,
  fetchDelegationDiff,
  resumeDelegationRun,
  startDelegationRun,
  type DelegationRun
} from "../../services/delegation";
import { isTauriRuntime } from "../../services/launcher";
import { formatWhen } from "../../services/time";
import { initialTask } from "../../services/projectCommandBoard";
import { preparedResumeApplies } from "../../services/delegationReview";
import { EMPTY_PROJECT_DRAFT, EMPTY_REVIEW_NOTES, projectDraftHasWork, pruneEndedReviewNotes, useViewEntry, useViewSlice, writeViewEntry } from "../../state/viewState";
import { Modal } from "../Modal";
import type { TrackedProject } from "../../types";
import "./projects.css";

interface DelegationPanelProps {
  project: TrackedProject;
  /** Why Prepare would be refused, if it would; from `prepareBlocker`. */
  blocker: string | null;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isActive(run: DelegationRun): boolean {
  return ["preparing", "planning", "editing", "testing", "reviewing"].includes(run.phase);
}

const terminal = (run: DelegationRun) => ["complete", "failed", "cancelled"].includes(run.phase);

/**
 * A prepared approval is backend state with its own expiry. Held at module
 * scope, keyed by project, so a glance at Command does not orphan it; the
 * backend still refuses it once expired or replaced.
 */
const preparedByProject = new Map<string, { proposal: ApprovalProposal; resuming: boolean }>();

export function DelegationPanel({ project, blocker }: DelegationPanelProps) {
  const projectId = project.id;
  const [drafts] = useViewSlice("projectDrafts");
  const draft = drafts[projectId] ?? null;
  const [, setDraft] = useViewEntry("projectDrafts", projectId, EMPTY_PROJECT_DRAFT);
  const [prepared, setPreparedState] = useState(() => preparedByProject.get(projectId) ?? null);
  const setPrepared = useCallback((value: { proposal: ApprovalProposal; resuming: boolean } | null) => {
    if (value) preparedByProject.set(projectId, value); else preparedByProject.delete(projectId);
    setPreparedState(value);
  }, [projectId]);
  useEffect(() => { setPreparedState(preparedByProject.get(projectId) ?? null); }, [projectId]);

  const [reviewNotes, setReviewNotes] = useViewSlice("reviewNotes");
  const { data: runs, refresh, error: runsError, lastSuccessAt } = useDelegationRuns();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<Record<string, string>>({});
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmStop, setConfirmStop] = useState<DelegationRun | null>(null);
  const desktop = isTauriRuntime();
  const blockerId = useId();

  const visibleRuns = useMemo(() => runs.filter(run => run.projectId === projectId), [runs, projectId]);
  const criteriaText = draft ? draft.criteria.join("\n") : "";
  const criteriaList = draft ? draft.criteria.map(line => line.trim()).filter(Boolean) : [];
  const draftChanged = projectDraftHasWork(draft, draft?.prefill ?? initialTask(project));

  // Notes for a run that has ended no longer describe anything to act on.
  useEffect(() => { pruneEndedReviewNotes(runs.filter(terminal).map(run => run.id)); }, [runs]);

  // A resume approval belongs to a run that is waiting. Once the run moves on
  // (stopped, resumed elsewhere, failed) the backend has revoked it, so the
  // cached proposal goes too rather than offering Approve for it.
  useEffect(() => {
    if (!prepared?.resuming) return;
    const runId = prepared.proposal.subject.runId;
    if (preparedResumeApplies(runId, runs, lastSuccessAt !== null)) return;
    void cancelDelegationProposal(prepared.proposal.id).catch(() => undefined);
    setPrepared(null);
  }, [prepared, runs, lastSuccessAt, setPrepared]);

  const reviewOpen = (runId: string) => Boolean(reviewNotes[runId]?.open);
  const setReviewOpen = (runId: string, open: boolean) => setReviewNotes(current => ({
    ...current, [runId]: { ...(current[runId] ?? EMPTY_REVIEW_NOTES), projectId, open }
  }));

  async function act(label: string, action: () => Promise<DelegationRun>) {
    setBusy(label);
    setError(null);
    try {
      const run = await action();
      await refresh();
      return run;
    } catch (reason) {
      setError(message(reason));
      return null;
    } finally {
      setBusy(null);
    }
  }

  function openDraft() {
    setError(null);
    const prefill = initialTask(project);
    setDraft({ task: prefill, criteria: [], prefill });
  }

  async function prepare(runId?: string) {
    setBusy(runId ? `prepare-${runId}` : "prepare"); setError(null);
    try {
      if (prepared) await cancelDelegationProposal(prepared.proposal.id).catch(() => undefined);
      setPrepared(null);
      const proposal = runId ? await prepareDelegationResume(runId) : await prepareDelegationRun(projectId, draft!.task, criteriaList);
      setPrepared({ proposal, resuming: Boolean(runId) });
    } catch (reason) { setError(message(reason)); }
    finally { setBusy(null); }
  }

  async function approve() {
    if (!prepared) return;
    const { proposal, resuming } = prepared;
    const run = await act("approve", () => resuming ? resumeDelegationRun(proposal.id) : startDelegationRun(proposal.id));
    setPrepared(null);
    if (run && !resuming) writeViewEntry("projectDrafts", projectId, null, EMPTY_PROJECT_DRAFT);
  }

  async function cancelReview() {
    if (prepared) await cancelDelegationProposal(prepared.proposal.id).catch(reason => setError(message(reason)));
    setPrepared(null);
  }

  async function discardDraft() {
    setConfirmDiscard(false);
    if (prepared && !prepared.resuming) await cancelReview();
    writeViewEntry("projectDrafts", projectId, null, EMPTY_PROJECT_DRAFT);
  }

  function requestDiscard() {
    if (draftChanged) setConfirmDiscard(true);
    else void discardDraft();
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

  async function stopRun(run: DelegationRun) {
    setConfirmStop(null);
    if (prepared?.proposal.subject.runId === run.id) setPrepared(null);
    await act(`cancel-${run.id}`, () => cancelDelegationRun(run.id));
  }

  const planningApproval = prepared && !prepared.resuming ? prepared.proposal : null;

  return (
    <section className="delegation-panel" aria-label="Coding agent delegation">
      <header className="delegation-panel__head">
        <div>
          <span className="delegation-panel__eyebrow">Coding agent</span>
          <h3>Claude Code delegation</h3>
        </div>
        <span className="delegation-panel__driver tabular-data">isolated · local · review first</span>
      </header>

      {!draft ? (
        <div className="delegation-prepare">
          <button type="button" className="delegation-action delegation-action--primary" disabled={Boolean(blocker) || busy !== null}
            aria-describedby={blocker ? blockerId : undefined} onClick={openDraft}>Prepare Claude run</button>
          {blocker ? <p id={blockerId} className="delegation-prepare__reason">{blocker}</p>
            : <p className="delegation-prepare__reason">Write a task and acceptance criteria. Olympus shows the exact scope before anything runs.</p>}
        </div>
      ) : (
        <article className="delegation-proposal">
          <button type="button" className="delegation-proposal__dismiss" onClick={requestDiscard}
            aria-label="Close run draft" disabled={busy !== null}>
            <X size={14} />
          </button>
          <span className="delegation-panel__label">Proposed task · {project.name}</span>
          <p>Proposed work — not execution approval.</p>
          {blocker && <p className="delegation-prepare__reason" role="status">{blocker} Your draft is kept.</p>}
          <label className="delegation-panel__label" htmlFor={`delegation-task-${projectId}`}>Task</label>
          <textarea id={`delegation-task-${projectId}`} className="observation-input" rows={4} value={draft.task}
            disabled={busy !== null || planningApproval !== null}
            onChange={e => setDraft(current => ({ ...current, task: e.target.value }))} />
          <label className="delegation-panel__label" htmlFor={`delegation-criteria-${projectId}`}>Acceptance criteria — one per line</label>
          <textarea id={`delegation-criteria-${projectId}`} className="observation-input" rows={3} value={criteriaText}
            disabled={busy !== null || planningApproval !== null}
            onChange={e => setDraft(current => ({ ...current, criteria: e.target.value.split("\n") }))} />
          <div className="delegation-proposal__boundary">
            Olympus will create a dedicated branch and worktree. Claude will plan first and stop
            for your approval before editing. Nothing will be pushed or merged.
          </div>
          {!planningApproval && <div className="delegation-actions">
            <button type="button" className="delegation-action delegation-action--primary"
              disabled={!desktop || Boolean(blocker) || busy !== null || !draft.task.trim() || criteriaList.length === 0}
              onClick={() => void prepare()}>
              {busy === "prepare" ? "Preparing…" : "Review planning scope"}
            </button>
            <button type="button" className="delegation-action" onClick={requestDiscard} disabled={busy !== null}>Not now</button>
            {(!draft.task.trim() || criteriaList.length === 0) && <span className="delegation-prepare__reason">
              {!draft.task.trim() ? "Write the task." : "Add at least one acceptance criterion."}
            </span>}
          </div>}
          {planningApproval && <ApprovalSubject proposal={planningApproval} busy={busy}
            onApprove={() => void approve()} onCancel={() => void cancelReview()} />}
        </article>
      )}

      {error || runsError ? <p className="delegation-error" role="alert">{error || runsError}</p> : null}

      {visibleRuns.length > 0 ? (
        <div className="delegation-runs">
          {visibleRuns.map((run) => {
            const approval = prepared?.resuming && prepared.proposal.subject.runId === run.id ? prepared.proposal : null;
            const reviewing = reviewOpen(run.id) && ["awaiting_review", "testing"].includes(run.phase);
            return <article key={run.id} className={`delegation-run phase-${run.phase}`}>
              <div className="delegation-run__head">
                <div>
                  <span className="delegation-run__project">{run.projectName}</span>
                  <strong>{run.task}</strong>
                </div>
                <span className={`delegation-phase ${isActive(run) ? "is-active" : ""}`}>
                  {run.phase.replace(/_/g, " ")}
                </span>
              </div>

              <div className="delegation-run__meta tabular-data">
                <span><Bot size={12} aria-hidden="true" /> {run.driver} · {run.model}</span>
                <span><GitBranch size={12} aria-hidden="true" /> {run.branch}</span>
                <span>started {formatWhen(run.startedAt)} · updated {formatWhen(run.updatedAt)}</span>
              </div>
              <p className="delegation-run__milestone">{run.milestone}</p>

              {run.checkpoint ? (
                <section className="delegation-checkpoint">
                  <span className="delegation-panel__label">Decision checkpoint</span>
                  <p>{run.checkpoint}</p>
                </section>
              ) : null}

              {run.phase === "waiting" && !approval ? <PlanDisclosure run={run} /> : null}

              {run.outcome ? (
                <section className="delegation-outcome">
                  <OutcomeLabel run={run} />
                  <p>{run.outcome}</p>
                  {run.diffSummary ? <pre>{run.diffSummary}</pre> : null}
                  {run.changedFiles.length > 0 ? (
                    <p>{run.changedFiles.join(" · ")}</p>
                  ) : null}
                </section>
              ) : run.phase === "complete" ? <section className="delegation-outcome"><OutcomeLabel run={run} /></section> : null}

              {run.error ? <p className="delegation-error">{run.error}</p> : null}

              {approval && <ApprovalSubject proposal={approval} busy={busy}
                onApprove={() => void approve()} onCancel={() => void cancelReview()} />}

              <div className="delegation-actions">
                {run.phase === "waiting" && !approval ? (
                  <button type="button" className="delegation-action delegation-action--primary" disabled={busy !== null}
                    onClick={() => void prepare(run.id)}>
                    {busy === `prepare-${run.id}` ? "Preparing…" : "Review approval scope"}
                  </button>
                ) : null}
                {run.phase === "awaiting_review" && !reviewing ? (
                  <button type="button" className="delegation-action delegation-action--primary" onClick={() => setReviewOpen(run.id, true)}>Review result and evidence</button>
                ) : null}
                {reviewing ? <button type="button" className="delegation-action" onClick={() => setReviewOpen(run.id, false)}>Hide review</button> : null}
                {["awaiting_review", "complete", "failed", "cancelled"].includes(run.phase) && !reviewing ? (
                  <button type="button" className="delegation-action" disabled={busy !== null} onClick={() => void reviewDiff(run.id)}>
                    {diffs[run.id] ? "Hide diff" : "Review diff"}
                  </button>
                ) : null}
                {!terminal(run) ? (
                  <button type="button" className="delegation-action delegation-action--quiet" disabled={busy !== null} onClick={() => setConfirmStop(run)}>
                    <Square size={10} aria-hidden="true" />
                    {busy === `cancel-${run.id}` ? "Stopping…" : "Stop run…"}
                  </button>
                ) : null}
              </div>
              {run.phase === "waiting" && !approval ? <p className="delegation-prepare__reason">Reviewing the approval scope starts a timed approval window. Reading the plan above does not.</p> : null}

              {reviewing && <DelegationReview runId={run.id} projectId={projectId} onComplete={() => { void refresh(); }} />}
              {diffs[run.id] && !reviewing ? (
                <pre className="delegation-diff">{diffs[run.id]}</pre>
              ) : null}
            </article>;
          })}
        </div>
      ) : null}

      <Modal open={confirmDiscard} onClose={() => setConfirmDiscard(false)} role="alertdialog" title="Discard this run draft?"
        description="The task and acceptance criteria you wrote for this project will be lost. Nothing has been sent." className="projects-confirm">
        <div className="delegation-actions">
          <button type="button" className="delegation-action delegation-action--primary" onClick={() => setConfirmDiscard(false)}>Keep editing</button>
          <button type="button" className="delegation-action" onClick={() => void discardDraft()}>Discard</button>
        </div>
      </Modal>
      <Modal open={confirmStop !== null} onClose={() => setConfirmStop(null)} role="alertdialog" title="Stop this run?"
        description="Olympus stops any running agent or check process tree and revokes pending approval. The branch, worktree and diff are preserved. A stopped run cannot be resumed." className="projects-confirm">
        {confirmStop && <p className="projects-confirm__subject">{confirmStop.task}</p>}
        <div className="delegation-actions">
          <button type="button" className="delegation-action delegation-action--primary" onClick={() => setConfirmStop(null)}>Keep running</button>
          <button type="button" className="delegation-action delegation-action--danger" onClick={() => confirmStop && void stopRun(confirmStop)}>Stop run</button>
        </div>
      </Modal>
    </section>
  );
}

/** A completed run's review time never changes; read it once per run per session. */
const reviewedAtByRun = new Map<string, string>();

function OutcomeLabel({ run }: { run: DelegationRun }) {
  const [reviewedAt, setReviewedAt] = useState<string | null | undefined>(() => reviewedAtByRun.get(run.id));
  useEffect(() => {
    if (run.phase !== "complete") return;
    const known = reviewedAtByRun.get(run.id);
    if (known) { setReviewedAt(known); return; }
    let live = true;
    fetchDelegationReview(run.id).then(details => {
      if (details.reviewedAt) reviewedAtByRun.set(run.id, details.reviewedAt);
      if (live) setReviewedAt(details.reviewedAt ?? null);
    }).catch(() => { if (live) setReviewedAt(null); });
    return () => { live = false; };
  }, [run.id, run.phase]);
  if (run.phase === "complete") {
    return <span className="delegation-panel__label">{reviewedAt ? `Operator review recorded ${formatWhen(reviewedAt, { withDate: true })}` : "Operator review recorded"}</span>;
  }
  if (run.phase === "awaiting_review" || run.phase === "testing") return <span className="delegation-panel__label">Agent-reported outcome — unverified until review</span>;
  return <span className="delegation-panel__label">Agent-reported outcome — not reviewed</span>;
}

/** The recorded plan, read without preparing an approval or starting its timer (review U11). */
function PlanDisclosure({ run }: { run: DelegationRun }) {
  const [details, setDetails] = useState<ReviewDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  function load() {
    if (details || loading) return;
    setLoading(true);
    fetchDelegationReview(run.id).then(setDetails).catch(reason => setError(message(reason))).finally(() => setLoading(false));
  }
  return <details className="delegation-plan" onToggle={event => { if ((event.currentTarget as HTMLDetailsElement).open) load(); }}>
    <summary>Read the plan <span>read-only · no approval, no timer</span></summary>
    {loading && <p>Reading the recorded plan…</p>}
    {error && <p className="delegation-error">{error}</p>}
    {details && <dl className="delegation-subject">
      <dt>Base</dt><dd><abbr title={run.baseCommit}>{run.baseCommit.slice(0, 7)}</abbr> · workspace branch {run.branch}</dd>
      <dt>Criteria</dt><dd><ol>{details.criteria.map((criterion, i) => <li key={i}>{criterion}</li>)}</ol></dd>
      <dt>Plan</dt><dd><pre>{details.plan || "No plan was recorded; resuming would repeat planning."}</pre></dd>
    </dl>}
  </details>;
}

function useCountdown(expiresAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  return Math.max(0, Math.floor(expiresAt - now / 1000));
}

function permittedSentence(proposal: ApprovalProposal): string | null {
  const permitted = proposal.permitted;
  if (!permitted) return null;
  const tools = permitted.tools.join(", ");
  const reach = permitted.edits
    ? `Read, search and edit files in the isolated worktree (${tools})`
    : `Read and search the repository only (${tools}); no edits and no shell commands`;
  const commands = permitted.commands.length ? `; run only ${permitted.commands.join(", ")}` : "";
  const excluded = permitted.edits ? ` No ${permitted.excluded.filter(item => !item.includes("settings")).join(", ")}.` : "";
  return `${reach}${commands}.${excluded} Loads no settings files, hooks or MCP servers. $${permitted.budgetUsd} budget and ${permitted.launchLimitMinutes}-minute limit per launch, not per run.`;
}

function ApprovalSubject({ proposal, busy, onApprove, onCancel }: {
  proposal: ApprovalProposal; busy: string | null; onApprove: () => void; onCancel: () => void;
}) {
  const remaining = useCountdown(proposal.expiresAt);
  const expired = remaining <= 0;
  const subject = proposal.subject;
  // Null unless a branch's tip is exactly the base commit; the hash alone is
  // then the honest statement of what is approved.
  const branch = proposal.baseBranch;
  const sentence = permittedSentence(proposal);
  const stage = subject.stage === "plan" ? "Planning — read-only, stops for your approval before editing" : "Implementation — edits the isolated worktree";
  const titleId = useId();
  return <section className="delegation-approval" aria-labelledby={titleId}>
    <div className="delegation-approval__head">
      <span id={titleId} className="delegation-panel__label">Approval requested · {subject.stage === "plan" ? "planning" : "implementation"}</span>
      <span className={`delegation-approval__expiry ${expired ? "is-expired" : remaining < 60 ? "is-soon" : ""}`} role="timer" aria-live="off">
        {expired ? "Expired — prepare a fresh review" : `Expires in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}
      </span>
    </div>
    <dl className="delegation-subject">
      <dt>Project</dt><dd>{subject.projectName}</dd>
      <dt>Repository</dt><dd className="tabular-data">{subject.repository}</dd>
      <dt>Base</dt><dd className="tabular-data"><abbr title={subject.baseCommit}>{branch ? `${branch} @ ` : ""}{subject.baseCommit.slice(0, 7)}</abbr></dd>
      <dt>Stage</dt><dd>{stage}</dd>
      <dt>Driver</dt><dd>{subject.driver} · {subject.model}</dd>
      <dt>Permitted actions</dt><dd>{sentence ?? <><span>Scope not recognised by this build; exact text:</span> <code>{subject.scope}</code></>}</dd>
      <dt>Task</dt><dd><pre>{subject.task}</pre></dd>
      <dt>Criteria</dt><dd><ol>{subject.criteria.map((criterion, i) => <li key={i}>{criterion}</li>)}</ol></dd>
      {subject.plan ? <><dt>Plan</dt><dd><pre>{subject.plan}</pre></dd></> : null}
      <dt>Workspace</dt><dd className="tabular-data">{subject.workspace}</dd>
    </dl>
    {subject.scope.includes("guidance-sha256=") && <p className="delegation-prepare__reason">Hephaestus will receive Superpowers pilot v1 guidance for planning, debugging, testing and evidence-based review. Review the full instructions in the exact scope below. This does not load external plugins or expand tool permissions.</p>}
    {sentence && <details className="delegation-approval__scope"><summary>Exact scope text</summary><code>{subject.scope}</code></details>}
    <p className="delegation-prepare__reason">Approval covers exactly this task, base and scope in this desktop session. Any change needs a fresh review.</p>
    <div className="delegation-actions">
      <button type="button" className="delegation-action delegation-action--primary delegation-action--approve" disabled={busy !== null || expired} onClick={onApprove}>
        {busy === "approve" ? "Starting…" : subject.stage === "plan" ? "Approve planning" : "Approve implementation"}
      </button>
      <button type="button" className="delegation-action delegation-action--quiet" disabled={busy !== null} onClick={onCancel}>{expired ? "Close" : "Cancel review"}</button>
    </div>
  </section>;
}
