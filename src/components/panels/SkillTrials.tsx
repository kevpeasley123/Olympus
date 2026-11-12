import { useState, useSyncExternalStore } from "react";
import { describeHandoff, describeRun, describeSource, describeUsage, isBrief, latestRun, skillRunsSnapshot, startSkillRun, subscribeSkillRuns, type SkillEntry, type SkillRun, type SourceRef } from "../../services/skillRuns";
import { engineLabel } from "../../services/agentEvents";
import "./agentActivityFeed.css";

const cite = (sources: readonly SourceRef[]) => sources.map(describeSource).join(" · ");

export function SkillRunResult({ run }: { run: SkillRun }) {
  const output = run.output;
  if (run.status !== "completed" || !output) return null;
  if (isBrief(output)) return <div className="skill-trial-result">
    <p>{output.brief}</p>
    {output.items.length > 0 && <ul>{output.items.map((item, index) => <li key={index}>
      <strong>{item.headline}</strong>{item.actionNeeded && <em> needs you</em>}
      <span>{item.why}</span>
      <small>{cite(item.sources)}</small>
    </li>)}</ul>}
    <small>{output.coverage}</small>
  </div>;
  return <div className="skill-trial-result">
    {run.request && <small>{run.request}</small>}
    <p>{output.answer}</p>
    {output.handoffs && output.handoffs.length > 0 && <ul aria-label="Hand-offs">{output.handoffs.map(handoff => <li key={handoff.runId} data-status={handoff.status}><span>{describeHandoff(handoff)}</span></li>)}</ul>}
    {output.unknowns.length > 0 && <ul>{output.unknowns.map((gap, index) => <li key={index}><span>Not found: {gap}</span></li>)}</ul>}
    {output.sources.length > 0 && <small>{cite(output.sources)}</small>}
  </div>;
}

function Skill({ skill, run, onStarted }: { skill: SkillEntry; run: SkillRun | null; onStarted?: () => void }) {
  const [request, setRequest] = useState("");
  const engine = skill.engines[0], running = run?.status === "running";
  const blocked = running || (skill.takesRequest && !request.trim());
  return <section>
    <h4>{skill.title}{skill.olympian && <span> {skill.olympian.name} · {skill.olympian.title}</span>}</h4>
    <p className="skill-trial-note">{skill.orchestrates ? "Zeus answers a small request himself, or hands parts to Athena and Themis and answers from their reports." : skill.takesRequest ? "Answers from your vault, learned memory, projects and mail, and cites where each part came from." : "Runs beside your current brief. It is not spoken or saved as the brief."}</p>
    {skill.takesRequest && <textarea aria-label={`Question for ${skill.title}`} rows={2} maxLength={2000} value={request} placeholder="Ask a question" onChange={event => setRequest(event.target.value)} />}
    <button type="button" disabled={blocked} onClick={() => void startSkillRun(skill.id, engine, skill.takesRequest ? request : undefined).then(started => { if (started) onStarted?.(); })}>Run on {engineLabel(engine)}</button>
    <p className="skill-trial-status" data-status={run?.status ?? "none"}>{describeRun(run)}</p>
    {run && <SkillRunResult run={run} />}
  </section>;
}

/** Skills that run on the harness. A result is shown here and replaces nothing. */
export function SkillTrials({ onStarted }: { onStarted?: () => void } = {}) {
  const { skills, runs, usage, error } = useSyncExternalStore(subscribeSkillRuns, skillRunsSnapshot);
  if (!skills.length) return <p className="skill-trial-note">Deploying runs in the desktop app. No runnable skills are available here.</p>;
  return <div className="skill-trials" aria-label="Harness skills">
    {skills.map(skill => <Skill key={skill.id} skill={skill} run={latestRun(runs, skill.id)} onStarted={onStarted} />)}
    {error && <p className="skill-trial-status" data-status="failed" role="alert">{error}</p>}
    {usage.length > 0 && <p className="skill-trial-note" aria-label="Observed usage, last 7 days">Observed, last 7 days. {usage.map(entry => describeUsage(entry, engineLabel(entry.engine))).join(". ")}.</p>}
  </div>;
}
