import { useSyncExternalStore } from "react";
import { layoutProjectRing, PROJECT_RING_RADIUS } from "./projectRing";
import { layoutProjectConstellation } from "./projectConstellation";
import type { TrackedProject } from "../types";
import type { VaultGraphPayload } from "./vaultGraph";

// Approved dimensional renderer is the default; fallback can be selected per session.
let enabled = true;
const listeners = new Set<() => void>();
export function setHybridEnabled(value: boolean) { enabled = value; listeners.forEach(fn => fn()); }
export function useHybridEnabled() { return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => enabled); }
export function commandLayout(projects: TrackedProject[], graph: VaultGraphPayload, scale: number) {
  const ring = layoutProjectRing(projects, 220, PROJECT_RING_RADIUS, scale);
  return { ring, constellation: layoutProjectConstellation(graph, ring, 220) };
}
export type CommandLayout = ReturnType<typeof commandLayout>;
export const CONSTELLATION_DEPTH = {
  range:12, rearScale:.94, frontScale:1.06,
  rearIntensity:.42, midIntensity:.58, frontIntensity:.78,
  driftAmount:.55, driftMinPeriod:17, driftPeriodSpread:12,
};
/** Adds depth only; never changes the authoritative screen-plane coordinates. */
export function nodeDepth(id: string) {
  let hash = 2166136261;
  for (const c of id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  const normalized=((hash >>> 0)%10001)/5000-1;
  return Math.sign(normalized)*normalized*normalized*CONSTELLATION_DEPTH.range;
}

// Fixed shallow viewing angle. SVG's affine projection matches the camera at Z=0.
const cameraYaw = -20 * Math.PI / 180;
const cameraElevation = -9 * Math.PI / 180;
export const HYBRID_CAMERA = {
  x: 500 * Math.tan(cameraYaw),
  y: (500 / Math.cos(cameraYaw)) * Math.tan(cameraElevation),
  z: 500,
};
const horizontal = Math.hypot(HYBRID_CAMERA.x, HYBRID_CAMERA.z);
const distance = Math.hypot(horizontal, HYBRID_CAMERA.y);
export const HYBRID_OVERLAY_TRANSFORM = `matrix(${HYBRID_CAMERA.z / horizontal},${HYBRID_CAMERA.x * HYBRID_CAMERA.y / (horizontal * distance)},0,${horizontal / distance},0,0)`;

// Shared inner composition scale preserves Omega/ring proportions.
export const INNER_CORE_SCALE = .72;
