import { describeDecision, matchChatDecision } from "./chatDecisions";
import type { Expectation, Proposal } from "./loops";

export function runChatDecisionsHarness() {
  let passed = 0;
  const equal = (actual: unknown, expected: unknown, message: string) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error(`${message}: ${JSON.stringify(actual)}`); };
  const same = (text: string, expected: unknown) => { equal(matchChatDecision(text), expected, text); passed++; };
  same("I accept the proposals", { action: "accept", proposals: true, expectations: false });
  same("Approve the expectations.", { action: "accept", proposals: false, expectations: true });
  same("accept the proposals and approve the expectations", { action: "accept", proposals: true, expectations: true });
  same("Dismiss the proposals", { action: "dismiss", proposals: true, expectations: false });
  same("What are the proposals?", { action: "list", proposals: true, expectations: false });
  // A question, a refusal, a mention or a long sentence is conversation, not a decision.
  for (const text of ["Should I accept the proposals?", "Don't accept the proposals yet", "Accept the proposals?", "Why did the review make those proposals",
    "I accept", "/ask accept the proposals", "I think I might accept the proposals once I have read through each of them carefully tonight"]) same(text, null);

  const proposal = (id: number, kind: Proposal["kind"], skill: string, title: string): Proposal => ({ id, runId: "r", kind, skill, title, detail: "", expectation: "", status: "proposed", createdAt: "", decidedAt: null });
  const expectation = (id: string): Expectation => ({ id, statement: `${id}.`, kevinSaid: "", saidOn: "", source: "", status: "proposed", checks: [] });
  const waiting = { proposals: [proposal(1, "instruction", "opening-brief", "Say it once"), proposal(2, "build", "none", "Add a fallback")], expectations: [expectation("a"), expectation("b")] };
  equal(describeDecision({ action: "accept", proposals: true, expectations: true }, waiting),
    "Accepted. One instruction now in effect: Say it once. One build task for the next coding session: Add a fallback. Approved two expectations. I am scored against them from now on.", "accept both");
  equal(describeDecision({ action: "accept", proposals: true, expectations: false }, { proposals: [], expectations: [] }), "No proposals are waiting on you.", "nothing waiting");
  equal(describeDecision({ action: "list", proposals: true, expectations: false }, waiting).startsWith("Two proposals waiting: Say it once; Add a fallback."), true, "list");
  passed += 3;
  return { passed };
}
