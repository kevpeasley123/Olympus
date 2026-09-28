import { buildProjectCommandBoard, initialTask, operationalStatusLabels, prepareBlocker, sortCommandProjects } from "./projectCommandBoard";
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

  // D6: archived reads ARCHIVED; the data value other surfaces use is unchanged.
  check(operationalStatusLabels.COMPLETE === "ARCHIVED" && get({...project,status:"archived"}).operationalStatus === "COMPLETE", "Archive displays as ARCHIVED, stays COMPLETE in data");
  check(operationalStatusLabels.NEEDS_YOU === "NEEDS YOU" && operationalStatusLabels.IN_PROGRESS === "IN PROGRESS", "Status labels are words, not identifiers");

  // F2: attention is observation only; it never changes status or ownership.
  const quiet: TrackedProject = {...project,repoState:"git-active",vision:"Vision",visionReviewedAt:"2026-09-01",linkedWorktrees:[]};
  const noisy: TrackedProject = {...project,repoState:"git-pending",vision:"",visionReviewedAt:null,linkedWorktrees:[{path:"/w",branch:"olympus/run-1",head:"abc",lastCommitAt:null,changedFiles:3}]};
  const now = new Date("2026-09-28T12:00:00Z");
  for (const variant of [{}, {status:"watching" as const}, {status:"archived" as const}, {nextStep:""}]) {
    const [a, b] = buildProjectCommandBoard([{...quiet,...variant},{...noisy,...variant,id:"q"}],[],[],undefined,now);
    check(a.attention.length === 0 && b.attention.length >= 3, "Attention fixture differs only in observations");
    check(a.operationalStatus === b.operationalStatus && a.nextMoveOwner === b.nextMoveOwner, `Attention does not change status (${JSON.stringify(variant)})`);
  }
  const noisyRow = buildProjectCommandBoard([noisy],[],[],undefined,now)[0];
  check(noisyRow.attention.some(item => item.text === "Worktree olympus/run-1 has 3 uncommitted files" && item.source === "Git"), "Dirty worktree appears as a Git observation");
  check(noisyRow.attention.some(item => item.kind === "uncommitted" && item.text.startsWith("Primary checkout")), "Dirty primary checkout is observed");
  check(noisyRow.attention.some(item => item.text === "Vision not stated" && item.source === "Vault note"), "Unset vision is observed");
  check(buildProjectCommandBoard([{...quiet,visionReviewedAt:"2026-05-01"}],[],[],undefined,now)[0].attention.some(item => item.text === "Vision last reviewed 150 days ago"), "Vision older than 90 days is observed");
  check(buildProjectCommandBoard([{...quiet,visionReviewedAt:"2026-08-01"}],[],[],undefined,now)[0].attention.length === 0, "A recent vision review is not attention");
  const reviewRow = buildProjectCommandBoard([quiet],[],[{...run,phase:"awaiting_review",updatedAt:"2026-09-28T11:00:00Z"}],undefined,now)[0];
  check(reviewRow.attention.some(item => item.kind === "review" && item.source === "Run record"), "Agent work awaiting review is observed");

  // D5: recommendations are run-specific where a run exists, generic ones are flagged for omission.
  const waitingRow = buildProjectCommandBoard([quiet],[],[{...run,phase:"waiting",updatedAt:"2026-09-28T11:15:00Z"}],undefined,now)[0];
  check(!waitingRow.recommendationGeneric && waitingRow.olympusRecommendation.includes("45 min ago"), "Checkpoint recommendation names its run's age");
  check(get(quiet).recommendationGeneric && get({...quiet,status:"watching"}).recommendationGeneric, "Generic advice is flagged so rows can omit it");
  const pinned = sortCommandProjects([get({...quiet,name:"Aardvark"}), {...waitingRow, project:{...waitingRow.project,name:"Zebra"}}], "name");
  check(pinned[0].project.name === "Zebra", "Checkpoint rows stay pinned above any sort");

  // U11: Prepare states its blocker before a task is written.
  check(prepareBlocker(quiet, [], true) === null, "A clean project with no open run can prepare");
  check(/Commit or stash/.test(prepareBlocker({...quiet,repoState:"git-pending"}, [], true) ?? ""), "Dirty primary checkout blocks with the real remedy");
  check(/plan is waiting/.test(prepareBlocker(quiet, [{...run,phase:"waiting"}], true) ?? ""), "Waiting run blocks");
  check(/awaiting your review/.test(prepareBlocker(quiet, [{...run,phase:"awaiting_review"}], true) ?? ""), "Result awaiting review blocks");
  check(/in progress/.test(prepareBlocker(quiet, [run], true) ?? ""), "Active run blocks");
  check(prepareBlocker(quiet, [{...run,phase:"failed"},{...run,id:"x",phase:"cancelled"}], true) === null, "Finished runs do not block");
  check(prepareBlocker(quiet, [{...run,projectId:"other"}], true) === null, "Another project's run does not block");
  check(prepareBlocker(quiet, null, true) === null, "Unknown runs leave the decision to the backend");
  check(prepareBlocker(quiet, [], false) !== null && prepareBlocker({...quiet,path:""}, [], true) !== null, "Browser and folderless projects cannot prepare");
  check(initialTask({...quiet,status:"watching",nextStep:"Decide later"}) === "" && initialTask({...quiet,status:"archived",nextStep:"x"}) === "" && initialTask({...quiet,nextStep:"Ship it"}) === "Ship it", "Only active projects pre-fill the task");
  return {passed};
}
