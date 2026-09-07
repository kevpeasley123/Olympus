import type { CSSProperties } from "react";

// These states describe visual treatment, never permission or task completion.
export type OlympusVisualState = "idle" | "listening" | "thinking" | "speaking" | "executing" | "complete" | "error";
export type AmbientEvent = "tracer" | "sweep" | "node" | "micro";
export const AMBIENT = {
  orbitSlow: 80, orbitMedium: 48, innerPrimary: 10, innerSecondary: 14, breath: 6, tracer: 4.6, sweep: 3.8,
  nodeDrift: 23, nodePulse: 2.8, micro: 2.6, background: 47,
  separationMs: 1500, initialMs: 2200, staggerMs: 1800, responseMs: 450,
  intervals: { tracer: [8000, 12000], sweep: [8000, 13000], node: [5000, 11000], micro: [4000, 9000] }
} as const;
export const ambientVariables = Object.fromEntries(
  Object.entries(AMBIENT).filter(([key, value]) => typeof value === "number" && !key.endsWith("Ms"))
    .map(([key, value]) => [`--ambient-${key}`, `${value}s`])
) as CSSProperties;
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; };
}
export function nextAmbientDelay(kind: AmbientEvent, random: () => number, state: OlympusVisualState) {
  const [low, high] = AMBIENT.intervals[kind];
  const active = state === "thinking" || state === "executing";
  // A tracer always finishes before another starts, including active states.
  return Math.max(kind === "tracer" ? AMBIENT.tracer * 1000 + 1000 : 3000,
    (low + (high - low) * random()) * (active ? 0.7 : 1));
}
