import { useSyncExternalStore } from "react";
import { describeRun, latestRun, skillRunsSnapshot, startSkillRun, subscribeSkillRuns } from "../../services/skillRuns";
import { engineLabel } from "../../services/agentEvents";
import "./agentActivityFeed.css";

/** Skills that run on the harness. A trial result is shown for comparison and replaces nothing. */
export function SkillTrials() {
  const { skills, runs, error } = useSyncExternalStore(subscribeSkillRuns, skillRunsSnapshot);
  if (!skills.length) return null;
  return <div className="skill-trials" aria-label="Harness skills">
    {skills.map(skill => {
      const run = latestRun(runs, skill.id), engine = skill.engines[0];
      return <section key={skill.id}>
        <h4>{skill.title}</h4>
        <p className="skill-trial-note">Runs beside your current brief. It is not spoken or saved as the brief.</p>
        <button type="button" disabled={run?.status === "running"} onClick={() => void startSkillRun(skill.id, engine)}>Run on {engineLabel(engine)}</button>
        <p className="skill-trial-status" data-status={run?.status ?? "none"}>{describeRun(run)}</p>
        {run?.status === "completed" && run.output && <div className="skill-trial-result">
          <p>{run.output.brief}</p>
          {run.output.items.length > 0 && <ul>{run.output.items.map((item, index) => <li key={index}>
            <strong>{item.headline}</strong>{item.actionNeeded && <em> needs you</em>}
            <span>{item.why}</span>
            <small>{item.sources.map(source => `${source.tool}: ${source.reference}`).join(" · ")}</small>
          </li>)}</ul>}
          <small>{run.output.coverage}</small>
        </div>}
      </section>;
    })}
    {error && <p className="skill-trial-status" data-status="failed" role="alert">{error}</p>}
  </div>;
}
