import { useSyncExternalStore } from "react";
import { layoutProjectRing, PROJECT_RING_RADIUS } from "./projectRing";
import { layoutProjectConstellation } from "./projectConstellation";
import type { TrackedProject } from "../types";
import type { VaultGraphPayload } from "./vaultGraph";

// Deliberately session-only while the rendering prototype is being evaluated.
let enabled = false;
const listeners = new Set<() => void>();
export function setHybridEnabled(value: boolean) { enabled = value; listeners.forEach(fn => fn()); }
export function useHybridEnabled() { return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => enabled); }
export function commandLayout(projects: TrackedProject[], graph: VaultGraphPayload, scale: number) {
  const ring = layoutProjectRing(projects, 220, PROJECT_RING_RADIUS, scale);
  return { ring, constellation: layoutProjectConstellation(graph, ring, 220) };
}
export type CommandLayout = ReturnType<typeof commandLayout>;
/** Adds depth only; never changes the authoritative screen-plane coordinates. */
export function nodeDepth(id: string) {
  let hash = 2166136261;
  for (const c of id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return ((hash >>> 0) % 25) - 12;
}
