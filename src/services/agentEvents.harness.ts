import { PANTHEON_FIGURES, nextFigureState, type FigureMemory } from "./pantheonFigureState";
import { activityMissions, groupAgentRuns, mergeAgentEvents, workingAgents, type AgentEvent, type AgentEventKind } from "./agentEvents";

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
  const missions = activityMissions(feed);
  const byRun = (id: string) => missions.find(m => m.id === `activity:${id}`)!;
  check(byRun("a").status === "running" && byRun("a").steps[0].agent === "coding-delegate" && byRun("a").steps[0].state === "active", "A run in progress is a running mission naming its agent");
  check(byRun("b").status === "completed" && byRun("b").steps[0].state === "completed" && byRun("b").finishedAt !== null, "A finished run is a completed mission");
  check(activityMissions([...feed, event(7, "a", "error")]).find(m => m.id === "activity:a")!.status === "failed", "A stopped run is a failed mission");
  const figure = (id: string) => PANTHEON_FIGURES.find(f => f.id === id)!;
  const step = (id: string, list: typeof missions, previous: FigureMemory | null, now: number) => nextFigureState(figure(id), list, null, previous, now);
  const assigned = step("hephaestus", missions, null, 0);
  check(assigned.state === "assigned", "A figure is assigned when its agent's run appears");
  const working = step("hephaestus", missions, assigned, 5);
  check(working.state === "working", "The figure then works while the run is in progress");
  check(step("zeus", missions, step("zeus", missions, null, 0), 5).state === "working", "Zeus coordinates while any run is live");
  check(step("athena", missions, null, 0).state === "idle", "An agent whose run already finished is idle");
  const finished = activityMissions([...feed, event(7, "a", "result")]);
  check(step("hephaestus", finished, working, 6).state === "completed", "The figure marks completion when its run reports a result");
  check(step("hephaestus", activityMissions([]), working, 6).state === "idle", "A run that disappears returns the figure to idle");
  return { passed };
}
