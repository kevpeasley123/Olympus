import { layoutProjectRing, PROJECT_RING_RADIUS } from "./projectRing";
import { layoutProjectConstellation } from "./projectConstellation";
import type { TrackedProject } from "../types";
import type { VaultGraphPayload } from "./vaultGraph";

export function commandLayout(projects: TrackedProject[], graph: VaultGraphPayload, scale: number) {
  const ring = layoutProjectRing(projects, 220, PROJECT_RING_RADIUS, scale);
  return { ring, constellation: layoutProjectConstellation(graph, ring, 220), labelScale: scale };
}
export type CommandLayout = ReturnType<typeof commandLayout>;
export const CONSTELLATION_DEPTH = {
  range:34, rearScale:.79, frontScale:1.30,
  rearIntensity:.24, midIntensity:.58, frontIntensity:.95,
  driftAmount:1.1, driftMinPeriod:23, driftPeriodSpread:14,
  perspectiveDistance:360,
  parallaxX:3.25*Math.PI/180, parallaxY:2.4375*Math.PI/180, parallaxResponse:4,
  rearLine:.40, frontLine:1.18, haloOpacity:.18,
  protectedRadius:48, foregroundRadius:85,
};
/** Adds depth only; never changes the authoritative screen-plane coordinates. */
export function nodeDepth(id: string) {
  let hash = 2166136261;
  for (const c of id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  const normalized=((hash >>> 0)%10001)/5000-1;
  const magnitude=Math.abs(normalized);
  // Keep 60% close to the middle, with continuous tails for spatial anchors.
  const depth=magnitude<=.6?magnitude*.45:.27+.73*Math.sqrt((magnitude-.6)/.4);
  return Math.sign(normalized)*depth*CONSTELLATION_DEPTH.range;
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
