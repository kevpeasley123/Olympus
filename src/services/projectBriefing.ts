import type { ActionQueueTask } from "../hooks/useActionQueue";
import type { TrackedProject } from "../types";
import type { DelegationRun } from "./delegation";
import { formatWhen } from "./time";

export interface ProjectBrief {
  project: TrackedProject;
  recentWork: string[];
  recentWorkLabel: string;
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
  boundaryNote: string;
}
const VISION_REVIEW_DAYS = 90;

function daysBetween(earlier: string, now: Date): number | null {
  const date = new Date(`${earlier}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

export function formatProjectActivity(project: TrackedProject, now: Date): string {
  if (project.linkedWorktrees.some((worktree) => worktree.changedFiles > 0)) {
    return "Uncommitted worktree changes";
  }

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

export type AttentionSource = "Vault note" | "Git" | "Run record" | "Organizer";

export interface AttentionItem {
  kind: "vision" | "uncommitted" | "worktree" | "review" | "organizer";
  text: string;
  source: AttentionSource;
}

/**
 * The manual's Attention field (review F2): observations from named sources,
 * never blockers. Nothing here feeds operational status or ownership.
 */
export function projectAttention(
  project: TrackedProject,
  runs: Pick<DelegationRun, "phase" | "updatedAt" | "task">[],
  now: Date = new Date()
): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (!project.vision.trim()) {
    items.push({ kind: "vision", text: "Vision not stated", source: "Vault note" });
  } else if (!project.visionReviewedAt) {
    items.push({ kind: "vision", text: "Vision has no review date", source: "Vault note" });
  } else {
    const days = daysBetween(project.visionReviewedAt, now);
    if (days !== null && days > VISION_REVIEW_DAYS) {
      items.push({ kind: "vision", text: `Vision last reviewed ${days} days ago`, source: "Vault note" });
    }
  }

  if (project.repoState === "git-pending") {
    items.push({
      kind: "uncommitted",
      text: project.lastCommitAt ? "Primary checkout has uncommitted changes" : "Repository has no commits yet",
      source: "Git"
    });
  }

  for (const worktree of project.linkedWorktrees.filter((item) => item.changedFiles > 0)) {
    items.push({
      kind: "worktree",
      text: `Worktree ${worktree.branch} has ${worktree.changedFiles} uncommitted ${worktree.changedFiles === 1 ? "file" : "files"}`,
      source: "Git"
    });
  }

  for (const run of runs.filter((item) => item.phase === "awaiting_review")) {
    items.push({
      kind: "review",
      text: `Agent result awaiting review since ${formatWhen(run.updatedAt, { now })}`,
      source: "Run record"
    });
  }

  return items;
}
