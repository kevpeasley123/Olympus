import { AMBIENT, nextAmbientDelay, seededRandom } from "./ambientMotion";
import type { AmbientEvent, OlympusVisualState } from "./ambientMotion";
export function runAmbientMotionHarness() {
  const a = seededRandom(42), b = seededRandom(42);
  for (let i = 0; i < 100; i++) if (a() !== b()) throw new Error("Timing must be reproducible from a seed");
  const random = seededRandom(19);
  for (const state of ["idle", "thinking", "executing"] as OlympusVisualState[]) {
    for (const kind of ["tracer", "sweep", "node", "micro"] as AmbientEvent[]) {
      const seen = new Set<number>();
      for (let i = 0; i < 1000; i++) {
        const delay = nextAmbientDelay(kind, random, state);
        if (kind === "tracer" && delay <= AMBIENT.tracer * 1000) throw new Error("Tracers overlap");
        if (state === "idle" && (delay < AMBIENT.intervals[kind][0] || delay > AMBIENT.intervals[kind][1])) throw new Error("Timing outside ambient budget");
        seen.add(delay);
      }
      if (seen.size < 900) throw new Error("Timing repeats too frequently");
    }
  }
  return {passed:true, samples:12000, deterministic:true, tracerOverlap:false};
}
