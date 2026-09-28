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
  check(failed.includes("project scan failed"), "A failed scan is stated, not guessed around");

  const long = brief([{...project, nextStep: "word ".repeat(80)}]);
  check(long.length < 400, "Items are clipped so the spoken briefing stays short");

  check(brief([]) === "Olympus is open. No projects are tracked yet.", "Empty state");
  return { passed };
}
