import { buildDeck, classifyFailure, deckStages, describeStep, operationTimeline } from "./activityDeck";
import type { AgentEvent } from "./agentEvents";
import type { SkillRun } from "./skillRuns";

export function runActivityDeckHarness() {
  let passed = 0;
  const check = (condition: boolean, message: string) => { if (!condition) throw Error(message); passed++; };
  let id = 0;
  const event = (runId: string, agent: string, kind: AgentEvent["kind"], summary: string, extra: Partial<AgentEvent> = {}): AgentEvent =>
    ({ id: ++id, runId, engine: "claude-code", agent, kind, summary, detail: null, tool: null, path: null, subagent: false, createdAt: `2026-11-11T09:00:${String(id).padStart(2, "0")}Z`, ...extra });
  const run = (runId: string, agent: string, extra: Partial<SkillRun> = {}): SkillRun =>
    ({ id: runId, skillId: "work-request", skillVersion: 1, engine: "claude-code", agent, status: "running", parentRun: null, request: null, model: null, output: null, error: null, toolCalls: 0, startedAt: "2026-11-11T09:00:00Z", finishedAt: null, ...extra });

  check(buildDeck([], []).operation === null && buildDeck([], []).agents.length === 0, "Nothing recorded shows nothing");

  const root = run("r", "olympus", { request: "What briefing style have I asked for? Have it checked." });
  const started = [event("r", "olympus", "run_started", "Started Ask Olympus"), event("r", "olympus", "tool_call", "Recalled memory", { tool: "mcp__olympus__recall_memory" })];
  let deck = buildDeck([root], started);
  check(deck.operation?.title.startsWith("What briefing style") === true && deck.operation.line === "Zeus is planning", "The operation is named by the request and says who is planning");
  check(deck.operation?.progress === null, "No progress is shown before a plan exists");
  check(deck.agents.length === 1 && deck.agents[0].status === "running" && deck.agents[0].activity === "Checking learned memory", "The lead's line is its latest recorded step");

  const plan = event("r", "olympus", "plan", "Planned the work: Athena, then Themis", { detail: JSON.stringify([{ agent: "research", name: "Athena", task: "Find the notes" }, { agent: "verification", name: "Themis", task: "Check them" }]) });
  const athena = run("r-h1", "research", { parentRun: "r", skillId: "research-assignment" });
  const working = [...started, plan, event("r", "olympus", "subagent_started", "Handed to Athena: Find the notes"), event("r-h1", "research", "run_started", "Took a hand-off from Zeus"), event("r-h1", "research", "tool_call", "Read a vault note", { tool: "mcp__olympus__read_vault_note", path: "09 - System/User Profile.md" })];
  deck = buildDeck([root, athena], working);
  check(deck.agents.map(a => `${a.agent}:${a.status}`).join() === "olympus:coordinating,research:running,verification:queued", "A hand-off shows the lead coordinating, the specialist running and the next one queued");
  check(deck.agents[0].activity === "Waiting on Athena" && deck.agents[1].activity === "Reading User Profile" && deck.agents[2].activity === "Queued behind Athena", "Each line says what that Olympian is doing");
  check(deck.agents[1].assignment === "Find the notes" && deck.agents[2].assignment === "Check them", "A specialist's assignment is the planned task");
  check(deck.operation?.progress?.done === 1 && deck.operation.progress.total === 4 && deck.operation.line === "Athena is working", "Progress counts plan stages: one of four once the plan is accepted");

  check(deckStages(deck).map(stage => stage.state).join() === "done,active,pending,pending" && deckStages(deck)[1].label === "Athena: research & analysis", "The brief's checklist follows the plan: planned, Athena working, the rest pending");
  const athenaDone = { ...athena, status: "completed" as const, output: { answer: "Short and direct.", unknowns: [], sources: [] } };
  const themis = run("r-h2", "verification", { parentRun: "r", skillId: "verification-assignment", status: "failed", error: "The answer did not match the skill's format." });
  deck = buildDeck([root, athenaDone, themis], working);
  check(deck.agents.map(a => a.status).join() === "running,completed,failed" && deck.agents[0].activity === "Writing the answer from the reports", "After the hand-offs the lead writes the answer");
  check(deck.agents[1].finding === "Short and direct." && deck.agents[2].error?.startsWith("The answer did not match") === true, "A report and a failure are both inspectable");
  check(deck.operation?.progress?.done === 3, "A failed hand-off still counts as a settled stage");

  const finished = { ...root, status: "completed" as const, finishedAt: "2026-11-11T09:05:00Z", output: { answer: "Dry and economical.", unknowns: [], sources: [] } };
  deck = buildDeck([finished, athenaDone, themis], working);
  check(deck.operation?.status === "completed" && deck.operation.progress?.done === 4 && !deck.agents.some(a => a.status === "queued" || a.status === "running"), "A finished operation has no one running or queued");

  check(deckStages(deck).map(stage => stage.state).join() === "done,done,failed,done", "A finished checklist keeps the failed hand-off visible");
  const direct = buildDeck([root], [...started, event("r", "olympus", "plan", "Answering directly; no hand-off needed", { detail: "[]" })]);
  check(direct.operation?.progress === null && direct.operation.line === "Zeus is answering" && deckStages(direct).length === 0, "A direct answer has no stages to count");

  const stopped = buildDeck([{ ...root, status: "failed", error: "Claude Code stopped the run: usage limit." }], started);
  check(stopped.operation?.line === "Stopped. Claude Code stopped the run: usage limit." && stopped.operation.progress === null && stopped.agents[0].status === "failed", "A stopped run reports its reason and no progress");

  const job = [event("job-1", "olympus", "run_started", "Started Briefing investigation", { engine: "codex" })];
  const loose = buildDeck([finished], [...working, ...job]);
  check(loose.operation?.id === "job-1" && loose.operation.run === null && loose.agents[0].status === "running", "Work known only from events is shown, and work in progress outranks finished work");
  const chat = [event("chat-1", "olympus", "run_started", "Answering in chat"), event("chat-1", "olympus", "message", "A mutex is a lock")];
  check(buildDeck([], chat).operation === null, "A chat turn that looked nothing up is not an operation");
  const lookedUp = buildDeck([], [...chat, event("chat-1", "olympus", "tool_call", "Searched the vault", { tool: "mcp__olympus__search_vault" })]);
  check(lookedUp.operation?.title === "Answering in chat" && lookedUp.agents[0].activity === "Searching the vault", "A chat turn that looks something up shows in the deck");
  const both = buildDeck([root, { ...run("s", "research", { skillId: "answer-from-sources", startedAt: "2026-11-11T09:01:00Z" }) }], started);
  check(both.operation?.id === "s" && both.operation.alsoRunning === 1 && both.agents.some(a => a.agent === "olympus" && a.status === "running"), "Concurrent operations show every working Olympian");

  check(describeStep(event("x", "research", "tool_call", "Searched mail", { tool: "mcp__olympus__search_mail" })) === "Searching recent mail", "A tool call is reworded, not invented");
  check(describeStep(event("x", "research", "tool_call", "Used a tool", { tool: "something_else" })) === "Used a tool", "An unknown step keeps the recorded summary");

  // The timeline, next step and failure kinds: all from the same recorded runs and events.
  const athenaRunning = run("r-h1", "research", { parentRun: "r", skillId: "research-assignment" });
  let liveDeck = buildDeck([root, athenaRunning], working);
  check(liveDeck.operation?.lead === "olympus" && liveDeck.operation.next === "Awaiting Athena's research & analysis", "The next step comes from the running hand-off");
  check(liveDeck.operation?.lastEventAt === working[working.length - 1].createdAt, "Quiet time is measured from the latest recorded event of the operation or its hand-offs");
  liveDeck = buildDeck([root, athenaDone], [...working, event("r", "olympus", "message", "Athena reported back")]);
  check(liveDeck.operation?.next === "Themis takes the next hand-off", "With Athena done, the plan names Themis next");
  check(buildDeck([root], started).operation?.next === null, "Before a plan, nothing is promised next");
  check(buildDeck([finished, athenaDone, themis], working).operation?.next === null, "A finished operation has no next step");

  const returned = [...working, event("r-h1", "research", "tool_call", "Read a vault note", { tool: "mcp__olympus__read_vault_note", path: "09 - System/User Profile.md" }), event("r-h1", "research", "result", "Finished"), event("r", "olympus", "message", "Athena reported back"), event("r", "olympus", "subagent_started", "Handed to Themis: Check them"), event("r", "olympus", "tool_failed", "Themis's hand-off did not complete")];
  const timeline = operationTimeline([finished, athenaDone, themis], returned, "r");
  check(timeline[0].kind === "start" && timeline[0].text === "Started Ask Olympus", "The timeline opens with the recorded start");
  const handoffs = timeline.filter(entry => entry.kind === "handoff");
  check(handoffs.length === 2 && handoffs[0].agent === "olympus" && handoffs[0].to === "research" && handoffs[0].text === "Find the notes" && handoffs[1].to === "verification", "Each hand-off names who gave it, who took it and the task");
  const back = timeline.find(entry => entry.kind === "return");
  check(back?.agent === "research" && back.to === "olympus" && back.text === "Results returned", "A return is credited to the specialist and addressed to the lead");
  check(timeline.some(entry => entry.kind === "failed" && entry.agent === "verification" && entry.text === "Hand-off did not complete"), "A failed hand-off is shown as one");
  check(timeline.filter(entry => entry.text === "Reading User Profile" && entry.agent === "research").length === 1, "A repeated identical step collapses into one line");
  check(timeline[timeline.length - 1].kind === "done" && timeline[timeline.length - 1].text === "Delivered the answer", "The run record closes the timeline when no event did");
  check(!timeline.some(entry => entry.text === "Took a hand-off from Zeus"), "A specialist's own start is not a second hand-off line");
  check(operationTimeline([{ ...root, status: "failed", error: "Claude Code stopped the run: usage limit." }], started, "r").slice(-1)[0].kind === "failed", "A stopped run ends its timeline with the reason");
  check(operationTimeline([root], started, "nothing").length === 0, "Another operation's events never appear");

  check(classifyFailure("Claude Code stopped the run: usage limit.").kind === "user" && classifyFailure("Sign in to Claude Code first").kind === "user", "Limits and sign-ins need Kevin");
  check(classifyFailure("Claude response timed out. No fallback was attempted.").kind === "external", "A timeout is an outside service");
  check(classifyFailure("The answer did not match the skill's format.").kind === "system" && classifyFailure(null).kind === "system", "Anything else is Olympus's own issue");

  const retried = [...returned, event("r", "olympus", "message", "Retry: Themis found claims that do not hold; Athena revises once")];
  check(operationTimeline([finished, athenaDone, themis], retried, "r").some(entry => entry.kind === "plan" && entry.text === "Themis found claims that do not hold; Athena revises once"), "A revision round shows on the timeline");
  const extra = [run("r-h3", "research", { parentRun: "r", skillId: "research-assignment", status: "completed" }), run("r-h4", "verification", { parentRun: "r", skillId: "verification-assignment" })];
  const revising = buildDeck([root, athenaDone, { ...themis, status: "completed" as const, error: null }, ...extra], working);
  check((revising.operation?.progress?.done ?? 9) <= 3 && revising.operation?.progress?.total === 4, "Revision hand-offs never push progress past the last stage");
  return { passed };
}
