import { buildProjectCommandBoard, sortCommandProjects } from "./projectCommandBoard";
import type { TrackedProject } from "../types";
import type { DelegationRun } from "./delegation";
export function runProjectCommandBoardHarness() {
  let passed = 0;
  const check = (condition: boolean, message: string) => { if (!condition) throw Error(message); passed++; };
  const project: TrackedProject = {id:"p",name:"Project",path:"/p",status:"active",statusSource:"declared",promoted:null,branch:"main",lastCommit:"latest",lastCommitAt:"2026-09-07",repoState:"git-pending",recentCommits:[],sinceSessionCommits:[],linkedWorktrees:[],summary:"Test",vision:"Vision",visionReviewedAt:null,nextStep:"Approve a task",notePath:null,warnings:[]};
  const run = {id:"r",projectId:"p",task:"Implement feature",phase:"editing",milestone:"Editing",updatedAt:"2026-09-07T12:00:00Z"} as DelegationRun;
  const get = (p=project,r:DelegationRun[]=[]) => buildProjectCommandBoard([p],[],r)[0];
  check(get().operationalStatus === "UNKNOWN", "Git changes and next-step text must not imply execution or readiness");
  check(get().nextMoveOwner === null && get().operatorDecisions.length === 0, "Do not infer approval ownership from prose");
  check(get(project,[run]).operationalStatus === "IN_PROGRESS", "Actual run establishes execution");
  check(get(project,[{...run,phase:"waiting"}]).nextMoveOwner === "OPERATOR", "Plan checkpoint belongs to operator");
  check(get(project,[{...run,phase:"awaiting_review"}]).operatorDecisions.length === 1, "Result review feeds attention");
  check(get(project,[{...run,phase:"complete"}]).operationalStatus !== "COMPLETE", "Run completion does not complete project");
  check(get(project,[{...run,phase:"failed"}]).blockers === null, "Failure does not fabricate external blocker");
  check(get({...project,status:"watching",nextStep:""}).nextMoveOwner === "NONE", "Declared monitoring without next step has no current owner");
  check(get({...project,status:"watching",statusSource:"inferred"}).operationalStatus === "UNKNOWN", "Inferred category cannot establish intent");
  check(get({...project,status:"archived"}).operationalStatus === "COMPLETE", "Declared archive maps to complete");
  check(buildProjectCommandBoard([project],[],[run],{tasks:false,runs:false})[0].operationalStatus === "UNKNOWN", "Unavailable runs must not show cached execution as current");
  check(buildProjectCommandBoard([project],[],[],{tasks:false,runs:true})[0].openTaskCount === null, "Unknown task count is not zero");
  check(get(project,[run,{...run,id:"review",phase:"awaiting_review"}]).operatorDecisions.length === 1, "Concurrent review is not hidden by active run");
  check(sortCommandProjects([get(),get(project,[run]),get(project,[{...run,phase:"waiting"}])],"priority")[0].operationalStatus === "NEEDS_YOU", "Attention sorts first");
  check(project.nextStep === "Approve a task" && get().recommendationSource === "deterministic", "Projection preserves recorded intent");
  return {passed};
}
