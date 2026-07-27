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
  | {
      /**
       * Nothing states a next step. One state rather than two, because the
       * interface is the same either way: a prompt to set one. Reporting
       * *which* deficiency applies made the centrepiece an apology for an
       * empty frontmatter field.
       */
      kind: "unset";
      /** The project it would be set on, when one is obvious. */
      project: string | null;
      /** Where to set it. Null when no project has a note at all. */
      notePath: string | null;
      otherActiveCount: number;
    };

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
      kind: "unset",
      project: actives[0].name,
      notePath: actives[0].notePath,
      otherActiveCount: actives.length - 1
    };
  }

  const byDate = [...projects].sort(byRecency);
  const fallback = byDate.find(hasStep);
  if (fallback) {
    return {
      kind: "stated",
      project: fallback.name,
      step: fallback.nextStep.trim(),
      fallback: true,
      otherActiveCount: 0
    };
  }

  // Nowhere obvious to set it, so offer the most recent project that at least
  // has a note to open. Without one there is nothing to link to and the prompt
  // stands alone.
  const withNote = byDate.find((project) => project.notePath);
  return {
    kind: "unset",
    project: withNote?.name ?? null,
    notePath: withNote?.notePath ?? null,
    otherActiveCount: 0
  };
}
