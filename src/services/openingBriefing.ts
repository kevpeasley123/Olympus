import type { SessionBoundary, TrackedProject } from "../types";
import type { ProjectCommandState } from "./projectCommandBoard";
import type { AttentionItem } from "./projectBriefing";
import { selectNextAction } from "./nextAction";

/**
 * The briefing Olympus speaks once when it opens.
 *
 * Deterministic and assembled only from state Olympus can prove: commits since
 * the previous launch, recorded delegation checkpoints, and the operator's own
 * next step. No model call, so it costs nothing to compose, cannot invent a
 * fact, and still works when provider credit is exhausted. Speaking it is the
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
  const more = candidates.length - 1;
  return `Observed for attention: ${clip(observation(row.project, item))}${more > 0 ? `, and ${lower(count(more, "more observation"))} on the Project board` : ""}.`;
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

export function composeOpeningBriefing(
  { projects, board, sessionBoundary, projectsError }: OpeningBriefingInput,
  now = new Date()
): string {
  if (projectsError) {
    return "The project scan failed, so there is no project briefing yet.";
  }
  if (projects.length === 0) {
    return "No projects are tracked yet.";
  }

  const sentences: string[] = [];
  const since = sinceClause(sessionBoundary, now);
  if (since) {
    const moved = projects.filter((project) => project.sinceSessionCommits.length > 0);
    const commits = moved.reduce((total, project) => total + project.sinceSessionCommits.length, 0);
    sentences.push(commits === 0
      ? `No commits since your last session, ${since}.`
      : `Since your last session, ${since}: ${lower(count(commits, "commit"))} across ${lower(count(moved.length, "project"))}.`);
  } else {
    sentences.push("This is the first recorded Olympus session, so there is no since-last-time summary.");
  }

  const attention = board.filter((row) => row.operationalStatus === "NEEDS_YOU" || row.operationalStatus === "BLOCKED");
  for (const row of attention.slice(0, MAX_ATTENTION_ITEMS)) {
    const detail = row.operatorDecisions[0]?.text ?? row.nextMove ?? row.currentState;
    sentences.push(row.operationalStatus === "BLOCKED"
      ? `${row.project.name} is blocked: ${clip(detail)}.`
      : `${row.project.name} needs you: ${clip(detail)}.`);
  }
  const remaining = attention.length - MAX_ATTENTION_ITEMS;
  if (remaining > 0) sentences.push(`${count(remaining, "more project")} ${remaining === 1 ? "needs" : "need"} attention.`);

  const running = board.filter((row) => row.operationalStatus === "IN_PROGRESS");
  if (running.length > 0) {
    sentences.push(running.length === 1
      ? `Delegated work is running on ${running[0].project.name}.`
      : `Delegated work is running on ${lower(count(running.length, "project"))}.`);
  }

  const observed = attentionSentence(board);
  if (observed) sentences.push(observed);

  const next = selectNextAction(projects);
  if (next.kind === "stated") {
    sentences.push(`${next.fallback ? "Nothing is active. The latest recorded step" : "Next recorded step"}, ${next.project}: ${clip(next.step)}.`);
  } else if (next.project && projects.some((project) => project.status === "active")) {
    sentences.push(`${next.project} is active but has no recorded next step.`);
  } else if (attention.length === 0) {
    sentences.push("Nothing is active and no next step is recorded.");
  }

  return sentences.join(" ");
}
