import { useSyncExternalStore } from "react";
import { PANTHEON_FIGURES } from "../../services/pantheonFigureState";
import { agentEventsSnapshot, engineLabel, groupAgentRuns, subscribeAgentEvents, type AgentEvent } from "../../services/agentEvents";
import "./agentActivityFeed.css";

const MARK: Record<AgentEvent["kind"], string> = {
  run_started: "▸", thinking: "…", message: "”", file_read: "◦", file_edit: "✎", search: "⌕",
  command: "$", subagent_started: "⑂", plan: "≡", tool_call: "⚙", tool_failed: "!", result: "✓", error: "✕",
};
const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const agentName = (agent: string) => PANTHEON_FIGURES.find(figure => figure.agent === agent)?.name ?? agent;

/** What agents are doing, step by step, from the backend's normalized event stream. */
export function AgentActivityFeed() {
  const runs = groupAgentRuns(useSyncExternalStore(subscribeAgentEvents, agentEventsSnapshot));
  if (!runs.length) return <p className="agent-feed-empty">No agent runs recorded yet.</p>;
  return <div className="agent-feed" aria-label="Agent run activity">
    {runs.map(run => <section key={run.runId} data-active={run.active}>
      <h4>{agentName(run.agent)} <span>{engineLabel(run.engine)} · {run.active ? "working" : "finished"}</span></h4>
      <ol>{run.events.map(event => <li key={event.id} data-kind={event.kind} data-helper={event.subagent} title={event.detail ?? event.path ?? undefined}>
        <span aria-hidden="true">{MARK[event.kind] ?? "·"}</span>
        <span>{event.subagent && <em>helper </em>}{event.summary}</span>
        <time dateTime={event.createdAt}>{time(event.createdAt)}</time>
      </li>)}</ol>
    </section>)}
  </div>;
}
