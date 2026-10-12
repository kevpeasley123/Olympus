/**
 * Layout for the vault graph: hop distance is radius, angle is stable ordering.
 *
 * Deterministic on purpose, and not force-directed. Obsidian's graph jitters on
 * every recompute, so position there means nothing; here radius means distance
 * from the operator's active work and the same vault must produce the same
 * picture tomorrow, so its shape becomes recognisable.
 *
 * Everything in this file is pure. That is the only way anything on the
 * frontend can be checked without the desktop app — see the harness note in
 * `docs/archive/HANDOFF-through-2026-09-28.md`.
 */

/** Mirrors `GraphNode` in `src-tauri/src/commands/vault_graph.rs`. */
export interface VaultGraphNode {
  /** Vault-relative path, forward-slashed. Stable, so the layout is too. */
  id: string;
  title: string;
  folder: string;
  /** Hops from the nearest declared project. `null` is unreachable — the rim. */
  hop: number | null;
  isProject: boolean;
  degree: number;
}

export interface VaultGraphEdge {
  from: string;
  to: string;
}

export interface VaultGraphPayload {
  nodes: VaultGraphNode[];
  edges: VaultGraphEdge[];
  projectCount: number;
  connectedProjectCount: number;
  hopOneCount: number;
  dropped: number;
  /** Reachable notes removed by the backend cap. Orphans are excluded. */
  droppedLinked: number;
  excludedScaffold: number;
  brokenLinks: number;
}

export const EMPTY_VAULT_GRAPH: VaultGraphPayload = {
  nodes: [],
  edges: [],
  projectCount: 0,
  connectedProjectCount: 0,
  hopOneCount: 0,
  dropped: 0,
  droppedLinked: 0,
  excludedScaffold: 0,
  brokenLinks: 0
};

/**
 * Anchors that must carry an edge before the graph draws at all.
 *
 * One, not two. Two was an argument about the picture being *interesting*; the
 * boundary actually worth defending is zero. With no connected anchor, every
 * non-anchor node is unreachable, so every node lands on either the hop-0 ring
 * or the rim, radius carries no information, and the result is indistinguishable
 * from a renderer that is simply broken. At one, there is a real edge and a real
 * measured hop, so the radial axis means something.
 *
 * Eight declared projects with one connected is a *true* picture and the same
 * class of finding as the orphan rim — it says "you have declared eight and
 * linked one", which is worth seeing and is what prompts the linking.
 */
export const GRAPH_MIN_CONNECTED_ANCHORS = 1;

/** Reachable, non-project notes are exactly the nodes Command is allowed to draw. */
export function connectedNoteIds(graph: VaultGraphPayload): Set<string> {
  return new Set(
    graph.nodes
      .filter((node) => !node.isProject && node.hop !== null)
      .map((node) => node.id)
  );
}

/**
 * Pure landing detection for the graph pulse.
 *
 * This intentionally compares two authoritative scans instead of accumulating a
 * second memory. Removing a vault link removes the node from the next result;
 * restoring the link makes it a new landing again.
 */
export function addedConnectedNoteIds(
  previous: VaultGraphPayload,
  next: VaultGraphPayload
): string[] {
  const before = connectedNoteIds(previous);
  return [...connectedNoteIds(next)].filter((id) => !before.has(id)).sort(byId);
}

/**
 * Band radii, measured against the instrument rather than chosen by eye.
 *
 * The floor is the Ω: its layout box is 111.5 units wide, and its ink corner
 * sits near r=77, so hop 0 at 88 clears it diagonally. The ceiling is the tier
 * ring at r=168 carrying an 11px active stroke, whose inner edge is 162.5 — the
 * rim at 152 plus a 4.5-unit anchor leaves 6 units of dark between the graph and
 * the tiers, which is what keeps them reading as two separate instruments.
 */
export const GRAPH_RADII = {
  hop0: 88,
  hop1: 108,
  hop2: 124,
  /** Hop 3 and beyond share a band; past three hops the exact count stops meaning anything. */
  deep: 137,
  /** Unreachable. Outermost because distance from active work is the whole axis. */
  orphan: 152
} as const;

export function radiusForHop(hop: number | null): number {
  if (hop === null) return GRAPH_RADII.orphan;
  if (hop <= 0) return GRAPH_RADII.hop0;
  if (hop === 1) return GRAPH_RADII.hop1;
  if (hop === 2) return GRAPH_RADII.hop2;
  return GRAPH_RADII.deep;
}

export type GraphBand = "anchor" | "hop1" | "hop2" | "deep" | "orphan";

export function bandForNode(node: VaultGraphNode): GraphBand {
  if (node.hop === null) return "orphan";
  if (node.hop <= 0) return "anchor";
  if (node.hop === 1) return "hop1";
  if (node.hop === 2) return "hop2";
  return "deep";
}

export interface PositionedNode extends VaultGraphNode {
  x: number;
  y: number;
  /** Degrees, 0 at twelve o'clock, clockwise — matching the day arc. */
  angle: number;
  radius: number;
  size: number;
  band: GraphBand;
}

export interface PositionedEdge {
  key: string;
  from: PositionedNode;
  to: PositionedNode;
}

export interface GraphLayout {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
}

/**
 * Code-point order, matching `a.id.cmp(&b.id)` on the Rust side.
 *
 * Deliberately *not* `localeCompare`. That is locale-dependent — it orders
 * "Agentic AI Scaffolder" before "AI Learning Course" where a byte comparison
 * does the reverse — so the same vault would lay out differently on a machine
 * with a different locale, and the whole claim of this view is that it does not.
 * Mixing the two also silently disagreed with the anchor ordering below.
 */
function byId(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
