import type { SessionBoundary, TrackedProject } from "../types";
import type { ProjectCommandState } from "./projectCommandBoard";
import type { AttentionItem } from "./projectBriefing";
import { selectNextAction } from "./nextAction";

/**
 * The briefing Olympus speaks once when it opens.
 *
 * Deterministic and assembled only from state Olympus can prove: commits since
 * the previous launch, recorded delegation checkpoints, and the operator's own
 * next step. No model call, so it costs nothing to compose and still works when provider credit is exhausted. Speaking it is the
 * only paid part.
 */
export interface OpeningBriefingInput {
  projects: TrackedProject[];
  board: ProjectCommandState[];
  sessionBoundary: SessionBoundary | null;
  /** Set when the project scan failed; the briefing says so instead of guessing. */
  projectsError: string | null;
}

const MAX_ITEM_CHARS = 110;
// Git facts outrank vault-note hygiene; run reviews are already said as "needs you".
const OBSERVATION_RANK: Partial<Record<AttentionItem["kind"], number>> = { uncommitted: 0, worktree: 1, vision: 2 };
const MAX_ATTENTION_ITEMS = 2;
const NUMBERS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

function count(value: number, noun: string, plural = `${noun}s`): string {
  const word = value < NUMBERS.length ? NUMBERS[value] : String(value);
  return `${word} ${value === 1 ? noun : plural}`;
}

function lower(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function clip(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim().replace(/[.;:,\s]+$/, "");
  if (flat.length <= MAX_ITEM_CHARS) return flat;
  const cut = flat.slice(0, MAX_ITEM_CHARS);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 60))}…`;
}

function observation(project: TrackedProject, item: AttentionItem): string {
  if (item.kind === "uncommitted") {
    return project.lastCommitAt
      ? `${project.name} has uncommitted changes in its main checkout`
      : `${project.name} has no commits yet`;
  }
  if (item.kind === "worktree") {
    const files = project.linkedWorktrees.filter((worktree) => worktree.changedFiles > 0);
    const total = files.reduce((sum, worktree) => sum + worktree.changedFiles, 0);
    return `${project.name} has ${lower(count(total, "uncommitted file"))} in ${files.length === 1 ? "an agent worktree" : `${files.length} agent worktrees`}`;
  }
  if (!project.vision.trim()) return `${project.name} has no stated vision`;
  const reviewed = /(\d+) days ago/.exec(item.text);
  return reviewed
    ? `the ${project.name} vision was last reviewed ${reviewed[1]} days ago`
    : `the ${project.name} vision has no review date`;
}

/**
 * One sentence from the board's source-labelled attention items (review F2).
 * Said as an observation, never as a blocker: nothing here changes status.
 */
function attentionSentence(board: ProjectCommandState[]): string | null {
  const candidates = board
    .filter((row) => row.project.status === "active" || row.project.status === "watching")
    .flatMap((row) => row.attention
      .filter((item) => OBSERVATION_RANK[item.kind] !== undefined)
      .map((item) => ({ row, item })))
    // Stable, so board order breaks ties.
    .sort((left, right) => (OBSERVATION_RANK[left.item.kind] ?? 9) - (OBSERVATION_RANK[right.item.kind] ?? 9));
  if (candidates.length === 0) return null;
  const [{ row, item }] = candidates;
  return `One thing to keep in mind: ${clip(observation(row.project, item))}.`;
}

function sinceClause(sessionBoundary: SessionBoundary | null, now: Date): string | null {
  const previous = sessionBoundary?.previousSessionStartedAt
    ? new Date(sessionBoundary.previousSessionStartedAt)
    : null;
  if (!previous || Number.isNaN(previous.getTime())) return null;
  const sameDay = previous.toDateString() === now.toDateString();
  const when = previous.toLocaleString([], sameDay
    ? { hour: "numeric", minute: "2-digit" }
    : { weekday: "long", hour: "numeric", minute: "2-digit" });
  return sameDay ? `earlier today at ${when}` : when;
}

function joinItems(items: string[]): string {
  return items.length<3 ? items.join(" and ") : `${items.slice(0,-1).join(", ")}, and ${items[items.length-1]}`;
}

function cleanSubject(subject:string):string {
  return subject.replace(/^(feat|fix|refactor|docs|test|chore|style|perf|build|ci)(\([^)]*\))?!?:\s*/i,"").replace(/\s+/g," ").trim();
}

// Broad labels summarize the words in the change notes, not inferred outcomes.
function changeTheme(subject:string):string {
  if(/project|ecosystem|cards?\b/i.test(subject))return "the project dashboard";
  if(/voice|speech|spoken|microphone|elevenlabs/i.test(subject))return "voice replies";
  if(/omega|constellation|galaxy|stars?|header|typography|console|chat/i.test(subject))return "the interface";
  if(/memory|vault|obsidian/i.test(subject))return "project memory";
  if(/test|verification|acceptance/i.test(subject))return "verification";
  return "other project work";
}

function describeChange(subject:string):string {
  const forms:Record<string,string>={match:"matching",align:"aligning",unify:"unifying",restore:"restoring",replace:"replacing",support:"supporting",add:"adding",fix:"fixing",improve:"improving",refine:"refining",make:"making",remove:"removing",share:"sharing",show:"showing",keep:"keeping",fit:"fitting",simplify:"simplifying",enable:"enabling",update:"updating",render:"rendering",vary:"varying",distinguish:"distinguishing",place:"placing",give:"giving",default:"defaulting",recompose:"recomposing",represent:"representing",bring:"bringing",compact:"compacting"};
  return clip(subject.replace(/^(\w+)\b/,word=>forms[word.toLowerCase()]??word));
}

function progressSummary(project:TrackedProject):string {
  const subjects=[...new Set(project.sinceSessionCommits.map(c=>cleanSubject(c.subject)).filter(s=>s&&!/^Merge\b/i.test(s)))];
  if(!subjects.length)return `There are recorded changes in ${project.name}, but the change notes don't give me a useful summary yet.`;
  const groups=new Map<string,string[]>();
  for(const subject of subjects){const theme=changeTheme(subject);groups.set(theme,[...(groups.get(theme)??[]),subject]);}
  const ranked=[...groups].sort((a,b)=>b[1].length-a[1].length);
  const themes=ranked.filter(([theme])=>theme!=="other project work").slice(0,3).map(([theme])=>theme);
  const highlights=ranked.slice(0,3).map(([,items])=>items[0]);
  // A small focused change-set still deserves more than one concrete example.
  for(const subject of subjects){if(highlights.length>=3)break;if(!highlights.includes(subject))highlights.push(subject);}
  return `${themes.length?`Work on ${project.name} has focused on ${joinItems(themes)}. `:`On ${project.name}, here are the recent updates. `}That includes ${joinItems(highlights.map(describeChange))}.`;
}

export function composeOpeningBriefing(
  { projects, board, sessionBoundary, projectsError }: OpeningBriefingInput,
  now = new Date()
): string {
  if (projectsError) return "Hello sir. I couldn't refresh the projects, so I can't give you a reliable update yet. I'd recommend retrying the project scan before deciding what to work on.";
  if (!projects.length) return "Hello sir. We haven't linked any projects yet. I'd recommend adding the project you'd like to work on first so I can help you decide what comes next.";
  const sentences=["Hello sir."];
  const since=sinceClause(sessionBoundary,now);
  const moved=projects.filter(p=>p.sinceSessionCommits.length>0).sort((a,b)=>b.sinceSessionCommits.length-a.sinceSessionCommits.length);
  if(since){
    sentences.push(moved.length?`Here's what changed since your last session, ${since}.`:`I found no new committed updates since your last session, ${since}. Work may still be in progress.`);
    for(const project of moved.slice(0,2))sentences.push(progressSummary(project));
    if(moved.length>2)sentences.push(`There are also updates in ${lower(count(moved.length-2,"other project"))} on the Project board.`);
  }else sentences.push("This is our first recorded session, so I don't yet have a previous visit to compare against. Here's where things stand.");

  const attention=board.filter(row=>row.operationalStatus==="NEEDS_YOU"||row.operationalStatus==="BLOCKED");
  for(const row of attention.slice(0,MAX_ATTENTION_ITEMS)){
    const detail=row.operatorDecisions[0]?.text??row.nextMove??row.currentState;
    sentences.push(row.operationalStatus==="BLOCKED"?`Work on ${row.project.name} is blocked: ${clip(detail)}.`:`${row.project.name} is waiting for your review: ${clip(detail)}.`);
  }
  if(attention.length>MAX_ATTENTION_ITEMS)sentences.push(`${count(attention.length-MAX_ATTENTION_ITEMS,"other project")} also ${attention.length-MAX_ATTENTION_ITEMS===1?"needs":"need"} your attention on the Project board.`);
  const running=board.filter(row=>row.operationalStatus==="IN_PROGRESS");
  if(running.length)sentences.push(`Delegated work is still running on ${joinItems(running.slice(0,2).map(row=>row.project.name))}${running.length>2?" and other projects":""}.`);
  const observed=attentionSentence(board);
  if(observed)sentences.push(observed);

  const next=selectNextAction(projects);
  if(next.kind==="stated")sentences.push(`${next.fallback?"No project is currently marked active. The latest saved next step":"The next step we have recorded"} for ${next.project} is: ${clip(next.step)}.`);

  const dirty=projects.find(p=>(p.status==="active"||p.status==="watching")&&(p.repoState==="git-pending"||p.linkedWorktrees.some(w=>w.changedFiles>0)));
  if(attention.length)sentences.push(`I'd recommend starting with the ${attention[0].operationalStatus==="BLOCKED"?"blocker":"review"} on ${attention[0].project.name} before taking on more work.`);
  else if(running.length)sentences.push(`I'd recommend checking the next review checkpoint for ${running[0].project.name} before starting overlapping work.`);
  else if(dirty)sentences.push(`I'd recommend reviewing the uncommitted changes in ${dirty.name} and deciding what is ready to keep before choosing the next task.`);
  else if(next.kind==="stated")sentences.push(`I'd recommend checking that this still matches your priorities, then picking up that step.`);
  else if(next.project)sentences.push(`I don't have a saved next step for this project yet. I'd recommend that we choose the next priority for ${next.project} and record a clear outcome before starting.`);
  else sentences.push("I'd recommend choosing a project to focus on and agreeing on one concrete next step.");
  return sentences.join(" ");
}
