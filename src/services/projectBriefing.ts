import type { ActionQueueTask } from "../hooks/useActionQueue";
import type { TrackedProject } from "../types";
import { attributeTasks } from "./taskAttribution";

export interface ProjectBrief {
  project: TrackedProject;
  recentWork: string[];
  committedAction: string | null;
  openTasks: ActionQueueTask[];
  recommendation: string;
  attention: string[];
  activityLabel: string;
  isWatchlistOption: boolean;
}

export interface SessionBriefing {
  projects: ProjectBrief[];
  activeCount: number;
  hiddenActiveCount: number;
  totalProjectCount: number;
  watchlistOptions: number;
  introduction: string;
}

const MAX_BRIEF_PROJECTS = 3;
const VISION_REVIEW_DAYS = 90;

/** Most recent commit first. Projects that never committed sort last. */
function byRecency(left: TrackedProject, right: TrackedProject): number {
  const leftTime = left.lastCommitAt ? Date.parse(left.lastCommitAt) : Number.NEGATIVE_INFINITY;
  const rightTime = right.lastCommitAt ? Date.parse(right.lastCommitAt) : Number.NEGATIVE_INFINITY;
  const safeLeft = Number.isNaN(leftTime) ? Number.NEGATIVE_INFINITY : leftTime;
  const safeRight = Number.isNaN(rightTime) ? Number.NEGATIVE_INFINITY : rightTime;
  return safeRight - safeLeft || left.name.localeCompare(right.name);
}

function projectHasCurrentSignal(project: TrackedProject): boolean {
  return (
    project.recentCommits.length > 0 ||
    project.repoState === "git-pending" ||
    project.nextStep.trim().length > 0
  );
}

function sentence(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/^[0-9a-f]{7,40}\s+/i, "")
    .replace(/^(feat|fix|docs|refactor|test|chore|build|ci|perf|style)(\([^)]+\))?!?:\s*/i, "");

  if (!cleaned) return "Recorded a project change.";

  const readable = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return /[.!?]$/.test(readable) ? readable : `${readable}.`;
}

function daysBetween(earlier: string, now: Date): number | null {
  const date = new Date(`${earlier}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

export function formatProjectActivity(project: TrackedProject, now: Date): string {
  if (!project.lastCommitAt) {
    return project.repoState === "folder-only" ? "No Git history" : "No commits recorded";
  }

  const committed = new Date(project.lastCommitAt);
  if (Number.isNaN(committed.getTime())) return "Commit date unavailable";

  const elapsedMs = Math.max(0, now.getTime() - committed.getTime());
  const hours = Math.floor(elapsedMs / 3_600_000);

  if (hours < 1) return "Updated within the hour";
  if (hours < 24) return `Updated ${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Updated yesterday";
  if (days < 30) return `Updated ${days}d ago`;

  return `Updated ${committed.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: committed.getFullYear() === now.getFullYear() ? undefined : "numeric"
  })}`;
}

function recentWork(project: TrackedProject): string[] {
  if (project.recentCommits.length > 0) {
    const visible = project.recentCommits.slice(0, 2).map((commit) => sentence(commit.subject));
    const remaining = project.recentCommits.length - visible.length;
    if (remaining > 0) {
      visible.push(`${remaining} additional ${remaining === 1 ? "change" : "changes"} recorded.`);
    }
    return visible;
  }

  if (project.lastCommitAt && project.lastCommit.trim()) {
    return [`Most recent recorded change: ${sentence(project.lastCommit)}`];
  }

  return ["No committed work has been recorded yet."];
}

function attentionItems(project: TrackedProject, now: Date): string[] {
  const items: string[] = [];

  if (project.repoState === "git-pending") {
    items.push("Uncommitted work is present and should be protected before broader changes.");
  }

  if (!project.vision.trim()) {
    items.push("The project vision has not been stated.");
  } else if (!project.visionReviewedAt) {
    items.push("The project vision has no review date.");
  } else {
    const days = daysBetween(project.visionReviewedAt, now);
    if (days !== null && days > VISION_REVIEW_DAYS) {
      items.push(`The project vision was last reviewed ${days} days ago.`);
    }
  }

  if (!project.nextStep.trim()) {
    items.push("No committed next action is recorded.");
  }

  if (!project.path) {
    items.push("The project note has no matching folder under the projects root.");
  }

  for (const warning of project.warnings) {
    items.push(warning);
  }

  return items.slice(0, 3);
}

function recommendation(project: TrackedProject, tasks: ActionQueueTask[]): string {
  if (project.warnings.length > 0) {
    return "Repair the project memory warning before relying on further recommendations.";
  }

  if (project.repoState === "git-pending") {
    return "Review and secure the uncommitted work, then decide whether to continue or redirect it.";
  }

  if (project.nextStep.trim()) {
    return "Begin with the committed next action, then pause if the direction or design needs to change.";
  }

  if (tasks.length > 0) {
    return `Start with the first recorded task: “${tasks[0].text}”`;
  }

  if (!project.vision.trim()) {
    return "Clarify the current vision before delegating implementation work.";
  }

  if (project.lastCommitAt) {
    return "Review the latest change in the running project, then choose and record the next outcome.";
  }

  return "Choose and record a concrete next outcome before delegating work.";
}

/**
 * Builds the Command briefing from sources Olympus can prove.
 *
 * Active projects always lead. When fewer than three are active, a watching
 * project with current work may be offered as a clearly labelled alternative;
 * it is never silently promoted to active just to make the screen fuller.
 */
export function buildSessionBriefing(
  projects: TrackedProject[],
  tasks: ActionQueueTask[],
  now = new Date()
): SessionBriefing {
  const active = projects.filter((project) => project.status === "active").sort(byRecency);
  const watching = projects
    .filter((project) => project.status === "watching" && projectHasCurrentSignal(project))
    .sort(byRecency);

  const selected = [...active, ...watching].slice(0, MAX_BRIEF_PROJECTS);
  const taskMap = attributeTasks(projects, tasks).perProject;

  const briefs = selected.map((project) => {
    const projectTasks = taskMap.get(project.id) ?? [];
    return {
      project,
      recentWork: recentWork(project),
      committedAction: project.nextStep.trim() || null,
      openTasks: projectTasks,
      recommendation: recommendation(project, projectTasks),
      attention: attentionItems(project, now),
      activityLabel: formatProjectActivity(project, now),
      isWatchlistOption: project.status !== "active"
    };
  });

  const watchlistOptions = briefs.filter((brief) => brief.isWatchlistOption).length;
  const selectedActiveCount = briefs.length - watchlistOptions;
  const hiddenActiveCount = Math.max(0, active.length - selectedActiveCount);
  let introduction: string;

  if (briefs.length === 0) {
    introduction =
      "No active project has enough current context for a trustworthy session path.";
  } else if (active.length === 0) {
    introduction =
      "Nothing is declared active. These watching projects have the clearest current signal.";
  } else if (hiddenActiveCount > 0) {
    introduction =
      `${active.length} projects are active. The ${selectedActiveCount} with the most recent ` +
      "signal are shown; review the active set before adding more.";
  } else if (watchlistOptions > 0) {
    introduction =
      "Active work leads. A watching project with current signal is included as an optional path.";
  } else {
    introduction =
      active.length === 1
        ? "One project is active. Its recorded state and next decision are below."
        : `${active.length} projects are active. Choose the path that matters most today.`;
  }

  return {
    projects: briefs,
    activeCount: active.length,
    hiddenActiveCount,
    totalProjectCount: projects.length,
    watchlistOptions,
    introduction
  };
}
