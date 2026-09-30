import { ChevronRight, X } from "lucide-react";
import {
  AGENT_NAMES, findCapability, STEP_GLYPH, STEP_WORD,
  type CapabilitySnapshot, type Mission
} from "../../services/capabilities";
import { formatWhen } from "../../services/time";

const STATUS_WORD: Record<Mission["status"], string> = {
  running: "Working", waiting: "Waiting for you", completed: "Result ready", failed: "Stopped", cancelled: "Cancelled", interrupted: "Interrupted"
};
const DESTINATION: Record<Mission["destination"], string> = { research: "Open in Research", communications: "Open in Communications", project: "Open in Project" };

/**
 * A structured run, as its own records describe it. Every step state here was
 * written by the workflow; the view never advances anything on a timer, and
 * opening the run elsewhere is navigation, not approval.
 */
export function MissionView({ mission, capabilities, compact = false, onOpen, onDismiss }: {
  mission: Mission;
  capabilities: CapabilitySnapshot | null;
  compact?: boolean;
  onOpen?: (destination: Mission["destination"]) => void;
  onDismiss?: (id: string) => void;
}) {
  const active = mission.steps.filter(step => step.state === "active");
  const done = mission.steps.filter(step => step.state === "completed").length;
  const counted = mission.steps.filter(step => step.state !== "skipped" && step.state !== "not-run").length || mission.steps.length;
  const finished = mission.status !== "running" && mission.status !== "waiting";
  const name = (id: string) => findCapability(capabilities, id)?.name ?? id;
  const inUse = [...new Set(active.flatMap(step => [...(step.agent ? [`agent:${step.agent}`] : []), ...step.tools.map(id => `tool:${id}`), ...step.skills.map(id => `skill:${id}`)]))];

  if (compact) return <div className="mission-strip" data-status={mission.status} role="status" aria-live="polite">
    <span className="mission-strip__eyebrow">Mission</span>
    <span className="mission-strip__step">{active[0]?.label ?? STATUS_WORD[mission.status]}</span>
    <span className="mission-strip__progress tabular-data">{done}/{counted}</span>
  </div>;

  return <section className="mission-view" data-status={mission.status} aria-label={`Mission: ${mission.title}`}>
    <header className="mission-view__header">
      <span className="mission-view__eyebrow">Mission · {mission.workflow}</span>
      <span className="mission-view__status" data-status={mission.status}><i aria-hidden="true" />{STATUS_WORD[mission.status]}</span>
      {finished && onDismiss && <button type="button" className="ghost-icon-action" aria-label="Dismiss mission" title="Dismiss" onClick={() => onDismiss(mission.id)}><X size={13} /></button>}
    </header>
    {mission.request && <p className="mission-view__request">{mission.request}</p>}
    <h4 className="mission-view__label">Plan <span className="tabular-data">{done}/{counted}</span></h4>
    <ol className="mission-view__steps">
      {mission.steps.map(step => <li key={step.id} data-state={step.state} aria-label={`${step.label}: ${STEP_WORD[step.state]}`}>
        <span className="mission-view__glyph" aria-hidden="true">{STEP_GLYPH[step.state]}</span>
        <span className="mission-view__step-label">{step.label}</span>
        {step.agent && <span className="mission-view__agent">{AGENT_NAMES[step.agent] ?? step.agent}</span>}
      </li>)}
    </ol>
    {inUse.length > 0 && !finished && <div className="mission-view__active">
      <h4 className="mission-view__label">Active</h4>
      <ul>{inUse.map(entry => {
        const [kind, id] = entry.split(":") as ["agent" | "tool" | "skill", string];
        return <li key={entry} data-kind={kind}><i aria-hidden="true" />{kind === "agent" ? AGENT_NAMES[id] ?? id : name(id)}
          <span className="visually-hidden"> · {kind}</span></li>;
      })}</ul>
    </div>}
    {mission.approval?.required && <p className="mission-view__approval" role="note">{mission.approval.detail}</p>}
    {mission.result && <div className="mission-view__result">
      <h4 className="mission-view__label">Result</h4>
      <p>{mission.result.summary}</p>
      {mission.result.detail && <small>{mission.result.detail}</small>}
    </div>}
    <footer className="mission-view__footer">
      <small>From recorded run events{mission.startedAt ? ` · started ${formatWhen(mission.startedAt)}` : ""}</small>
      {onOpen && <button type="button" className="ghost-action mission-view__open" onClick={() => onOpen(mission.destination)}>{DESTINATION[mission.destination]}<ChevronRight size={12} aria-hidden="true" /></button>}
    </footer>
  </section>;
}
