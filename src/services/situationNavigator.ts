import { prioritizeSituation, type PriorityLevel } from "./situationPriority";
import type { Situation } from "./situations";

/**
 * The situation navigator's order, filter and search (review F4).
 *
 * Order follows the existing review policy (`prioritizeSituation`) and adds no
 * scoring of its own: situations with a workstream that needs attention come
 * first, then those with one to review soon, then everything else; within each
 * band, the most recently updated first. Situations known only from
 * correspondence have no saved context for the policy to read, so they are
 * "not assessed" rather than guessed at.
 */

export type NavigatorLevel = PriorityLevel | "not-assessed";
export type NavigatorFilter = "all" | "active" | "emerging" | "questions";

export interface NavigatorEntry {
  id: string;
  title: string;
  state: string;
  updatedAt: string;
  level: NavigatorLevel;
  /** 0 needs attention, 1 review soon, 2 everything else. */
  band: 0 | 1 | 2;
  openQuestions: number;
  stale: boolean;
}

export const LEVEL_LABEL: Record<NavigatorLevel, string> = {
  "needs-attention": "Needs attention",
  "review-soon": "Review soon",
  stable: "Stable",
  unassessed: "Unassessed",
  "not-assessed": "Not assessed"
};

export const LEVEL_HINT: Record<NavigatorLevel, string> = {
  "needs-attention": "A workstream has an open, source-linked payment-coordination question.",
  "review-soon": "A workstream has source-linked open questions.",
  stable: "Saved statuses explicitly report stable, with no open questions.",
  unassessed: "The review policy found no supported priority in the saved context.",
  "not-assessed": "Known from correspondence only; the review policy reads saved document context."
};

export const FILTER_LABEL: Record<NavigatorFilter, string> = {
  all: "All",
  active: "Active",
  emerging: "Emerging",
  questions: "Open questions"
};

export function situationLevel(situation: Situation): { level: NavigatorLevel; openQuestions: number } {
  if (!situation.localContext) return { level: "not-assessed", openQuestions: 0 };
  const priority = prioritizeSituation(situation.localContext);
  const levels = priority.workstreams.map((w) => w.level);
  const level: NavigatorLevel = levels.includes("needs-attention") ? "needs-attention"
    : levels.includes("review-soon") ? "review-soon"
    : levels.length > 0 && levels.every((l) => l === "stable") ? "stable"
    : "unassessed";
  return { level, openQuestions: priority.questions.length };
}

export function navigatorEntries(situations: Situation[]): NavigatorEntry[] {
  return situations.map((situation) => {
    const { level, openQuestions } = situationLevel(situation);
    return {
      id: situation.id,
      title: situation.title,
      state: situation.state,
      updatedAt: situation.updatedAt,
      level,
      band: level === "needs-attention" ? 0 : level === "review-soon" ? 1 : 2,
      openQuestions,
      stale: situation.stale
    };
  });
}

function time(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Stable: equal band and time keep their incoming (backend) order. */
export function sortEntries(entries: NavigatorEntry[]): NavigatorEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.band - b.entry.band || time(b.entry.updatedAt) - time(a.entry.updatedAt) || a.index - b.index)
    .map(({ entry }) => entry);
}

export function filterEntries(entries: NavigatorEntry[], filter: NavigatorFilter, query: string): NavigatorEntry[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter((entry) => {
    if (filter === "active" && entry.state !== "active") return false;
    if (filter === "emerging" && entry.state !== "emerging") return false;
    if (filter === "questions" && entry.openQuestions === 0) return false;
    const title = entry.title.toLowerCase();
    return words.every((word) => title.includes(word));
  });
}
