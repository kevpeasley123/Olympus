import { defaultCriteria, describeChecks, describeProposal, matchCodingAnswer, matchCodingRequest } from "./chatCoding";

export function runChatCodingHarness() {
  let passed = 0;
  const equal = (actual: unknown, expected: unknown, message: string) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error(`${message}: ${JSON.stringify(actual)}`); passed++; };
  const projects = [{ id: "o", name: "Olympus" }, { id: "p", name: "Portfolio Site" }];
  equal(matchCodingRequest("Have Hephaestus add a retry count to the loop scorecard in Olympus", projects), { projectId: "o", projectName: "Olympus", task: "add a retry count to the loop scorecard in Olympus" }, "names the project");
  equal(matchCodingRequest("Hephaestus, fix the footer on the portfolio site.", projects), { projectId: "p", projectName: "Portfolio Site", task: "fix the footer on the portfolio site." }, "addressed directly");
  equal(matchCodingRequest("ask Hephaestus to tidy the readme", [projects[0]]), { projectId: "o", projectName: "Olympus", task: "tidy the readme" }, "one project needs no name");
  equal("ask" in (matchCodingRequest("ask Hephaestus to tidy the readme", projects) as object), true, "two projects and none named asks which");
  // Talking about him, or asking a question, starts nothing.
  for (const text of ["What does Hephaestus do?", "Hephaestus is the coding agent", "have Hephaestus look at it?", "I had Hephaestus in mind", "/ask have Hephaestus fix it"]) equal(matchCodingRequest(text, projects), null, text);

  for (const text of ["approve", "Approve.", "Yes, approve", "go ahead", "send him back"]) equal(matchCodingAnswer(text), "approve", text);
  for (const text of ["cancel", "Never mind.", "stop"]) equal(matchCodingAnswer(text), "cancel", text);
  // An approval is never read out of a longer sentence.
  for (const text of ["I might approve that later", "don't approve", "approve the proposals", "ok", "yes"]) equal(matchCodingAnswer(text), null, text);

  equal(defaultCriteria("x".repeat(500))[0].length <= 400, true, "criteria stay within the contract's limit");
  const request = { projectId: "o", projectName: "Olympus", task: "add a retry count." };
  equal(describeProposal("plan", request, null), 'Hephaestus can take this on in Olympus: add a retry count. First he plans, reading only. Say "approve" to start, or "cancel".', "plan proposal");
  const check = (checkName: string, exitCode: number) => ({ id: checkName, checkName, exitCode, output: "", workspaceHash: "h" });
  const run = { projectName: "Olympus", changedFiles: ["a.rs", "b.ts"] };
  const good = describeChecks(run, [check("frontend-build", 0), check("rust-tests", 0)], { "frontend-build": "Frontend build", "rust-tests": "Rust tests" });
  equal([good.text, good.failed], ["Hephaestus finished in Olympus, 2 files changed. Frontend build passed, Rust tests passed. Review it in the Project tab; nothing is pushed or merged.", null], "all passed");
  const bad = describeChecks(run, [check("frontend-build", 0), check("rust-tests", 101)], { "rust-tests": "Rust tests" });
  equal([bad.text, bad.failed?.checkName], ["Hephaestus finished in Olympus, 2 files changed. frontend-build passed, Rust tests failed.", "rust-tests"], "one failed");
  equal(describeChecks(run, []).text.includes("unverified"), true, "no checks is said plainly");
  return { passed };
}
