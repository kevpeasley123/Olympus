import { layoutProjectConstellation } from "./projectConstellation";
import { layoutProjectRing } from "./projectRing";
import { EMPTY_VAULT_GRAPH } from "./vaultGraph";
import type { VaultGraphPayload } from "./vaultGraph";
import type { TrackedProject } from "../types";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function fixture(count: number, owners: number) {
  const projects: TrackedProject[] = Array.from({ length: owners }, (_, i) => ({
    id: `p${i}`, name: `Project ${i}`, path: `C:/Projects/${i}`, status: "active", statusSource: "declared",
    promoted: null, branch: "main", lastCommit: "test", lastCommitAt: null, repoState: "git-active",
    recentCommits: [], sinceSessionCommits: [], linkedWorktrees: [], summary: "", vision: "",
    visionReviewedAt: null, nextStep: "", notePath: `project-${i}.md`, warnings: []
  }));
  const graph: VaultGraphPayload = { ...EMPTY_VAULT_GRAPH, nodes: projects.map(p => ({ id: p.notePath!, title: p.name,
    folder: "Projects", isProject: true, degree: 1, hop: 0 })), edges: [] };
  for (let i = 0; i < count; i++) {
    const id = `note-${String(i).padStart(3, "0")}.md`;
    graph.nodes.push({ id, title: id, folder: `Folder ${i % 4}`, isProject: false, degree: 2, hop: 1 });
    graph.edges.push({ from: projects[i % owners].notePath!, to: id });
  }
  return { graph, ring: layoutProjectRing(projects, 220, 168, 1.5) };
}
export function runProjectConstellationHarness() {
  let minimumGap = Infinity;
  for (const [count, owners] of [[0, 1], [1, 1], [24, 1], [64, 4], [112, 8]]) {
    const { graph, ring } = fixture(count, owners);
    const layout = layoutProjectConstellation(graph, ring, 220);
    assert(layout.nodes.length === count, "Lost real notes");
    const reversed = layoutProjectConstellation({ ...graph, nodes: [...graph.nodes].reverse(), edges: [...graph.edges].reverse() }, ring, 220);
    assert(JSON.stringify(layout.nodes) === JSON.stringify(reversed.nodes), "Input order changed star positions");
    for (const node of layout.nodes) {
      assert(Number.isFinite(node.x) && node.radius >= 88 && node.radius <= 143, "Star left safe field");
      assert(graph.edges.some(e => e.from === node.parentId && e.to === node.id), "Invented a relationship");
      const edge = layout.treeEdges.find(e => e.key === `${node.parentId}→${node.id}`);
      assert(edge?.to.x === node.x && edge?.to.y === node.y, "Edge missed its star");
    }
    for (let i = 0; i < layout.nodes.length; i++) for (let j = i + 1; j < layout.nodes.length; j++) {
      const a = layout.nodes[i], b = layout.nodes[j];
      const gap = Math.hypot(a.x - b.x, a.y - b.y) - a.size - b.size;
      minimumGap = Math.min(minimumGap, gap);
      assert(gap > 2, "Stars overlap at supported graph capacity");
    }
    if (count === 24) {
      const quadrants = new Set(layout.nodes.map(n => `${n.x > 220}/${n.y > 220}`));
      assert(quadrants.size === 4, "Single project still confined to a narrow wedge");
      const larger = fixture(25, 1);
      const grown = layoutProjectConstellation(larger.graph, larger.ring, 220);
      assert(layout.nodes.every(n => grown.nodes.some(g => g.id === n.id && g.x === n.x && g.y === n.y)), "Appending a note moved existing stars");
    }
  }
  return { passed: true, minimumGap, cases: 5 };
}
