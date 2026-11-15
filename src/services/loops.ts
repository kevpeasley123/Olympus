import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./launcher";

/** One of Olympus's loops, as `commands/loops.rs` writes it down, with its recorded score (docs/LOOPS.md). */
export interface LoopCard {
  id: string; name: string; trigger: string; goal: string; verifier: string; verifierKind: string[];
  actions: string; memory: string; cap: string; gate: string; gap: string;
  score: { runs: number; completed: number; failed: number; firstPass: number; revisions: number; revisionsResolved: number; capHits: number; awaitingReview: number; seconds: number; reportedCostUsd: number };
}

export async function readScorecard(days = 7): Promise<LoopCard[]> {
  if (!isTauriRuntime()) return [];
  return invoke<LoopCard[]>("loop_scorecard", { days });
}

/** The loop an operation belongs to, from its skill; work known only from events is a background job. Mirrors `loop_for_skill`. */
export function loopName(skillId: string | null | undefined): string {
  if (!skillId) return "Background job";
  return skillId === "work-request" ? "Ask Olympus" : skillId === "opening-brief" ? "Opening brief" : "One Olympian";
}

const percent = (part: number, whole: number) => whole ? `${Math.round(part / whole * 100)}%` : "—";
/** A score in words: only what was recorded, and nothing when nothing ran. */
export function describeScore(card: LoopCard): string {
  const s = card.score;
  if (!s.runs) return "No runs this week.";
  const parts = [`${s.runs} run${s.runs === 1 ? "" : "s"}`, `${percent(s.firstPass, s.runs)} right first time`];
  if (s.failed) parts.push(`${s.failed} stopped${s.capHits ? ` (${s.capHits} out of steps)` : ""}`);
  if (s.revisions) parts.push(`${s.revisions} revised, ${s.revisionsResolved} resolved`);
  if (s.awaitingReview) parts.push(`${s.awaitingReview} awaiting your review`);
  if (s.reportedCostUsd > 0) parts.push(`$${s.reportedCostUsd.toFixed(2)} at API rates`);
  return `${parts.join(" · ")}.`;
}

export interface CheckStat { id: string; passed: number; total: number; lastFailure: string | null }
export interface Expectation { id: string; statement: string; kevinSaid: string; saidOn: string; source: string; status: "proposed" | "approved" | "retired"; checks: CheckStat[] }
export interface VisionReport { score: number | null; passed: number; total: number; expectations: Expectation[] }

export async function readVision(days = 7): Promise<VisionReport | null> {
  if (!isTauriRuntime()) return null;
  return invoke<VisionReport>("vision_report", { days });
}
export async function decideExpectation(id: string, status: Expectation["status"]): Promise<void> {
  await invoke("set_expectation_status", { id, status });
}

/** One expectation's week in words: what its rules recorded, or that only the weekly review can judge it. */
export function describeExpectation(expectation: Expectation): string {
  if (!expectation.checks.length) return "Judged at the weekly review.";
  const passed = expectation.checks.reduce((n, c) => n + c.passed, 0), total = expectation.checks.reduce((n, c) => n + c.total, 0);
  if (!total) return "Not checked yet this week.";
  const broken = expectation.checks.filter(c => c.lastFailure).map(c => c.lastFailure);
  return `${passed} of ${total} checks passed${broken.length ? `. Last miss: ${broken[0]}` : ""}.`;
}
