import {
  cancelDelegationProposal, fetchDelegationReview, listDelegationRuns, prepareDelegationResume, prepareDelegationRun,
  resumeDelegationRun, runDelegationCheck, startDelegationRun, type ApprovalProposal, type CheckEvidence, type DelegationRun,
} from "./delegation";

/**
 * Coding work for Hephaestus, asked for and approved from the chat window or
 * the microphone. The delegation machinery is unchanged: every stage is still
 * a prepared proposal that Kevin approves, in an isolated worktree, with
 * nothing committed, pushed or merged. What this adds is the loop around it:
 * Olympus watches the run, runs the recorded checks itself when the work stops,
 * and offers one revision when a check fails (docs/LOOPS.md).
 *
 * Only Kevin's own typed or spoken words reach these matchers. Nothing a model,
 * a note or an email says can start or approve a run.
 */
export interface CodingRequest { projectId: string; projectName: string; task: string }
export interface ProjectName { id: string; name: string }
type Stage = "plan" | "build" | "revise";
interface Pending { stage: Stage; proposal: ApprovalProposal; request: CodingRequest; runId: string | null }

const ASK = /^(?:please\s+)?(?:have|ask|get|tell|let)\s+hephaestus\s+(?:to\s+)?([\s\S]+)$/i, ADDRESS = /^@?hephaestus\s*[,:—-]\s*([\s\S]+)$/i;
const APPROVE = /^(?:yes[, ]+)?(?:approve|approved|i approve|go ahead|send (?:him|it) back)[.!]?$/i, CANCEL = /^(?:cancel|cancel (?:it|that)|never ?mind|stop)[.!]?$/i;
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A request for Hephaestus, with the project it names; `ask` when it names none and there is more than one. */
export function matchCodingRequest(text: string, projects: readonly ProjectName[]): CodingRequest | { ask: string } | null {
  const trimmed = text.trim(), match = ASK.exec(trimmed) ?? ADDRESS.exec(trimmed);
  const task = match?.[1].trim();
  if (!task || task.endsWith("?")) return null;
  const named = projects.filter(p => p.name.trim() && new RegExp(`(?:^|[^a-z0-9])${escaped(p.name.trim())}(?:[^a-z0-9]|$)`, "i").test(task)).sort((a, b) => b.name.length - a.name.length)[0];
  const project = named ?? (projects.length === 1 ? projects[0] : null);
  if (!project) return { ask: projects.length ? `Which project? Say it again with the name: ${projects.slice(0, 6).map(p => p.name).join(", ")}.` : "No project is tracked yet, so there is nowhere for Hephaestus to work." };
  return { projectId: project.id, projectName: project.name, task };
}

/** "Approve" or "cancel", and nothing longer: an approval is never read out of a sentence. */
export function matchCodingAnswer(text: string): "approve" | "cancel" | null {
  const trimmed = text.trim();
  return APPROVE.test(trimmed) ? "approve" : CANCEL.test(trimmed) ? "cancel" : null;
}

const short = (text: string, limit: number) => text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
/** The criteria a spoken task gets: the task itself, and that nothing existing broke. */
export const defaultCriteria = (task: string) => [short(`Done as asked: ${task}`, 400), "The project still builds and its existing tests pass."];

export function describeProposal(stage: Stage, request: CodingRequest, detail: string | null): string {
  if (stage === "plan") return `Hephaestus can take this on in ${request.projectName}: ${short(request.task, 300)} First he plans, reading only. Say "approve" to start, or "cancel".`;
  if (stage === "build") return `Hephaestus has a plan for ${request.projectName}. ${detail ? `${short(detail, 600)} ` : ""}Building it means edits in a separate copy on his own branch; nothing is committed, pushed or merged. Say "approve" to let him build it, or "cancel".`;
  return `${detail ?? "A check failed."} He can go back once to fix it. Say "approve" to send him back, or "cancel" to leave it for review.`;
}

const label = (check: CheckEvidence, names: Record<string, string>) => names[check.checkName] ?? check.checkName;
/** What the checks showed, in a sentence, and the first one that failed. */
export function describeChecks(run: Pick<DelegationRun, "projectName" | "changedFiles">, checks: readonly CheckEvidence[], names: Record<string, string> = {}): { text: string; failed: CheckEvidence | null } {
  const files = `${run.changedFiles.length} file${run.changedFiles.length === 1 ? "" : "s"} changed`;
  if (!checks.length) return { text: `Hephaestus finished in ${run.projectName}, ${files}. No check could run here, so it is unverified. Review it in the Project tab; nothing is pushed or merged.`, failed: null };
  const failed = checks.find(c => c.exitCode !== 0) ?? null;
  const results = checks.map(c => `${label(c, names)} ${c.exitCode === 0 ? "passed" : "failed"}`).join(", ");
  return { text: `Hephaestus finished in ${run.projectName}, ${files}. ${results}.${failed ? "" : " Review it in the Project tab; nothing is pushed or merged."}`, failed };
}

let pending: Pending | null = null;
export const codingPending = () => pending !== null;
/** Test seam. */
export const resetCoding = () => { pending = null; };

const lapsed = (proposal: ApprovalProposal) => Date.now() / 1000 >= proposal.expiresAt - 5;
const prepare = (stage: Stage, request: CodingRequest, runId: string | null) =>
  stage === "plan" || !runId ? prepareDelegationRun(request.projectId, request.task, defaultCriteria(request.task)) : prepareDelegationResume(runId);

/** Prepares the first proposal and says what approving it starts. */
export async function proposeCoding(request: CodingRequest): Promise<string> {
  if (pending) await cancelDelegationProposal(pending.proposal.id).catch(() => undefined);
  pending = null;
  const proposal = await prepare("plan", request, null);
  pending = { stage: "plan", proposal, request, runId: null };
  return describeProposal("plan", request, null);
}

const POLL_MS = 5_000, WATCH_MS = 60 * 60_000;
const ACTIVE = new Set(["approved", "preparing", "planning", "editing", "testing", "reviewing"]);

/** Follows one launch to where it stops, then says what happened and what, if anything, waits on Kevin. */
async function follow(runId: string, request: CodingRequest, wait = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms))): Promise<string> {
  for (let waited = 0; waited < WATCH_MS; waited += POLL_MS) {
    await wait(POLL_MS);
    const run = (await listDelegationRuns().catch(() => [])).find(r => r.id === runId);
    if (!run || ACTIVE.has(run.phase)) continue;
    if (run.phase === "waiting") {
      const proposal = await prepareDelegationResume(runId);
      pending = { stage: "build", proposal, request, runId };
      return describeProposal("build", request, run.checkpoint ?? run.milestone);
    }
    if (run.phase === "awaiting_review") return verify(run, request);
    return `Hephaestus stopped in ${run.projectName}: ${run.error ?? run.milestone}. His work is kept; the Project tab has it.`;
  }
  return `Hephaestus is still working in ${request.projectName} after an hour. The Project tab shows where he is.`;
}

/** The verifier: every check this project supports, run by Olympus, not on request. */
async function verify(run: DelegationRun, request: CodingRequest): Promise<string> {
  const review = await fetchDelegationReview(run.id);
  const names = Object.fromEntries(review.availableChecks.map(c => [c.id, c.label]));
  const checks: CheckEvidence[] = [];
  for (const option of review.availableChecks.filter(c => !c.unavailable)) {
    try { checks.push(await runDelegationCheck(run.id, option.id)); } catch { /* a check that cannot start is simply not evidence */ }
  }
  const outcome = describeChecks(run, checks, names);
  if (!outcome.failed) return outcome.text;
  // The backend allows one revision per run; a second failure lands here and is only reported.
  try {
    const proposal = await prepareDelegationResume(run.id);
    pending = { stage: "revise", proposal, request, runId: run.id };
    return describeProposal("revise", request, outcome.text);
  } catch { return `${outcome.text} He has already been sent back once, so this one is yours to review in the Project tab.`; }
}

/**
 * Kevin's "approve" or "cancel" for the proposal that is waiting. Returns the
 * immediate reply; `later` delivers what the run came to, whenever it stops.
 */
export async function answerCoding(answer: "approve" | "cancel", later: (text: string) => void): Promise<string> {
  const current = pending;
  if (!current) return "Nothing is waiting for your approval.";
  if (answer === "cancel") {
    pending = null;
    await cancelDelegationProposal(current.proposal.id).catch(() => undefined);
    return current.runId ? "Cancelled. Nothing more will run; what he has done so far is kept in the Project tab." : "Cancelled. Nothing was started.";
  }
  if (lapsed(current.proposal)) {
    current.proposal = await prepare(current.stage, current.request, current.runId);
    return 'That approval had lapsed, so I prepared it again. Say "approve" once more.';
  }
  pending = null;
  const run = current.stage === "plan" ? await startDelegationRun(current.proposal.id) : await resumeDelegationRun(current.proposal.id);
  void follow(run.id, current.request).catch(error => `I lost track of Hephaestus: ${error instanceof Error ? error.message : String(error)}. The Project tab has the run.`).then(later);
  return current.stage === "plan" ? `Approved. Hephaestus is planning in ${current.request.projectName}. I will tell you when the plan is ready.`
    : current.stage === "build" ? "Approved. He is building it. I will run the checks when he stops and tell you what they show."
    : "Approved. He is fixing the failed check. This is his one revision.";
}
