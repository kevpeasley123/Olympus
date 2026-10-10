import {useState} from "react";
import {acceptResult,acknowledgeEvent,finishTask,type OrganizerDetail} from "../../../services/organizer";
import {fetchReviewFingerprint} from "../../../services/delegation";
export function TaskDetail({detail,busy,act,onEdit}:{detail:OrganizerDetail;busy:boolean;act:(work:()=>Promise<unknown>)=>void;onEdit:()=>void}){
 const {task,results,events}=detail;const [reason,setReason]=useState("");
 return <section className="organizer-detail" aria-label="Selected task">
  <div className="organizer-heading"><h4>{task.title}</h4><span className="organizer-status">{detail.displayStatus}</span></div>
  <p>{task.objective}</p><p className="organizer-muted">{task.priority} priority{task.dueDate?` · Due ${task.dueDate}`:""} · Revision {task.revision}</p>
  {task.priorityReason&&<p>{task.priorityReason}</p>}
  <h5>Acceptance criteria</h5><ul>{task.criteria.map((c,i)=><li key={i}>{c}</li>)}</ul>
  {task.steps.length>0&&<><h5>Plan checklist</h5><ol>{task.steps.map(s=><li key={s.id}>{s.done?"✓ ":""}{s.text}</li>)}</ol></>}
  {task.state==="open"&&<button type="button" onClick={onEdit}>Edit task</button>}
  {task.sources.length>0&&<details><summary>Source references ({task.sources.length})</summary><ul>{task.sources.map((s,i)=><li key={i}><code>{s.reference}</code><small>{detail.sourceHealth[i]}</small></li>)}</ul></details>}
  {results.map(r=><section className="organizer-result" key={r.id}><h5>Result · {r.reviewState}</h5><p>{r.summary||"No summary recorded."}</p><small>{detail.resultHealth[r.id]}</small><a href={`#delegation-run-${r.runId}`}>Inspect run and review evidence below</a>
   {r.reviewState==="pending"&&task.state==="open"&&<button className="organizer-primary" disabled={busy||detail.runs.find(x=>x.id===r.runId)?.phase!=="complete"} onClick={()=>act(async()=>acceptResult(task,r,await fetchReviewFingerprint(r.runId)))}>Accept reviewed result and complete task</button>}
   {r.reviewState==="pending"&&detail.runs.find(x=>x.id===r.runId)?.phase!=="complete"&&<small>Complete the run's criterion review below before accepting.</small>}
   <details><summary>Recorded artifact manifest</summary><pre>{JSON.stringify(r.manifest,null,2)}</pre></details>
  </section>)}
  {events.filter(e=>!e.acknowledged&&["needs_you","failed","result_ready","completed"].includes(e.kind)).map(e=><div className="organizer-attention" key={e.sequence}><span>{e.kind.replace(/_/g," ")}</span><button disabled={busy} onClick={()=>act(()=>acknowledgeEvent(e.sequence))}>Acknowledge</button></div>)}
  {task.state==="open"&&<details><summary>Finish or cancel manually</summary><label>Reason<textarea minLength={20} maxLength={2000} value={reason} onChange={e=>setReason(e.target.value)} /></label><p className="organizer-muted">Stop any open run first. Manual completion records your statement, not a verified agent result.</p><button disabled={busy||reason.trim().length<20} onClick={()=>act(()=>finishTask(task,"complete_manual",reason))}>Mark manually complete</button><button disabled={busy||reason.trim().length<20} onClick={()=>act(()=>finishTask(task,"cancel",reason))}>Cancel task</button></details>}
  <details><summary>Activity history</summary><ol>{events.map(e=><li key={e.sequence}>{e.kind.replace(/_/g," ")} · {new Date(e.createdAt).toLocaleString()}<pre>{JSON.stringify(e.payload,null,2)}</pre></li>)}</ol></details>
 </section>
}
