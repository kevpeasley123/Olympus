import { useState } from "react";
import { projectChangeReview } from "../../services/executableSkills";
import { scheduleReview, scheduledProject } from "../../services/skillSchedule";
import { useReviewHistory } from "../../services/projectReviews";

export function ProjectChangeReview({projects=[]}:{projects?:readonly string[]}) {
  const [project, setProject] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [schedule, setSchedule] = useState(scheduledProject);
  const reviews = useReviewHistory();
  async function review() {
    if (!project.trim() || running) return;
    setRunning(true); setError("");
    try { await projectChangeReview.run(project.trim(),"manual"); }
    catch (cause) { setError(String(cause)); }
    finally { setRunning(false); }
  }
  return <details className="project-change-review">
    <summary>{projectChangeReview.name}</summary>
    <p>{projectChangeReview.purpose}</p><small>{projectChangeReview.authority} · local execution</small>
    <form onSubmit={event => { event.preventDefault(); void review(); }}>
      <label>Project folder name <input list="review-projects" value={project} disabled={running}
        onChange={event => setProject(event.target.value)} /></label>
      <datalist id="review-projects">{projects.map(name=><option key={name} value={name}/>)}</datalist>
      <button disabled={running || !project.trim()}>{running ? "Checking…" : "Run review"}</button>
    </form>
    <button disabled={!schedule && !project.trim()} onClick={() => {
      const choice = schedule ? "" : project.trim();
      scheduleReview(choice); setSchedule(choice);
    }}>{schedule ? "Disable daily review of " + schedule : "Review daily while Olympus is open"}</button>
    {error && <p role="alert">{error}</p>}
    <div aria-live="polite">{reviews.slice(0,12).map(record => <details key={record.id}>
      <summary>{record.project} · {record.outcome} · {new Date(record.observedAt).toLocaleString()}</summary>
      <p>{record.detail}</p><p>Source · {record.source}</p>
      {record.previous && <p>Previous revision · {record.previous}</p>}
      {record.revision && <p>Observed revision · {record.revision}</p>}
    </details>)}</div>
  </details>;
}
