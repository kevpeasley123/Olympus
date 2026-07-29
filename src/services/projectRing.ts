import type { TrackedProject } from "../types";
import type {
  VaultGraphNode,
  VaultGraphPayload
} from "./vaultGraph";

/** The existing project-ring radius. The omega and day arc do not move. */
export const PROJECT_RING_RADIUS = 168;

/**
 * Measured along the ring at the minimum supported 1:1 SVG scale.
 *
 * Below 42px a three-node fan cannot keep two 5px nodes, their hit targets,
 * and a readable gap inside one sector. At the current radius and gap rule,
 * N=20 remains just above this floor and N=21 crosses it. That is the trigger:
 * preserve the equal, stable ring, but stop drawing every cluster at once.
 * The future zoom behavior is deliberately not implemented in this revision.
 */
export const SEMANTIC_ZOOM_ARC_LENGTH_THRESHOLD = 42;

/** Labels sit immediately inside the project stroke, never in the day-arc lane. */
export const PROJECT_LABEL_RADII = [158, 150] as const;
const LABEL_FONT_SIZE = 10;
const ACTIVE_LABEL_FONT_SIZE = 11.5;
const MAX_LABEL_CHARACTERS = 14;
const MIN_LABEL_CHARACTERS = 7;
export const GLYPH_CLEARANCE_RADIUS = 82;

/**
 * Project-owned note bands, outside in.
 *
 * Hop 1 clears the inside label lane; hop 2 makes the live two-hop structure
 * visibly radial; deeper notes stop one full maximum node radius plus a pixel
 * outside the omega clearance disc.
 */
export const PROJECT_GRAPH_RADII = {
  hop1: 128,
  hop2: 99,
  deep: 87
} as const;

export interface Point {
  x: number;
  y: number;
}

export interface ProjectRingSegment {
  project: TrackedProject;
  index: number;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  sectorWidth: number;
  drawnWidth: number;
  drawnArcLength: number;
  root: Point;
}

export interface ProjectRingLabel {
  projectId: string;
  text: string;
  fullText: string;
  x: number;
  y: number;
  radius: number;
  fontSize: number;
  width: number;
  height: number;
  visible: boolean;
  persistent: boolean;
}

export interface ProjectRingLayout {
  segments: ProjectRingSegment[];
  labels: ProjectRingLabel[];
  sectorWidth: number;
  gapAngle: number;
  semanticZoomRecommended: boolean;
}

export interface ProjectGraphNode extends VaultGraphNode {
  projectId: string;
  parentId: string;
  depth: number;
  x: number;
  y: number;
  angle: number;
  radius: number;
  size: number;
  wedgeStart: number;
  wedgeEnd: number;
}

export interface ProjectGraphEdge {
  key: string;
  from: Point;
  to: Point;
}

export interface CrossProjectEdge {
  key: string;
  fromProjectId: string;
  toProjectId: string;
  pieces: ProjectGraphEdge[];
}

export interface ProjectOwnedGraphLayout {
  nodes: ProjectGraphNode[];
  treeEdges: ProjectGraphEdge[];
  crossProjectEdges: CrossProjectEdge[];
  droppedLinked: number;
}

/** Locale-independent Unicode code-point order. */
export function compareCodePoints(left: string, right: string): number {
  const a = Array.from(left);
  const b = Array.from(right);
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (a[index].codePointAt(0) ?? 0) - (b[index].codePointAt(0) ?? 0);
    if (delta !== 0) return delta;
  }
  return a.length - b.length;
}

export function pointOnProjectRing(
  angle: number,
  radius: number,
  centre: number
): Point {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: centre + Math.cos(radians) * radius,
    y: centre + Math.sin(radians) * radius
  };
}

function visibleProjects(projects: TrackedProject[]): TrackedProject[] {
  return projects
    .filter((project) => project.status !== "archived")
    .slice()
    .sort((left, right) => compareCodePoints(left.id, right.id));
}

function segmentGap(sectorWidth: number): number {
  // Three degrees reads as a division at N=8. The proportional cap prevents
  // the gap from consuming a dense sector.
  return Math.min(3, sectorWidth * 0.18);
}

function projectLabelIsPersistent(project: TrackedProject, count: number): boolean {
  return count <= 12 || project.status === "active" || project.status === "watching";
}

function shortenAtWordBoundary(label: string, maximum: number): string {
  const upper = label.trim().replace(/\s+/g, " ").toUpperCase();
  if (upper.length <= maximum) return upper;

  const words = upper.split(" ");
  let result = "";
  for (const word of words) {
    const next = result ? `${result} ${word}` : word;
    if (next.length > maximum) break;
    result = next;
  }

  // Repeated portfolio prefixes are common. If truncation kept only the first
  // word, preserve a distinguishing final token when it fits.
  if (result === words[0] && words.length > 2) {
    const bookended = `${words[0]} ${words[words.length - 1]}`;
    if (bookended.length <= maximum) return bookended;
  }

  if (result.length >= MIN_LABEL_CHARACTERS) return result;
  return `${upper.slice(0, Math.max(MIN_LABEL_CHARACTERS - 1, maximum - 1))}…`;
}

function labelBounds(
  text: string,
  fontSize: number,
  point: Point
): { width: number; height: number; left: number; right: number; top: number; bottom: number } {
  // JetBrains Mono is deliberately measurable without the DOM. The 0.62 ratio
  // is slightly conservative at the configured tracking.
  const width = text.length * fontSize * 0.62;
  const height = fontSize * 1.2;
  return {
    width,
    height,
    left: point.x - width / 2,
    right: point.x + width / 2,
    top: point.y - height / 2,
    bottom: point.y + height / 2
  };
}

function collides(
  candidate: ReturnType<typeof labelBounds>,
  placed: Array<ReturnType<typeof labelBounds>>
): boolean {
  const padding = 3;
  return placed.some(
    (other) =>
      candidate.left < other.right + padding &&
      candidate.right > other.left - padding &&
      candidate.top < other.bottom + padding &&
      candidate.bottom > other.top - padding
  );
}

function labelPriority(project: TrackedProject): number {
  if (project.status === "active") return 0;
  if (project.status === "watching") return 1;
  if (project.status === "scaffold") return 2;
  return 3;
}

function placeLabels(
  segments: ProjectRingSegment[],
  centre: number
): ProjectRingLabel[] {
  const count = segments.length;
  const labels = new Map<string, ProjectRingLabel>();
  const placed: Array<ReturnType<typeof labelBounds>> = [];
  const ordered = segments.slice().sort((left, right) => {
    const priority = labelPriority(left.project) - labelPriority(right.project);
    return priority || compareCodePoints(left.project.id, right.project.id);
  });

  for (const segment of ordered) {
    const persistent = projectLabelIsPersistent(segment.project, count);
    if (!persistent) {
      labels.set(segment.project.id, {
        projectId: segment.project.id,
        text: shortenAtWordBoundary(segment.project.name, MAX_LABEL_CHARACTERS),
        fullText: segment.project.name,
        x: pointOnProjectRing(segment.midAngle, PROJECT_LABEL_RADII[0], centre).x,
        y: pointOnProjectRing(segment.midAngle, PROJECT_LABEL_RADII[0], centre).y,
        radius: PROJECT_LABEL_RADII[0],
        fontSize: LABEL_FONT_SIZE,
        width: 0,
        height: 0,
        visible: false,
        persistent: false
      });
      continue;
    }

    const fontSize =
      segment.project.status === "active" ? ACTIVE_LABEL_FONT_SIZE : LABEL_FONT_SIZE;
    let placement: ProjectRingLabel | null = null;

    for (let maximum = MAX_LABEL_CHARACTERS; maximum >= MIN_LABEL_CHARACTERS; maximum -= 2) {
      const text = shortenAtWordBoundary(segment.project.name, maximum);
      for (const radius of PROJECT_LABEL_RADII) {
        const point = pointOnProjectRing(segment.midAngle, radius, centre);
        const bounds = labelBounds(text, fontSize, point);
        if (collides(bounds, placed)) continue;
        placement = {
          projectId: segment.project.id,
          text,
          fullText: segment.project.name,
          x: point.x,
          y: point.y,
          radius,
          fontSize,
          width: bounds.width,
          height: bounds.height,
          visible: true,
          persistent: true
        };
        placed.push(bounds);
        break;
      }
      if (placement) break;
    }

    labels.set(
      segment.project.id,
      placement ?? {
        projectId: segment.project.id,
        text: shortenAtWordBoundary(segment.project.name, MIN_LABEL_CHARACTERS),
        fullText: segment.project.name,
        x: pointOnProjectRing(segment.midAngle, PROJECT_LABEL_RADII[0], centre).x,
        y: pointOnProjectRing(segment.midAngle, PROJECT_LABEL_RADII[0], centre).y,
        radius: PROJECT_LABEL_RADII[0],
        fontSize,
        width: 0,
        height: 0,
        visible: false,
        persistent: true
      }
    );
  }

  return segments.map((segment) => labels.get(segment.project.id)!);
}

export function layoutProjectRing(
  projects: TrackedProject[],
  centre: number,
  radius = PROJECT_RING_RADIUS
): ProjectRingLayout {
  const visible = visibleProjects(projects);
  if (visible.length === 0) {
    return {
      segments: [],
      labels: [],
      sectorWidth: 0,
      gapAngle: 0,
      semanticZoomRecommended: false
    };
  }

  const sectorWidth = 360 / visible.length;
  const gapAngle = segmentGap(sectorWidth);
  const segments = visible.map((project, index) => {
    const sectorStart = index * sectorWidth;
    const startAngle = sectorStart + gapAngle / 2;
    const endAngle = sectorStart + sectorWidth - gapAngle / 2;
    const midAngle = sectorStart + sectorWidth / 2;
    const drawnWidth = endAngle - startAngle;
    return {
      project,
      index,
      startAngle,
      endAngle,
      midAngle,
      sectorWidth,
      drawnWidth,
      drawnArcLength: (drawnWidth / 360) * 2 * Math.PI * radius,
      root: pointOnProjectRing(midAngle, radius, centre)
    };
  });

  return {
    segments,
    labels: placeLabels(segments, centre),
    sectorWidth,
    gapAngle,
    semanticZoomRecommended:
      segments[0].drawnArcLength < SEMANTIC_ZOOM_ARC_LENGTH_THRESHOLD
  };
}

function nodeRadius(node: VaultGraphNode): number {
  return 2.25 + Math.min(node.degree, 7) * 0.22;
}

function radiusForDepth(depth: number): number {
  if (depth <= 1) return PROJECT_GRAPH_RADII.hop1;
  if (depth === 2) return PROJECT_GRAPH_RADII.hop2;
  return PROJECT_GRAPH_RADII.deep;
}

function buildNeighbours(
  graph: VaultGraphPayload,
  nodesById: Map<string, VaultGraphNode>
): Map<string, string[]> {
  const neighbours = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!nodesById.has(edge.from) || !nodesById.has(edge.to)) continue;
    if (!neighbours.has(edge.from)) neighbours.set(edge.from, []);
    if (!neighbours.has(edge.to)) neighbours.set(edge.to, []);
    neighbours.get(edge.from)!.push(edge.to);
    neighbours.get(edge.to)!.push(edge.from);
  }
  for (const values of neighbours.values()) values.sort(compareCodePoints);
  return neighbours;
}

function distancesFrom(
  root: string,
  neighbours: Map<string, string[]>
): Map<string, number> {
  const distances = new Map<string, number>([[root, 0]]);
  const queue = [root];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const current = queue[cursor];
    const distance = distances.get(current) ?? 0;
    for (const next of neighbours.get(current) ?? []) {
      if (distances.has(next)) continue;
      distances.set(next, distance + 1);
      queue.push(next);
    }
  }
  return distances;
}

function undirectedEdgeKey(left: string, right: string): string {
  return compareCodePoints(left, right) <= 0 ? `${left}↔${right}` : `${right}↔${left}`;
}

/**
 * Returns the visible portions of a line outside the omega's clearance disc.
 * Cross-project meaning stays present without drawing through the glyph.
 */
export function clipLineOutsideDisc(
  from: Point,
  to: Point,
  centre: number,
  radius = GLYPH_CLEARANCE_RADIUS
): Array<{ from: Point; to: Point }> {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const fx = from.x - centre;
  const fy = from.y - centre;
  const a = dx * dx + dy * dy;
  if (a === 0) return [];
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant <= 0) return [{ from, to }];

  const root = Math.sqrt(discriminant);
  const first = (-b - root) / (2 * a);
  const second = (-b + root) / (2 * a);
  if (second <= 0 || first >= 1) return [{ from, to }];

  const at = (value: number): Point => ({
    x: from.x + dx * value,
    y: from.y + dy * value
  });
  const pieces: Array<{ from: Point; to: Point }> = [];
  if (first > 0) pieces.push({ from, to: at(Math.min(first, 1)) });
  if (second < 1) pieces.push({ from: at(Math.max(second, 0)), to });
  return pieces;
}

export function layoutProjectOwnedGraph(
  graph: VaultGraphPayload,
  ring: ProjectRingLayout,
  centre: number
): ProjectOwnedGraphLayout {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const neighbours = buildNeighbours(graph, nodesById);
  const segmentByProject = new Map(
    ring.segments.map((segment) => [segment.project.id, segment])
  );
  const projectByAnchor = new Map<string, string>();
  for (const segment of ring.segments) {
    if (segment.project.notePath && nodesById.has(segment.project.notePath)) {
      projectByAnchor.set(segment.project.notePath, segment.project.id);
    }
  }

  const distanceMaps = new Map<string, Map<string, number>>();
  for (const [anchor, projectId] of projectByAnchor) {
    distanceMaps.set(projectId, distancesFrom(anchor, neighbours));
  }

  const owner = new Map<string, string>();
  const depth = new Map<string, number>();
  for (const [anchor, projectId] of projectByAnchor) {
    owner.set(anchor, projectId);
    depth.set(anchor, 0);
  }

  for (const node of graph.nodes) {
    if (node.isProject || node.hop === null) continue;
    let selectedProject: string | null = null;
    let selectedDistance = Number.POSITIVE_INFINITY;
    for (const [projectId, distances] of distanceMaps) {
      const candidate = distances.get(node.id);
      if (candidate === undefined) continue;
      if (
        candidate < selectedDistance ||
        (candidate === selectedDistance &&
          selectedProject !== null &&
          compareCodePoints(projectId, selectedProject) < 0)
      ) {
        selectedProject = projectId;
        selectedDistance = candidate;
      }
    }
    if (selectedProject !== null && Number.isFinite(selectedDistance)) {
      owner.set(node.id, selectedProject);
      depth.set(node.id, selectedDistance);
    }
  }

  const parent = new Map<string, string>();
  const children = new Map<string, string[]>();
  for (const node of graph.nodes) {
    const projectId = owner.get(node.id);
    const nodeDepth = depth.get(node.id);
    if (!projectId || node.isProject || nodeDepth === undefined || nodeDepth <= 0) continue;
    const candidates = (neighbours.get(node.id) ?? [])
      .filter(
        (candidate) =>
          owner.get(candidate) === projectId && depth.get(candidate) === nodeDepth - 1
      )
      .sort(compareCodePoints);
    const selected = candidates[0];
    if (!selected) continue;
    parent.set(node.id, selected);
    if (!children.has(selected)) children.set(selected, []);
    children.get(selected)!.push(node.id);
  }
  for (const values of children.values()) values.sort(compareCodePoints);

  const sizes = new Map<string, number>();
  function subtreeSize(id: string): number {
    const cached = sizes.get(id);
    if (cached !== undefined) return cached;
    const total = 1 + (children.get(id) ?? []).reduce((sum, child) => sum + subtreeSize(child), 0);
    sizes.set(id, total);
    return total;
  }

  const positioned: ProjectGraphNode[] = [];
  const treeEdges: ProjectGraphEdge[] = [];

  function spread(
    id: string,
    projectId: string,
    wedgeStart: number,
    wedgeEnd: number,
    parentPoint: Point
  ) {
    const node = nodesById.get(id);
    const parentId = parent.get(id);
    const nodeDepth = depth.get(id);
    if (!node || !parentId || nodeDepth === undefined) return;
    const angle = wedgeStart + (wedgeEnd - wedgeStart) / 2;
    const radius = radiusForDepth(nodeDepth);
    const point = pointOnProjectRing(angle, radius, centre);
    positioned.push({
      ...node,
      projectId,
      parentId,
      depth: nodeDepth,
      x: point.x,
      y: point.y,
      angle,
      radius,
      size: nodeRadius(node),
      wedgeStart,
      wedgeEnd
    });
    treeEdges.push({ key: `${parentId}→${id}`, from: parentPoint, to: point });

    const kids = children.get(id) ?? [];
    const total = kids.reduce((sum, child) => sum + subtreeSize(child), 0);
    let cursor = wedgeStart;
    for (const child of kids) {
      const width = ((wedgeEnd - wedgeStart) * subtreeSize(child)) / total;
      spread(child, projectId, cursor, cursor + width, point);
      cursor += width;
    }
  }

  for (const [anchor, projectId] of projectByAnchor) {
    const segment = segmentByProject.get(projectId);
    if (!segment) continue;
    const kids = children.get(anchor) ?? [];
    const total = kids.reduce((sum, child) => sum + subtreeSize(child), 0);
    let cursor = segment.startAngle;
    for (const child of kids) {
      const width = (segment.drawnWidth * subtreeSize(child)) / total;
      spread(child, projectId, cursor, cursor + width, segment.root);
      cursor += width;
    }
  }

  positioned.sort((left, right) => compareCodePoints(left.id, right.id));
  const positionedById = new Map(positioned.map((node) => [node.id, node]));
  const endpoint = (id: string): { point: Point; projectId: string } | null => {
    const projectId = owner.get(id);
    if (!projectId) return null;
    const segment = segmentByProject.get(projectId);
    const node = positionedById.get(id);
    if (node) return { point: { x: node.x, y: node.y }, projectId };
    if (projectByAnchor.has(id) && segment) return { point: segment.root, projectId };
    return null;
  };

  const treeKeys = new Set(
    [...parent.entries()].map(([child, selectedParent]) =>
      undirectedEdgeKey(child, selectedParent)
    )
  );
  const crossProjectEdges: CrossProjectEdge[] = [];
  for (const edge of graph.edges) {
    if (treeKeys.has(undirectedEdgeKey(edge.from, edge.to))) continue;
    const from = endpoint(edge.from);
    const to = endpoint(edge.to);
    if (!from || !to || from.projectId === to.projectId) continue;
    const clipped = clipLineOutsideDisc(from.point, to.point, centre);
    crossProjectEdges.push({
      key: undirectedEdgeKey(edge.from, edge.to),
      fromProjectId: from.projectId,
      toProjectId: to.projectId,
      pieces: clipped.map((piece, index) => ({
        key: `${undirectedEdgeKey(edge.from, edge.to)}:${index}`,
        ...piece
      }))
    });
  }
  crossProjectEdges.sort((left, right) => compareCodePoints(left.key, right.key));

  return {
    nodes: positioned,
    treeEdges,
    crossProjectEdges,
    droppedLinked: graph.droppedLinked ?? graph.dropped
  };
}

export function arcPathForSegment(
  segment: Pick<ProjectRingSegment, "startAngle" | "endAngle">,
  centre: number,
  radius = PROJECT_RING_RADIUS
): string {
  const start = pointOnProjectRing(segment.startAngle, radius, centre);
  const end = pointOnProjectRing(segment.endAngle, radius, centre);
  const large = segment.endAngle - segment.startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y}`;
}
