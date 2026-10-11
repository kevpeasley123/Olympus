import { useEffect, useState, useRef } from "react";
import { useOrganizer, refreshOrganizer } from "../../../hooks/useOrganizer";
import { useDelegationRuns } from "../../../hooks/useDelegationRuns";
import { adoptTask, canPrepareTask, fetchTask, moveTask, organizerMessage, prepareTask, type OrganizerDetail, type OrganizerTask } from "../../../services/organizer";
import { cancelDelegationProposal, startDelegationRun, type ApprovalProposal } from "../../../services/delegation";
import { ApprovalSubject } from "../DelegationPanel";
import { TaskEditor } from "./TaskEditor";
import { TaskDetail } from "./TaskDetail";
import "./organizer.css";
export function OrganizerPanel({ projectId, blocker }: {
    projectId: string;
    blocker: string | null;
}) {
    const store = useOrganizer();
    const delegation = useDelegationRuns();
    const [selected, setSelected] = useState<string | null>(null), [detail, setDetail] = useState<OrganizerDetail | null>(null), [editing, setEditing] = useState(false), [creating, setCreating] = useState(false);
    const [preparing, setPreparing] = useState(false);
    const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [proposal, setProposal] = useState<ApprovalProposal | null>(null);
    const generation = useRef(0);
    const navigation = useRef(0);
    const [proposalTaskId, setProposalTaskId] = useState<string | null>(null);
    function leaveApproval() {
        navigation.current++;
        if (proposal) void cancelDelegationProposal(proposal.id).catch(() => undefined);
        setProposal(null);
    }
    useEffect(() => () => { navigation.current++; }, []);
    const rows = store.data.filter(r => r.task.projectId === projectId).sort((a, b) => Number(b.task.state === "open") - Number(a.task.state === "open"));
    useEffect(() => { navigation.current++; setSelected(null); setDetail(null); setEditing(false); setCreating(false); setPreparing(false); setProposal(null); generation.current++; }, [projectId]);
    useEffect(() => { const ticket = ++generation.current; if (!selected) {
        setDetail(null);
        return;
    } setDetail(current => current?.task.id === selected ? current : null); void fetchTask(selected).then(d => { if (ticket === generation.current)
        setDetail(d); }).catch(e => { if (ticket === generation.current)
        setError(organizerMessage(e)); }); return () => { generation.current++; }; }, [selected, store.data, delegation.data]);
    async function refresh() { await Promise.all([refreshOrganizer(), delegation.refresh()]); if (selected) {
        const id = selected;
        const d = await fetchTask(id);
        setDetail(current => current?.task.id === id ? d : current);
    } }
    async function act(work: () => Promise<unknown>) { setBusy(true); setError(null); try {
        await work();
        await refresh();
    }
    catch (e) {
        setError(organizerMessage(e));
        await refresh().catch(() => { });
    }
    finally {
        setBusy(false);
    } }
    function save(work: () => Promise<OrganizerTask>) {
        const ticket = navigation.current;
        void act(async () => {
            const saved = await work();
            if (ticket !== navigation.current) return;
            setSelected(saved.id); setCreating(false); setEditing(false);
            if (preparing) {
                const prepared = await prepareTask(saved);
                if (ticket !== navigation.current) { await cancelDelegationProposal(prepared.id); return; }
                setProposalTaskId(saved.id); setProposal(prepared); setPreparing(false);
            }
        });
    }
    const task = detail?.task;
    const nextAction = task && detail ? <>
    {task!.state === "open" && task!.intent === "proposed" && <button disabled={busy} onClick={() => void act(() => adoptTask(task!))}>Adopt as my task</button>}
    {task!.state === "open" && task!.intent === "committed" && !detail.runs.some(r => !["complete", "failed", "cancelled"].includes(r.phase)) && !detail.results.some(r => r.reviewState === "pending") && !proposal && <div className="organizer-launch"><button className="organizer-primary" disabled={busy || !canPrepareTask(task!, delegation.data, blocker)} onClick={() => setPreparing(true)}>Start work</button><small>{blocker ?? "Review the brief, then let the coding agent propose a plan."}</small></div>}
  {proposal && proposalTaskId === selected && <div className="delegation-panel"><ApprovalSubject compact proposal={proposal} busy={busy ? "organizer" : null} onCancel={() => void act(async () => { await cancelDelegationProposal(proposal.id); setProposal(null); })} onApprove={() => void act(async () => { const p = proposal; setProposal(null); await startDelegationRun(p.id); })}/></div>}
    </> : null;
    return <section className="organizer-panel" aria-label="Project Organizer">
  <header className="organizer-heading"><div><span className="organizer-eyebrow">Organizer</span><h3>Your tasks</h3></div><button className={selected || creating ? undefined : "organizer-primary"} disabled={busy || Boolean(store.error)} onClick={() => { leaveApproval(); setCreating(true); setPreparing(false); setEditing(false); setSelected(null); }}>New task</button></header>
  {store.loading && <p role="status">Loading your plan…</p>}
  {(error || store.error) && <div role="alert" className="organizer-error">{error || store.error}<button onClick={() => void refresh()}>Refresh</button></div>}
  {!store.loading && !store.error && rows.length === 0 && !creating && <p className="organizer-muted">No Organizer tasks yet. Capture a request. Work out the details when you are ready.</p>}
  <div className="organizer-layout"><nav aria-label="Organizer tasks">{rows.map((r, i) => <div className="organizer-task-row" key={r.task.id}><button className={selected === r.task.id ? "is-selected" : ""} aria-pressed={selected === r.task.id} onClick={() => { leaveApproval(); setSelected(r.task.id); setCreating(false); setEditing(false); setPreparing(false); setError(null); }}><strong>{r.task.title}</strong><small>{r.displayStatus} · {r.task.priority}{r.needsAttention ? " · Attention" : ""}</small></button>{r.task.state === "open" && i > 0 && rows[i - 1].task.priority === r.task.priority && <button aria-label={`Move ${r.task.title} up`} disabled={busy} onClick={() => void act(() => moveTask(r.task, rows[i - 1].task.id))}>↑</button>}</div>)}</nav>
   <div>{creating ? <TaskEditor key={`new:${projectId}`} projectId={projectId} task={null} busy={busy} onSave={save} onCancel={() => setCreating(false)}/> : (editing || preparing) && task ? <TaskEditor key={`${task.id}:${preparing}`} preparing={preparing} projectId={projectId} task={task} busy={busy} onSave={save} onCancel={() => { setEditing(false); setPreparing(false); }}/> : detail && detail.task.id === selected ? <><TaskDetail key={task!.id} detail={detail} nextAction={nextAction} busy={busy} act={work => void act(work)} onRefresh={refresh} onEdit={() => { leaveApproval(); setEditing(true); }}/>
   </> : selected ? <p role="status">Loading task…</p> : rows.length > 0 ? <p className="organizer-muted">Select a task to inspect its plan and results.</p> : null}</div>
  </div>

 </section>;
}
