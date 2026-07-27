import type { ProjectStatus, TrackedProject } from "../types";

/**
 * Tier order and stroke weight for the instrument's outer ring.
 *
 * Mirrors `ProjectStatus::rank` in `project_notes.rs`: `unclassified` sits
 * directly under `active` rather than at the bottom, because on a vault where
 * most projects have no note yet, burying them hides most of the portfolio.
 */
const TIER_ORDER: ProjectStatus[] = [
  "active",
  "unclassified",
  "watching",
  "scaffold",
  "archived"
];

/**
 * Stroke weight carries status alongside lightness; arc length carries count.
 * Active is heaviest so a single active project still reads as the dominant
 * mark even when it is one arc of eight.
 *
 * The floor is 5, not 3. Four weights a pixel apart are not separable on a
 * 500px ring, which is why lightness moves with them — and why the faintest
 * tier is no longer a hairline that read as empty track.
 */
export const TIER_WEIGHT: Record<ProjectStatus, number> = {
  active: 11,
  unclassified: 5,
  watching: 8,
  scaffold: 6,
  archived: 4
};

export interface TierSlice {
  status: ProjectStatus;
  count: number;
  /** Share of the whole portfolio, 0..1. */
  fraction: number;
}

/**
 * Counts by tier, richest first, omitting tiers nobody is in.
 *
 * `unclassified` is included deliberately. It is the absence of a declaration
 * rather than a judgement, but leaving it out of the ring would draw a circle
 * representing one of eight projects while looking like the whole portfolio.
 * When it shrinks to nothing, that is the ring reporting success.
 */
export function tierBreakdown(projects: TrackedProject[]): TierSlice[] {
  const total = projects.length;
  if (total === 0) return [];

  const counts = new Map<ProjectStatus, number>();
  for (const project of projects) {
    counts.set(project.status, (counts.get(project.status) ?? 0) + 1);
  }

  return TIER_ORDER.filter((status) => (counts.get(status) ?? 0) > 0).map((status) => {
    const count = counts.get(status) ?? 0;
    return { status, count, fraction: count / total };
  });
}
