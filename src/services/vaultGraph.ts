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
 * `docs/HANDOFF.md`.
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

export function isGraphLegible(graph: VaultGraphPayload): boolean {
  return graph.connectedProjectCount >= GRAPH_MIN_CONNECTED_ANCHORS;
}

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

/**
 * Degree drives size, within a range narrow enough that it never competes with
 * the band for attention. Anchors are fixed and largest: they are the thing
 * every radius is measured from.
 */
function nodeRadius(node: VaultGraphNode): number {
  if (node.hop === 0) return 4.5;
  return 2 + Math.min(node.degree, 8) * 0.25;
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

function pointAt(angle: number, radius: number, centre: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: centre + Math.cos(radians) * radius,
    y: centre + Math.sin(radians) * radius
  };
}

/**
 * Positions every node and edge.
 *
 * Angles come from a wedge per anchor, subdivided recursively down the hop tree.
 * **Wedge width is proportional to subtree size, not an equal share.** The real
 * vault forces this: eight anchors where one owns every link would give the only
 * real cluster 45° to hold thirteen children while seven childless anchors each
 * owned 45° of nothing. Anchor *order* stays fixed on id, so the sequence around
 * the ring is stable; only the widths breathe as links are added.
 */
export function layoutVaultGraph(
  graph: VaultGraphPayload,
  centre: number
): GraphLayout {
  const nodesById = new Map<string, VaultGraphNode>();
  for (const node of graph.nodes) nodesById.set(node.id, node);

  const neighbours = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!nodesById.has(edge.from) || !nodesById.has(edge.to)) continue;
    if (!neighbours.has(edge.from)) neighbours.set(edge.from, []);
    if (!neighbours.has(edge.to)) neighbours.set(edge.to, []);
    neighbours.get(edge.from)!.push(edge.to);
    neighbours.get(edge.to)!.push(edge.from);
  }

  // Parent is the lowest-id neighbour one hop closer. Lowest-id rather than
  // first-seen so the tree does not depend on edge order.
  const children = new Map<string, string[]>();
  for (const node of graph.nodes) {
    if (node.hop === null || node.hop <= 0) continue;
    const candidates = (neighbours.get(node.id) ?? [])
      .filter((other) => nodesById.get(other)?.hop === (node.hop as number) - 1)
      .sort(byId);
    const parent = candidates[0];
    if (parent === undefined) continue;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent)!.push(node.id);
  }
  for (const list of children.values()) list.sort(byId);

  // Post-order subtree sizes. The hop tree is acyclic by construction — every
  // node has at most one parent and strictly smaller hop — so recursion cannot
  // loop, but depth is bounded by the vault's longest chain regardless.
  const sizes = new Map<string, number>();
  function subtreeSize(id: string): number {
    const cached = sizes.get(id);
    if (cached !== undefined) return cached;
    let total = 1;
    for (const child of children.get(id) ?? []) total += subtreeSize(child);
    sizes.set(id, total);
    return total;
  }

  const positioned: PositionedNode[] = [];

  function place(node: VaultGraphNode, angle: number) {
    const radius = radiusForHop(node.hop);
    const { x, y } = pointAt(angle, radius, centre);
    positioned.push({
      ...node,
      x,
      y,
      angle,
      radius,
      size: nodeRadius(node),
      band: bandForNode(node)
    });
  }

  /** Lays a node at the centre of its wedge, then divides the wedge among its children. */
  function spread(id: string, wedgeStart: number, wedgeWidth: number) {
    const node = nodesById.get(id);
    if (!node) return;

    place(node, wedgeStart + wedgeWidth / 2);

    const kids = children.get(id) ?? [];
    if (kids.length === 0) return;

    const total = kids.reduce((sum, child) => sum + subtreeSize(child), 0);
    let cursor = wedgeStart;
    for (const child of kids) {
      const share = (subtreeSize(child) / total) * wedgeWidth;
      spread(child, cursor, share);
      cursor += share;
    }
  }

  const anchors = graph.nodes
    .filter((node) => node.hop === 0)
    .map((node) => node.id)
    .sort(byId);

  const anchorTotal = anchors.reduce((sum, id) => sum + subtreeSize(id), 0);
  let cursor = 0;
  for (const id of anchors) {
    const width = anchorTotal === 0 ? 360 / anchors.length : (subtreeSize(id) / anchorTotal) * 360;
    spread(id, cursor, width);
    cursor += width;
  }

  // Orphans own the rim outright and are spaced evenly across it. They have no
  // parent to hang from, and crowding them against the cluster would imply a
  // relationship that is precisely what they lack.
  const orphans = graph.nodes
    .filter((node) => node.hop === null)
    .map((node) => node.id)
    .sort(byId);
  orphans.forEach((id, index) => {
    const node = nodesById.get(id);
    if (node) place(node, (index / orphans.length) * 360);
  });

  const placedById = new Map<string, PositionedNode>();
  for (const node of positioned) placedById.set(node.id, node);

  const edges: PositionedEdge[] = [];
  for (const edge of graph.edges) {
    const from = placedById.get(edge.from);
    const to = placedById.get(edge.to);
    if (!from || !to) continue;
    edges.push({ key: `${edge.from}→${edge.to}`, from, to });
  }

  positioned.sort((left, right) => byId(left.id, right.id));

  return { nodes: positioned, edges };
}

/** Hover copy. Says what the node is and how far out it sits, nothing inferred. */
export function describeNode(
  node: Pick<VaultGraphNode, "id" | "title" | "folder" | "hop">
): string {
  // Rust derives `folder` from the first path segment, so a file at the vault
  // root reports its own filename as its folder — `AGENTS.md` in `AGENTS.md`.
  // Naming the real location is more useful than echoing the title back.
  const where = !node.folder || node.folder === node.id ? "vault root" : node.folder;
  if (node.hop === null) return `${node.title} · ${where} · unlinked`;
  if (node.hop === 0) return `${node.title} · ${where} · project`;
  return `${node.title} · ${where} · ${node.hop} hop${node.hop === 1 ? "" : "s"} out`;
}
