import { groupAgentRuns, mergeAgentEvents, workingAgents, type AgentEvent, type AgentEventKind } from "./agentEvents";

export function runAgentEventsHarness() {
  let passed = 0;
  const check = (condition: boolean, message: string) => { if (!condition) throw Error(message); passed++; };
  const event = (id: number, runId: string, kind: AgentEventKind, extra: Partial<AgentEvent> = {}): AgentEvent =>
    ({ id, runId, engine: "claude-code", agent: "coding-delegate", kind, summary: `${kind} ${id}`, detail: null, tool: null, path: null, subagent: false, createdAt: "2026-11-11T08:00:00.000Z", ...extra });

  const merged = mergeAgentEvents([event(1, "a", "run_started"), event(3, "a", "file_read")], [event(2, "a", "thinking"), event(3, "a", "file_read")]);
  check(merged.map(e => e.id).join() === "1,2,3", "Events merge in id order without repeats");
  check(mergeAgentEvents(merged, [event(4, "a", "command")], 2).map(e => e.id).join() === "3,4", "The feed keeps only the newest events");

  const feed = [
    event(1, "a", "run_started"), event(2, "a", "file_read"), event(3, "b", "run_started", { agent: "research" }),
    event(4, "a", "subagent_started"), event(5, "a", "result", { subagent: true }), event(6, "b", "result", { agent: "research" }),
  ];
  const groups = groupAgentRuns(feed);
  check(groups.map(g => g.runId).join() === "a,b", "A run in progress comes before a finished one, even a more recent one");
  check(groups[0].events.length === 4 && groups[0].active, "A helper's result does not end its parent run");
  check(!groups[1].active, "A run's own result ends it");
  check(groupAgentRuns([...feed, event(7, "a", "result")]).map(g => g.runId).join() === "a,b", "Finished runs are ordered by most recent activity");
  check(workingAgents(feed).join() === "coding-delegate", "Only agents with a run in progress are working");
  check(workingAgents([...feed, event(7, "a", "error")]).length === 0, "An error ends the run");
  check(groupAgentRuns([]).length === 0 && workingAgents([]).length === 0, "No events means no runs and no working agents");
  return { passed };
}
