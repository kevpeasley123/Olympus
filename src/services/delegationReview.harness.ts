import { completionChecklist, preparedResumeApplies, reconcileReviewNotes, type ChecklistInput } from "./delegationReview";
import type { CheckEvidence, CheckOption } from "./delegation";
import { EMPTY_PROJECT_DRAFT, EMPTY_REVIEW_NOTES, projectHasOpenWork, pruneEndedReviewNotes, readViewSlice, resetViewState, writeViewEntry } from "../state/viewState";

/** Review notes survive refreshes; evidence validity does not outlive its workspace (review U3, U11). */
export function runDelegationReviewHarness() {
  let passed = 0;
  const check = (condition: boolean, message: string) => { if (!condition) throw Error(message); passed++; };
  const pass = (id: string, hash: string, name = "frontend-build"): CheckEvidence => ({ id, checkName: name, exitCode: 0, output: "", workspaceHash: hash });
  const options: CheckOption[] = [{ id: "frontend-build", label: "Frontend build", unavailable: null }, { id: "rust-tests", label: "Rust tests", unavailable: null }];
  const approvals = ["plan · t1 · record a", "implement · t2 · record b"];

  resetViewState();
  const runId = "run-1";
  // The operator types notes, cites a check and ticks the acknowledgement.
  const first = reconcileReviewNotes(EMPTY_REVIEW_NOTES, { hash: "h1", approvals, checks: [pass("c1", "h1")], criteriaCount: 2 }, "project-a");
  check(first.invalidated === null && first.next.notes.length === 2 && first.next.workspaceHash === "h1", "First read pads notes and records the fingerprint");
  writeViewEntry("reviewNotes", runId, { ...first.next, notes: ["Opened the fixture; elapsed time renders.", "Short note"], evidence: ["c1", ""], reviewed: true }, EMPTY_REVIEW_NOTES);

  // A check runs and the review refreshes on the same workspace: nothing is lost.
  const stored = readViewSlice("reviewNotes")[runId];
  const same = reconcileReviewNotes(stored, { hash: "h1", approvals, checks: [pass("c2", "h1", "rust-tests"), pass("c1", "h1")], criteriaCount: 2 }, "project-a");
  check(same.invalidated === null, "Same workspace: no invalidation");
  check(same.next.notes[0] === "Opened the fixture; elapsed time renders." && same.next.notes[1] === "Short note", "Notes survive a check and refresh");
  check(same.next.evidence[0] === "c1" && same.next.reviewed, "Valid selection and acknowledgement survive a refresh");
  check(projectHasOpenWork("project-a") && !projectHasOpenWork("project-b"), "Open review keeps its own project open, no other");

  // The workspace changes: selections and the acknowledgement go, notes stay, and it says so.
  const changed = reconcileReviewNotes(same.next, { hash: "h2", approvals, checks: [pass("c1", "h1")], criteriaCount: 2 }, "project-a");
  check(changed.next.notes[0] === "Opened the fixture; elapsed time renders." && changed.next.notes[1] === "Short note", "Notes are never erased by invalidation");
  check(changed.next.evidence[0] === "" && !changed.next.reviewed && changed.next.workspaceHash === "h2", "Stale selection and acknowledgement are cleared");
  check(Boolean(changed.invalidated?.includes("workspace changed") && changed.invalidated.includes("notes are kept")), "Invalidation is explained");

  // A new approval record: the acknowledgement no longer describes the same review.
  const reApproved = reconcileReviewNotes({ ...changed.next, reviewed: true }, { hash: "h2", approvals: [...approvals, "implement · t3 · record c"], checks: [], criteriaCount: 2 }, "project-a");
  check(!reApproved.next.reviewed && Boolean(reApproved.invalidated?.includes("approvals changed")), "Changed approvals clear the acknowledgement");
  check(reconcileReviewNotes({ ...reApproved.next }, { hash: "h2", approvals: [...approvals, "implement · t3 · record c"], checks: [], criteriaCount: 2 }, "project-a").invalidated === null, "Nothing to clear, nothing reported");

  // The completion checklist states every unmet condition.
  const base: ChecklistInput = { criteria: ["A", "B"], notes: ["Twenty-plus characters of evidence.", "Twelve chars"], evidence: ["", ""], checks: [pass("c1", "h1")], options, hash: "h2", reviewed: false, issues: "Flaky test" };
  const texts = completionChecklist(base).filter(item => !item.met).map(item => item.text);
  check(texts.includes("Criterion 2 needs a note (12/20)"), "Short note states its count");
  check(texts.includes("Run the stale check again: Frontend build"), "Stale latest check is named");
  check(texts.includes("Confirm you reviewed the diff") && texts.includes("Unresolved issues must be empty"), "Acknowledgement and issues are stated");
  check(completionChecklist({ ...base, checks: [{ ...pass("c3", "h2"), exitCode: 1 }, pass("c1", "h2")] }).some(item => item.text === "Frontend build failed (exit 1) — fix it and run it again"), "A failed latest check blocks even when an older one passed");
  check(completionChecklist({ ...base, checks: [{ ...pass("c3", ""), exitCode: null }] }).some(item => item.text === "Run Frontend build again — it did not finish"), "An interrupted check blocks");
  check(completionChecklist({ ...base, evidence: ["c1", ""] }).some(item => item.text === "Criterion 1: the selected check no longer matches this workspace"), "A stale cited check is named");
  const ready = completionChecklist({ ...base, notes: ["Twenty-plus characters of evidence.", "Also more than twenty characters."], checks: [pass("c9", "h2")], reviewed: true, issues: "  " });
  check(ready.every(item => item.met), "All conditions met enables completion");
  check(completionChecklist({ ...base, notes: ["x".repeat(2001), "Also more than twenty characters."] }).some(item => item.text.includes("too long (2001/2,000)")), "Over-long note is stated");

  // Regression L1: an opened but untouched draft is not typed work.
  resetViewState();
  writeViewEntry("projectDrafts", "project-c", { task: "Ship the release notes", criteria: [], prefill: "Ship the release notes" }, EMPTY_PROJECT_DRAFT);
  check(!projectHasOpenWork("project-c"), "An untouched prefilled task does not hold the project open");
  writeViewEntry("projectDrafts", "project-c", current => ({ ...current, criteria: ["", "  "] }), EMPTY_PROJECT_DRAFT);
  check(!projectHasOpenWork("project-c"), "Blank criteria lines are not typed work");
  writeViewEntry("projectDrafts", "project-c", current => ({ ...current, task: "Ship the release notes and the changelog" }), EMPTY_PROJECT_DRAFT);
  check(projectHasOpenWork("project-c"), "An edited task holds the project open");
  writeViewEntry("projectDrafts", "project-c", { task: "Ship the release notes", criteria: ["Notes render"], prefill: "Ship the release notes" }, EMPTY_PROJECT_DRAFT);
  check(projectHasOpenWork("project-c"), "A typed criterion holds the project open");
  writeViewEntry("projectDrafts", "project-c", { task: "", criteria: [], prefill: "Ship the release notes" }, EMPTY_PROJECT_DRAFT);
  check(projectHasOpenWork("project-c"), "Clearing the prefilled task is an edit");

  // Regression L1: notes for an ended run do not pin the project.
  resetViewState();
  writeViewEntry("reviewNotes", "run-ended", { ...EMPTY_REVIEW_NOTES, projectId: "project-d", notes: ["Typed before the run was stopped."] }, EMPTY_REVIEW_NOTES);
  writeViewEntry("reviewNotes", "run-live", { ...EMPTY_REVIEW_NOTES, projectId: "project-e", notes: ["Still under review."] }, EMPTY_REVIEW_NOTES);
  check(projectHasOpenWork("project-d"), "Notes pin their project before the run ends");
  pruneEndedReviewNotes(["run-ended", "run-unknown"]);
  check(!projectHasOpenWork("project-d") && !("run-ended" in readViewSlice("reviewNotes")), "An ended run's notes are dropped and no longer pin the project");
  check(projectHasOpenWork("project-e"), "A live run's notes are kept");

  // Regression L3: a cached resume approval applies only while its run waits.
  const listed = [{ id: "run-w", phase: "waiting" }, { id: "run-x", phase: "cancelled" }];
  check(preparedResumeApplies("run-w", listed, true), "A waiting run keeps its prepared approval");
  check(!preparedResumeApplies("run-x", listed, true), "A stopped run drops its prepared approval");
  check(!preparedResumeApplies("run-gone", listed, true), "A run no longer listed drops its prepared approval");
  check(!preparedResumeApplies("run-w", [{ id: "run-w", phase: "planning" }], true), "A run that resumed drops its prepared approval");
  check(preparedResumeApplies("run-x", [], false), "Nothing is dropped before the first list");
  resetViewState();
  return { passed };
}
