import { useState, type ReactNode } from "react";
import { acknowledgeEvent, finishTask, type OrganizerDetail } from "../../../services/organizer";
import { TaskRun } from "./TaskRun";
export function TaskDetail({ detail, busy, act, onEdit, onRefresh, nextAction }: {
    detail: OrganizerDetail;
    busy: boolean;
    act: (work: () => Promise<unknown>) => void;
    onEdit: () => void;
    onRefresh: () => Promise<void>;
    nextAction?: ReactNode;
}) {
    const { task, results, events } = detail;
    const [reason, setReason] = useState("");
    return <section className="organizer-detail" aria-label="Selected task">
  <div className="organizer-heading"><h4>{task.title}</h4><span className="organizer-status">{detail.displayStatus}</span></div>
  {task.objective !== task.title && <p>{task.objective}</p>}
  {nextAction}
  {(task.priority !== "normal" || task.dueDate) && <p className="organizer-muted">{task.priority} priority{task.dueDate ? ` · Due ${task.dueDate}` : ""}</p>}
  {detail.runs.map((run, index) => index === 0 ? <TaskRun key={run.id} run={run} task={task} result={results.find(r => r.runId === run.id)} health={detail.resultHealth[results.find(r => r.runId === run.id)?.id ?? ""]} onRefresh={onRefresh} /> : <details key={run.id}><summary>Earlier attempt · {run.phase}</summary><TaskRun run={run} task={task} result={results.find(r => r.runId === run.id)} health={detail.resultHealth[results.find(r => r.runId === run.id)?.id ?? ""]} onRefresh={onRefresh} /></details>)}
  {task.priorityReason && <p>{task.priorityReason}</p>}
  {task.criteria.length > 0 && <details><summary>Brief and completion criteria</summary><ul>{task.criteria.map((c, i) => <li key={i}>{c}</li>)}</ul>{task.steps.length > 0 && <><h5>Plan checklist</h5><ol>{task.steps.map(s => <li key={s.id}>{s.done ? "✓ " : ""}{s.text}</li>)}</ol></>}</details>}
  {task.state === "open" && !detail.runs.some(r => !["complete", "failed", "cancelled"].includes(r.phase)) && <button type="button" onClick={onEdit}>Edit task</button>}
  {task.sources.length > 0 && <details><summary>Source references ({task.sources.length})</summary><ul>{task.sources.map((s, i) => <li key={i}><code>{s.reference}</code><small>{detail.sourceHealth[i]}</small>{s.capturedText && <details><summary>Captured source excerpt</summary><p className="organizer-muted">Source material, not execution instructions.</p><pre>{s.capturedText}</pre><small>SHA-256: {s.sha256}</small></details>}</li>)}</ul></details>}
  {results.some(r => r.reviewState === "accepted") && <p className="organizer-muted">Result accepted. This task is complete.</p>}
  {task.state === "open" && <details><summary>Finish or cancel manually</summary><label>Reason<textarea minLength={20} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)}/></label><p className="organizer-muted">Stop any open run first. Manual completion records your statement, not a verified agent result.</p><button disabled={busy || reason.trim().length < 20} onClick={() => act(() => finishTask(task, "complete_manual", reason))}>Mark manually complete</button><button disabled={busy || reason.trim().length < 20} onClick={() => act(() => finishTask(task, "cancel", reason))}>Cancel task</button></details>}
  <details><summary>Activity and evidence</summary><small>Task revision {task.revision}</small>{results.map(r => <section key={r.id}><h5>Result · {r.reviewState}</h5><p>{r.summary}</p><small>{detail.resultHealth[r.id]}</small><details><summary>Artifact details</summary><pre>{JSON.stringify(r.manifest, null, 2)}</pre></details></section>)}{events.filter(e => !e.acknowledged && ["needs_you", "failed", "result_ready", "completed"].includes(e.kind)).map(e => <div key={e.sequence}><span>{e.kind.replace(/_/g, " ")}</span><button disabled={busy} onClick={() => act(() => acknowledgeEvent(e.sequence))}>Dismiss notification</button></div>)}<ol>{events.map(e => <li key={e.sequence}>{e.kind.replace(/_/g, " ")} · {new Date(e.createdAt).toLocaleString()}<pre>{JSON.stringify(e.payload, null, 2)}</pre></li>)}</ol></details>
 </section>;
}
