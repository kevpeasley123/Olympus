import { composeOpeningBriefing } from "./openingBriefing";
import { buildProjectCommandBoard } from "./projectCommandBoard";
import type { TrackedProject } from "../types";
import type { DelegationRun } from "./delegation";

export function runOpeningBriefingHarness() {
  let passed = 0;
  const check = (condition: boolean, message: string) => { if (!condition) throw Error(message); passed++; };
  const now = new Date("2026-09-28T09:00:00");
  const commit = { at: "2026-09-27T18:00:00", subject: "Fix sync" };
  const project: TrackedProject = {id:"p",name:"Olympus",path:"/p",status:"active",statusSource:"declared",promoted:null,branch:"main",lastCommit:"Fix sync",lastCommitAt:"2026-09-27T18:00:00",repoState:"git-active",recentCommits:[],sinceSessionCommits:[commit, commit],linkedWorktrees:[],summary:"",vision:"Vision",visionReviewedAt:null,nextStep:"Run desktop acceptance of the review fixes",notePath:null,warnings:[]};
  const other: TrackedProject = {...project,id:"q",name:"Atlas",status:"watching",sinceSessionCommits:[commit],nextStep:""};
  const boundary = { currentSessionStartedAt: "2026-09-28T08:59:00", previousSessionStartedAt: "2026-09-26T20:15:00" };
  const brief = (projects: TrackedProject[], runs: DelegationRun[] = [], sessionBoundary: typeof boundary | null = boundary, projectsError: string | null = null) =>
    composeOpeningBriefing({ projects, board: buildProjectCommandBoard(projects, [], runs), sessionBoundary, projectsError }, now);

  const plain = brief([project, other]);
  check(plain.includes("three commits across two projects"), `Counts commits since the last session: ${plain}`);
  check(plain.includes("Next recorded step, Olympus: Run desktop acceptance of the review fixes."), `States the operator's own next step: ${plain}`);
  check(!/!|great|exciting/i.test(plain), "Dry voice: no exclamation or enthusiasm");

  const quiet = brief([{...project, sinceSessionCommits: []}]);
  check(quiet.startsWith("No commits since your last session"), `Says so when nothing moved: ${quiet}`);

  const first = brief([project], [], null);
  check(first.startsWith("This is the first recorded Olympus session"), "No invented since-last-time summary without a boundary");

  const review = {id:"r",projectId:"p",task:"Harden writers",phase:"awaiting_review",milestone:"",updatedAt:"2026-09-28T08:00:00Z"} as DelegationRun;
  const needs = brief([project], [review]);
  check(needs.includes("Olympus needs you: Review result and evidence: Harden writers."), `Surfaces recorded checkpoints: ${needs}`);

  const unset = brief([{...project, nextStep: ""}]);
  check(unset.includes("Olympus is active but has no recorded next step."), "Never borrows another project's step");

  const failed = brief([project], [], boundary, "root missing");
  check(failed.startsWith("The project scan failed"), "A failed scan is stated first, not guessed around");

  const long = brief([{...project, nextStep: "word ".repeat(80)}]);
  check(long.length < 400, "Items are clipped so the spoken briefing stays short");

  check(brief([]) === "No projects are tracked yet.", "Empty state leads with the fact, so the one-line preview carries it");

  // Attention (review F2): one source-backed observation, never a blocker.
  const reviewed = {...project, visionReviewedAt: "2026-09-01"};
  const clean = brief([reviewed]);
  check(!clean.includes("Observed for attention"), `No attention sentence without an observation: ${clean}`);
  const dirty = {...reviewed, id: "a", name: "Atlas", repoState: "git-pending" as const, sinceSessionCommits: [], nextStep: ""};
  const observed = brief([reviewed, {...reviewed, id: "s", name: "Stale", visionReviewedAt: "2026-01-02"}, dirty]);
  check(observed.includes("Observed for attention: Atlas has uncommitted changes in its main checkout, and one more observation on the Project board."),
    `Git fact outranks vault hygiene and the rest is counted: ${observed}`);
  check((observed.match(/Observed for attention/g) ?? []).length === 1, "At most one attention sentence");
  check(!/Atlas (is blocked|needs you)/.test(observed) && !/blocker/i.test(observed), "An observation is never said as a blocker");
  check(observed.indexOf("Observed for attention") < observed.indexOf("Next recorded step"), "Observation precedes the next step");
  const worktree = brief([{...reviewed, linkedWorktrees: [{path: "/w", branch: "olympus/run-2", head: "abc", lastCommitAt: null, changedFiles: 3}]}]);
  check(worktree.includes("Olympus has three uncommitted files in an agent worktree."), `Worktree phrased without the branch: ${worktree}`);
  const stale = brief([{...reviewed, visionReviewedAt: "2026-01-02"}]);
  check(stale.includes("Observed for attention: the Olympus vision was last reviewed 269 days ago."), `Vault-note observation reads as a sentence: ${stale}`);
  const archived = brief([reviewed, {...dirty, status: "archived" as const}]);
  check(!archived.includes("Observed for attention"), "Archived projects add no observation");
  const awaiting = brief([reviewed], [review]);
  check(!awaiting.includes("Observed for attention"), "A run awaiting review is said once, as needs you, not again as an observation");
  check(brief([dirty]) === brief([dirty]), "Deterministic");
  check(observed.length < 400, `Still short with an observation: ${observed.length}`);
  return { passed };
}
