import { describeHandoff, describeRun, describeUsage, isBrief, latestRun, mergeSkillRuns, type SkillRun } from "./skillRuns";

export function runSkillRunsHarness() {
  let passed = 0;
  const check = (condition: boolean, message: string) => { if (!condition) throw Error(message); passed++; };
  const run = (id: string, startedAt: string, extra: Partial<SkillRun> = {}): SkillRun =>
    ({ id, skillId: "opening-brief", skillVersion: 1, engine: "claude-code", agent: "olympus", status: "running", parentRun: null, request: null, model: null, output: null, error: null, toolCalls: 0, startedAt, finishedAt: null, ...extra });
  const first = run("a", "2026-11-11T08:00:00Z"), second = run("b", "2026-11-11T09:00:00Z");
  const merged = mergeSkillRuns([first], [second]);
  check(merged.map(r => r.id).join() === "b,a", "Runs are listed newest first");
  const updated = mergeSkillRuns(merged, [run("b", "2026-11-11T09:00:00Z", { status: "completed", toolCalls: 3, model: "claude-test" })]);
  check(updated.length === 2 && updated[0].status === "completed", "An update replaces its own row");
  check(latestRun(updated, "opening-brief")?.id === "b" && latestRun(updated, "other") === null, "The latest run is per skill");
  check(describeRun(null) === "Not run yet." && describeRun(first) === "Running.", "A run that has not finished says so");
  check(describeRun(updated[0]) === "Finished with 3 tool calls on claude-test.", "A finished run reports its tool calls and model");
  check(describeRun(run("c", "x", { status: "completed", toolCalls: 1 })) === "Finished with 1 tool call.", "One tool call is singular");
  check(describeRun(run("d", "x", { status: "failed", error: "The brief cites `search_mail`, which this run never called." })).startsWith("Stopped. The brief cites"), "A rejected answer shows its reason");
  check(isBrief({ brief: "b", coverage: "c", items: [] }) && !isBrief({ answer: "a", unknowns: [], sources: [] }), "A brief and an answer are told apart by shape");
  const used = { engine: "claude-code", runs: 3, failed: 1, seconds: 180, inputTokens: 0, outputTokens: 0, reportedCostUsd: 0.418 };
  check(describeUsage(used, "Claude Code") === "Claude Code: 3 runs, 1 stopped, $0.42 at API rates as reported", "Observed usage names a cost only as the engine reported it");
  check(describeUsage({ ...used, runs: 1, failed: 0, reportedCostUsd: 0 }, "Codex") === "Codex: 1 run", "No cost is shown when none was reported");
  const child = run("b-h1", "2026-11-11T09:30:00Z", { skillId: "research-assignment", parentRun: "b" });
  const withChild = mergeSkillRuns(updated, [child, run("z", "2026-11-11T10:00:00Z", { parentRun: "b" })]);
  check(latestRun(withChild, "opening-brief")?.id === "b", "A hand-off is never shown as the latest run of a skill Kevin starts");
  check(describeHandoff({ agent: "research", name: "Athena", task: "Find the briefing style.", status: "completed", runId: "b-h1" }) === "Athena reported: Find the briefing style.", "A hand-off that came back says who reported on what");
  check(describeHandoff({ agent: "verification", name: "Themis", task: "Check it.", status: "failed", runId: "b-h2" }) === "Themis did not finish: Check it.", "A hand-off that failed says so");
  return { passed };
}
