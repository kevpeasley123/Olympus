import { useSyncExternalStore } from "react";
import { describeHandoff, describeSource, describeUsage, isBrief, skillRunsSnapshot, subscribeSkillRuns, type SkillRun, type SourceRef } from "../../services/skillRuns";
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

/** What each engine reported using over the last week, for Diagnostics. Nothing when nothing ran. */
export function ObservedUsage() {
  const { usage } = useSyncExternalStore(subscribeSkillRuns, skillRunsSnapshot);
  if (!usage.length) return null;
  return <p className="skill-trial-note" aria-label="Observed usage, last 7 days">Observed, last 7 days. {usage.map(entry => describeUsage(entry, engineLabel(entry.engine))).join(". ")}.</p>;
}
