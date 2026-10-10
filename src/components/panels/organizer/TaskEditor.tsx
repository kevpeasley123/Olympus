import { useEffect, useState } from "react";
import { createTask, updateTask, taskInputOf, type OrganizerTask, type TaskInput } from "../../../services/organizer";
const drafts = new Map<string, {
    input: TaskInput;
    base: OrganizerTask | null;
}>();
export function TaskEditor({ projectId, task, onSave, onCancel, busy }: {
    projectId: string;
    task: OrganizerTask | null;
    onSave: (work: () => Promise<OrganizerTask>) => void;
    onCancel: () => void;
    busy: boolean;
}) {
    const key = task?.id ?? `new:${projectId}`;
    const fresh = (): TaskInput => task ? taskInputOf(task) : ({ projectId, title: "", objective: "", criteria: [""], steps: [], priority: "normal", priorityReason: "", dueDate: null, sources: [], intent: "committed" });
    const [input, setInput] = useState<TaskInput>(() => drafts.get(key)?.input ?? fresh());
    const [base, setBase] = useState<OrganizerTask | null>(() => drafts.get(key)?.base ?? task);
    useEffect(() => { drafts.set(key, { input, base }); }, [key, input, base]);
    const change = <K extends keyof TaskInput>(k: K, v: TaskInput[K]) => setInput(i => ({ ...i, [k]: v }));
    function save() { const clean = { ...taskInputOf(input), sources: input.sources.filter(s => s.reference.trim()) }; const { projectId: _project, ...patch } = clean; onSave(async () => { const t = base ? await updateTask(base, patch) : await createTask(clean); drafts.delete(key); return t; }); }
    return <form className="organizer-editor" aria-label="Task editor" onSubmit={e => { e.preventDefault(); save(); }}>
  <div className="organizer-heading"><h4>{task ? "Edit task" : "New task"}</h4><button type="button" onClick={onCancel} disabled={busy}>Keep draft and close</button></div>
  {task && base && task.revision !== base.revision && <p role="status">A newer revision is available. Your draft is retained. <button type="button" onClick={() => { setInput(taskInputOf(task)); setBase(task); }}>Discard draft and load latest</button></p>}
  <label>Title<input required maxLength={160} value={input.title} onChange={e => change("title", e.target.value)}/></label>
  <label>Objective<textarea required rows={3} maxLength={8000} value={input.objective} onChange={e => change("objective", e.target.value)}/></label>
  <label>Acceptance criteria — one per line<textarea required rows={3} value={input.criteria.join("\n")} onChange={e => change("criteria", e.target.value.split("\n"))}/></label>
  <div className="organizer-fields"><label>Priority<select value={input.priority} onChange={e => change("priority", e.target.value as TaskInput["priority"])}><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></label><label>Due date (optional)<input type="date" value={input.dueDate ?? ""} onChange={e => change("dueDate", e.target.value || null)}/></label></div>
  <label>Why this priority?<input maxLength={2000} value={input.priorityReason} onChange={e => change("priorityReason", e.target.value)}/></label>
  <fieldset><legend>Plan checklist</legend>{input.steps.map((s, n) => <div className="organizer-step" key={s.id || `new-${n}`}>
   <input aria-label={`Step ${n + 1} complete`} type="checkbox" checked={s.done} onChange={e => change("steps", input.steps.map((x, i) => i === n ? { ...x, done: e.target.checked } : x))}/>
   <input aria-label={`Step ${n + 1}`} maxLength={500} value={s.text} onChange={e => change("steps", input.steps.map((x, i) => i === n ? { ...x, text: e.target.value } : x))}/>
   <button type="button" aria-label={`Move step ${n + 1} up`} disabled={n === 0} onClick={() => { const steps = [...input.steps]; [steps[n - 1], steps[n]] = [steps[n], steps[n - 1]]; change("steps", steps); }}>↑</button>
   <button type="button" aria-label={`Remove step ${n + 1}`} onClick={() => change("steps", input.steps.filter((_, i) => i !== n))}>Remove</button>
  </div>)}<button type="button" disabled={input.steps.length >= 30} onClick={() => change("steps", [...input.steps, { id: "", text: "", done: false }])}>Add step</button></fieldset>
  <label>Source references — HTTPS URLs or vault-relative paths, one per line<textarea rows={2} value={input.sources.map(s => s.reference).join("\n")} onChange={e => change("sources", e.target.value.split("\n").map(reference => input.sources.find(s => s.reference === reference) ?? { kind: reference.startsWith("https://") ? "url" : "vault", reference, capturedText: null, sha256: null, line: null }))}/></label>
  <label>Intent<select value={input.intent} onChange={e => change("intent", e.target.value as TaskInput["intent"])}><option value="committed">My planned task</option><option value="proposed">Suggestion to consider</option></select></label>
  <p className="organizer-muted">Saving a task records your plan. Execution still requires its own review.</p>
  <button className="organizer-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save task"}</button>
 </form>;
}
