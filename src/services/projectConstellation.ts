import { clipLineOutsideDisc, compareCodePoints, layoutProjectOwnedGraph, pointOnProjectRing } from "./projectRing";
import type { ProjectGraphNode, ProjectRingLayout } from "./projectRing";
import type { VaultGraphPayload } from "./vaultGraph";

function seed(text: string): number {
  let value = 2166136261;
  for (const character of text) value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  return value >>> 0;
}
function randomFor(id: string) {
  let value = seed(id);
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}

/** Keep ownership and real links; replace rigid hop bands with a spacious star field.
 * Bounded candidate placement runs only when graph data changes, never per frame.
 * Folder affinity is soft: collision clearance wins as the vault grows. */
export function layoutProjectConstellation(graph: VaultGraphPayload, ring: ProjectRingLayout, centre: number) {
  const original = layoutProjectOwnedGraph(graph, ring, centre);
  const scale = centre / 220;
  const placed: ProjectGraphNode[] = [];
  const roots = new Map(ring.segments.map(segment => [segment.project.id, segment.root]));
  const ordered = [...original.nodes].sort((a, b) => a.depth - b.depth || compareCodePoints(a.id, b.id));
  for (const node of ordered) {
    const random = randomFor(node.id);
    const folderAngle = seed(`${node.projectId}/${node.folder}`) % 360;
    const idealAngle = folderAngle + (random() - .5) * 230;
    const idealRadius = (91 + random() * 49) * scale;
    const ideal = pointOnProjectRing(idealAngle, idealRadius, centre);
    const parent = placed.find(candidate => candidate.id === node.parentId);
    let best = { ...ideal, radius: idealRadius, angle: idealAngle, score: -Infinity };
    for (let attempt = 0; attempt < 80; attempt++) {
      const angle = attempt === 0 ? idealAngle : random() * 360;
      const radius = attempt === 0 ? idealRadius : Math.sqrt(88 ** 2 + random() * (143 ** 2 - 88 ** 2)) * scale;
      const point = pointOnProjectRing(angle, radius, centre);
      const clearance = placed.reduce((minimum, other) => Math.min(minimum,
        Math.hypot(point.x - other.x, point.y - other.y) - other.size), 24 * scale);
      const affinity = Math.hypot(point.x - ideal.x, point.y - ideal.y) * .035;
      const branch = parent ? Math.hypot(point.x - parent.x, point.y - parent.y) * .025 : 0;
      const score = Math.min(clearance, 24 * scale) - affinity - branch;
      if (score > best.score) best = { ...point, radius, angle, score };
    }
    placed.push({ ...node, x: best.x, y: best.y, radius: best.radius, angle: best.angle,
      size: (1.15 + Math.min(node.degree, 8) * .14) * scale, subRow: 0, subRowCount: 1 });
  }
  placed.sort((a, b) => compareCodePoints(a.id, b.id));
  const byId = new Map(placed.map(node => [node.id, node]));
  const treeEdges = placed.flatMap(node => {
    const from = byId.get(node.parentId) ?? roots.get(node.projectId);
    return from ? [{ key: `${node.parentId}→${node.id}`, from, to: node, depth: node.depth }] : [];
  });
  // Preserve every cross-project relationship, using the newly settled endpoints.
  const anchorOwners = new Map(ring.segments.map(segment => [segment.project.notePath, segment.project.id]));
  const endpoint = (id: string) => byId.get(id) ?? roots.get(anchorOwners.get(id) ?? "");
  const owner = (id: string) => byId.get(id)?.projectId ?? anchorOwners.get(id);
  const crossProjectEdges = graph.edges.flatMap(edge => {
    const from = endpoint(edge.from), to = endpoint(edge.to);
    const fromProjectId = owner(edge.from), toProjectId = owner(edge.to);
    if (!from || !to || !fromProjectId || !toProjectId || fromProjectId === toProjectId) return [];
    const key = `${edge.from}↔${edge.to}`;
    return [{ key, fromProjectId, toProjectId, from, to,
      pieces: clipLineOutsideDisc(from, to, centre).map((piece, index) => ({ ...piece, key: `${key}:${index}` })) }];
  });
  crossProjectEdges.sort((a, b) => compareCodePoints(a.key, b.key));
  return { ...original, nodes: placed, treeEdges, crossProjectEdges };
}
