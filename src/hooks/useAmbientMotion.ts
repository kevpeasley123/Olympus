import { useEffect, useState } from "react";
import { AMBIENT, nextAmbientDelay, seededRandom } from "../services/ambientMotion";
import type { AmbientEvent, OlympusVisualState } from "../services/ambientMotion";

export function useMotionPermission() {
  const permitted = () => document.visibilityState === "visible" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [running, setRunning] = useState(permitted);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => setRunning(document.visibilityState === "visible" && !media.matches);
    changed();
    document.addEventListener("visibilitychange", changed);
    media.addEventListener("change", changed);
    return () => { document.removeEventListener("visibilitychange", changed); media.removeEventListener("change", changed); };
  }, []);
  return running;
}

export function useAmbientMotion(state: OlympusVisualState) {
  const running = useMotionPermission();
  const [events, setEvents] = useState<Record<AmbientEvent, number>>({ tracer: 0, sweep: 0, node: 0, micro: 0 });
  useEffect(() => {
    setEvents({ tracer: 0, sweep: 0, node: 0, micro: 0 });
    if (!running) return;
    const random = seededRandom(Date.now());
    const kinds: AmbientEvent[] = ["tracer", "node", "micro", "sweep"];
    const now = performance.now();
    const due = Object.fromEntries(kinds.map((kind, i) => [kind, now + AMBIENT.initialMs + i * AMBIENT.staggerMs])) as Record<AmbientEvent, number>;
    let timer: number;
    let serial = 0;
    const schedule = () => {
      const kind = kinds.reduce((a, b) => due[a] < due[b] ? a : b);
      timer = window.setTimeout(() => {
        const time = performance.now();
        const eventId = ++serial;
        setEvents(previous => ({ ...previous, [kind]: eventId }));
        due[kind] = time + nextAmbientDelay(kind, random, state);
        for (const other of kinds) if (other !== kind) due[other] = Math.max(due[other], time + AMBIENT.separationMs);
        schedule();
      }, Math.max(0, due[kind] - performance.now()));
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [running, state]);
  return { running, events };
}
