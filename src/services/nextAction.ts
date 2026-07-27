import type { TrackedProject } from "../types";

/**
 * The sentence at the centre of Command mode.
 *
 * This is the highest-value fact in the app, so it is never invented and never
 * silently substituted. Every state below is distinguishable by the caller, so
 * a fallback can be *shown* as a fallback rather than passed off as the answer.
 */
export type NextActionState =
  | {
      kind: "stated";
      project: string;
      step: string;
      /** No project declares `active`; this is the most recent one that speaks. */
      fallback: boolean;
      /** Active projects beyond the one shown. */
      otherActiveCount: number;
    }
  | { kind: "activeWithoutStep"; project: string; otherActiveCount: number }
  | { kind: "empty" };

/** Most recent commit first. Projects that never committed sort last. */
function byRecency(left: TrackedProject, right: TrackedProject): number {
  if (!left.lastCommitAt && !right.lastCommitAt) return 0;
  if (!left.lastCommitAt) return 1;
  if (!right.lastCommitAt) return -1;
  return right.lastCommitAt.localeCompare(left.lastCommitAt);
}

function hasStep(project: TrackedProject): boolean {
  return project.nextStep.trim().length > 0;
}

/**
 * Picks the one next action to show, and says which kind of answer it is.
 *
 * With several active projects the most recently committed one wins and the
 * rest are counted, not cycled — a sentence that rotates cannot be read, and
 * the ring already shows how many are active.
 *
 * With an active project that states nothing, it says so rather than reaching
 * for an unrelated project's step. Being told your active project has no next
 * step is useful; being quietly shown a different project's is not.
 */
export function selectNextAction(projects: TrackedProject[]): NextActionState {
  const actives = projects.filter((project) => project.status === "active").sort(byRecency);

  if (actives.length > 0) {
    const speaking = actives.find(hasStep);
    if (speaking) {
      return {
        kind: "stated",
        project: speaking.name,
        step: speaking.nextStep.trim(),
        fallback: false,
        otherActiveCount: actives.length - 1
      };
    }

    return {
      kind: "activeWithoutStep",
      project: actives[0].name,
      otherActiveCount: actives.length - 1
    };
  }

  const fallback = [...projects].sort(byRecency).find(hasStep);
  if (fallback) {
    return {
      kind: "stated",
      project: fallback.name,
      step: fallback.nextStep.trim(),
      fallback: true,
      otherActiveCount: 0
    };
  }

  return { kind: "empty" };
}
