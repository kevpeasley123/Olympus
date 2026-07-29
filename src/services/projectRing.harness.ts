import {
  PROJECT_GRAPH_RADII,
  PROJECT_RING_RADIUS,
  SEMANTIC_ZOOM_ARC_LENGTH_THRESHOLD,
  clipLineOutsideDisc,
  compareCodePoints,
  layoutProjectOwnedGraph,
  layoutProjectRing
} from "./projectRing";
import type { ProjectGraphNode, ProjectRingLabel } from "./projectRing";
import { addedConnectedNoteIds } from "./vaultGraph";
import type { VaultGraphPayload } from "./vaultGraph";
import type { ProjectStatus, TrackedProject } from "../types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function project(
  id: string,
  name: string,
  status: ProjectStatus,
  notePath = `01 - Projects/${name}.md`
): TrackedProject {
  return {
    id,
    name,
    path: `C:\\Projects\\${name}`,
    status,
    statusSource: status === "unclassified" ? "inferred" : "declared",
    promoted: null,
    branch: "main",
    lastCommit: "abc1234 Test commit",
    lastCommitAt: "2026-07-28T12:00:00-07:00",
    repoState: "git-active",
    recentCommits: [],
    sinceSessionCommits: [],
    linkedWorktrees: [],
    summary: "",
    vision: "",
    visionReviewedAt: null,
    nextStep: "",
    notePath,
    warnings: []
  };
}

function payload(
  nodes: VaultGraphPayload["nodes"],
  edges: VaultGraphPayload["edges"]
): VaultGraphPayload {
  return {
    nodes,
    edges,
    projectCount: nodes.filter((node) => node.isProject).length,
    connectedProjectCount: nodes.filter((node) => node.isProject && node.degree > 0).length,
    hopOneCount: nodes.filter((node) => node.hop === 1).length,
    dropped: 0,
    droppedLinked: 0,
    excludedScaffold: 0,
    brokenLinks: 0
  };
}

function labelBoxes(labels: ProjectRingLabel[]) {
  return labels
    .filter((label) => label.visible)
    .map((label) => ({
      id: label.projectId,
      left: label.x - label.width / 2,
      right: label.x + label.width / 2,
      top: label.y - label.height / 2,
      bottom: label.y + label.height / 2
    }));
}

function assertNoLabelCollisions(labels: ProjectRingLabel[], caseName: string) {
  const boxes = labelBoxes(labels);
  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) {
      const a = boxes[left];
      const b = boxes[right];
      const overlaps =
        a.left < b.right + 3 &&
        a.right > b.left - 3 &&
        a.top < b.bottom + 3 &&
        a.bottom > b.top - 3;
      assert(!overlaps, `${caseName}: labels ${a.id} and ${b.id} collide`);
    }
  }
}

function angularExtent(node: ProjectGraphNode): number {
  return (Math.asin(Math.min(1, node.size / node.radius)) * 180) / Math.PI;
}

function assertNodesInsideParentWedges(
  nodes: ProjectGraphNode[],
  caseName: string
) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    const extent = angularExtent(node);
    assert(
      node.angle - extent >= node.wedgeStart - 1e-9 &&
        node.angle + extent <= node.wedgeEnd + 1e-9,
      `${caseName}: ${node.id} leaves its assigned wedge`
    );
    const parent = byId.get(node.parentId);
    if (parent) {
      assert(
        node.wedgeStart >= parent.wedgeStart - 1e-9 &&
          node.wedgeEnd <= parent.wedgeEnd + 1e-9,
        `${caseName}: ${node.id} leaves parent ${parent.id}'s wedge`
      );
    }
  }
}

function assertLabelsClearOfNodes(
  labels: ProjectRingLabel[],
  nodes: ProjectGraphNode[],
  caseName: string
) {
  for (const label of labels.filter((candidate) => candidate.visible)) {
    const left = label.x - label.width / 2;
    const right = label.x + label.width / 2;
    const top = label.y - label.height / 2;
    const bottom = label.y + label.height / 2;
    for (const node of nodes) {
      const nearestX = Math.max(left, Math.min(node.x, right));
      const nearestY = Math.max(top, Math.min(node.y, bottom));
      assert(
        Math.hypot(node.x - nearestX, node.y - nearestY) > node.size + 2,
        `${caseName}: label ${label.projectId} crowds note ${node.id}`
      );
    }
  }
}

const realEight = [
  project("ai-learning-course", "AI Learning Course", "scaffold"),
  project("agentic-ai-scaffolder", "Agentic AI Scaffolder", "scaffold"),
  project("fidelity-agentic-ai-development", "Fidelity Agentic AI Development", "scaffold"),
  project("fruit-organizer", "Fruit Organizer", "scaffold"),
  project("health-app", "Health app", "scaffold"),
  project("obsidian-visual-project", "Obsidian Visual Project", "scaffold"),
  project("olympus", "Olympus", "active", "01 - Projects/Project Olympus.md"),
  project("pokedex", "Pokedex", "watching")
];

export function runProjectRingHarness() {
  const centre = 220;
  const ring = layoutProjectRing(realEight, centre);
  assert(ring.segments.length === 8, "N=8: expected one segment per project");
  assertNoLabelCollisions(ring.labels, "N=8");
  assert(
    ring.labels.every((label) => label.radius < PROJECT_RING_RADIUS),
    "N=8: a label escaped into the day-arc lane"
  );
  const widths = new Set(ring.segments.map((segment) => segment.drawnWidth.toFixed(8)));
  assert(widths.size === 1, "N=8: segment widths are not equal");

  const changedStatus = realEight.map((item) =>
    item.id === "olympus" ? { ...item, status: "scaffold" as const } : item
  );
  const statusRing = layoutProjectRing(changedStatus.reverse(), centre);
  for (const segment of ring.segments) {
    const after = statusRing.segments.find(
      (candidate) => candidate.project.id === segment.project.id
    );
    assert(after, `bearing stability: ${segment.project.id} disappeared`);
    assert(
      after.midAngle === segment.midAngle &&
        after.startAngle === segment.startAngle &&
        after.endAngle === segment.endAngle,
      `bearing stability: ${segment.project.id} moved after a tier change`
    );
  }

  const twenty = Array.from({ length: 20 }, (_, index) => {
    const status: ProjectStatus =
      index < 3 ? "active" : index < 5 ? "watching" : "scaffold";
    return project(
      `project-${index.toString().padStart(2, "0")}`,
      `Portfolio Project ${index.toString().padStart(2, "0")}`,
      status
    );
  });
  const dense = layoutProjectRing(twenty, centre);
  assertNoLabelCollisions(dense.labels, "N=20");
  assert(
    dense.labels.filter((label) => label.visible).length === 5,
    "N=20: only active and watching labels should persist"
  );
  const denseVisibleText = dense.labels
    .filter((label) => label.visible)
    .map((label) => label.text);
  assert(
    new Set(denseVisibleText).size === denseVisibleText.length,
    "N=20: persistent labels are non-colliding but indistinguishable"
  );
  assert(
    dense.segments.every(
      (segment) =>
        Math.abs(segment.drawnArcLength - dense.segments[0].drawnArcLength) < 1e-9
    ),
    "N=20: measured segment widths differ"
  );
  assert(
    dense.segments[0].drawnArcLength >= SEMANTIC_ZOOM_ARC_LENGTH_THRESHOLD,
    "N=20 should remain above the measured semantic-zoom trigger"
  );
  const thirty = layoutProjectRing(
    Array.from({ length: 30 }, (_, index) =>
      project(`dense-${index.toString().padStart(2, "0")}`, `Dense ${index}`, "scaffold")
    ),
    centre
  );
  assert(thirty.semanticZoomRecommended, "N=30 should cross the measured zoom trigger");

  const graphNodes: VaultGraphPayload["nodes"] = [
    {
      id: "01 - Projects/Project Olympus.md",
      title: "Project Olympus",
      folder: "01 - Projects",
      hop: 0,
      isProject: true,
      degree: 2
    },
    {
      id: "01 - Projects/Pokedex.md",
      title: "Pokedex",
      folder: "01 - Projects",
      hop: 0,
      isProject: true,
      degree: 1
    },
    {
      id: "02 - Research/Shared.md",
      title: "Shared",
      folder: "02 - Research",
      hop: 1,
      isProject: false,
      degree: 3
    },
    {
      id: "02 - Research/Child A.md",
      title: "Child A",
      folder: "02 - Research",
      hop: 2,
      isProject: false,
      degree: 1
    },
    {
      id: "02 - Research/Child B.md",
      title: "Child B",
      folder: "02 - Research",
      hop: 2,
      isProject: false,
      degree: 1
    }
  ];
  const graphEdges = [
    { from: "01 - Projects/Project Olympus.md", to: "02 - Research/Shared.md" },
    { from: "01 - Projects/Pokedex.md", to: "02 - Research/Shared.md" },
    { from: "02 - Research/Shared.md", to: "02 - Research/Child A.md" },
    { from: "02 - Research/Shared.md", to: "02 - Research/Child B.md" }
  ];
  const constellation = layoutProjectOwnedGraph(
    payload(graphNodes, graphEdges),
    ring,
    centre
  );
  assert(constellation.nodes.length === 3, "linked graph lost a reachable note");
  assertNodesInsideParentWedges(constellation.nodes, "project graph");
  assertLabelsClearOfNodes(ring.labels, constellation.nodes, "project graph");
  assert(
    constellation.nodes
      .filter((node) => node.depth === 1)
      .every((node) => node.radius === PROJECT_GRAPH_RADII.hop1) &&
      constellation.nodes
        .filter((node) => node.depth === 2)
        .every((node) => node.radius === PROJECT_GRAPH_RADII.hop2),
    "project graph did not use the declared radial hop bands"
  );
  assert(
    constellation.crossProjectEdges.length === 1,
    "the shared note did not retain its cross-project link"
  );
  const clipped = clipLineOutsideDisc(
    { x: centre - 120, y: centre },
    { x: centre + 120, y: centre },
    centre
  );
  assert(clipped.length === 2, "a cross-link through omega was not split");
  assert(
    clipped.every((piece) =>
      [piece.from, piece.to].every(
        (point) => Math.hypot(point.x - centre, point.y - centre) >= 82 - 1e-9
      )
    ),
    "a clipped cross-link entered omega's clearance disc"
  );

  const emptyGraph = payload(
    [
      graphNodes[0],
      { ...graphNodes[2], hop: null, degree: 0 }
    ],
    []
  );
  const before = layoutProjectOwnedGraph(emptyGraph, ring, centre);
  assert(before.nodes.length === 0, "an unlinked note entered Command");
  const linkedGraph = payload(
    [
      { ...graphNodes[0], degree: 1 },
      { ...graphNodes[2], hop: 1, degree: 1 }
    ],
    [{ from: graphNodes[0].id, to: graphNodes[2].id }]
  );
  const landed = layoutProjectOwnedGraph(linkedGraph, ring, centre);
  assert(landed.nodes.length === 1, "new link did not land in an empty project");
  assert(
    addedConnectedNoteIds(emptyGraph, linkedGraph).length === 1,
    "a new linked node did not trigger one assertable landing"
  );
  const repeated = layoutProjectOwnedGraph(linkedGraph, ring, centre);
  assert(
    JSON.stringify(repeated) === JSON.stringify(landed),
    "an unchanged scan changed the constellation"
  );
  assert(
    addedConnectedNoteIds(linkedGraph, linkedGraph).length === 0,
    "an unchanged scan retriggered the node landing"
  );
  const removed = layoutProjectOwnedGraph(emptyGraph, ring, centre);
  assert(
    landed.nodes.filter((node) => !removed.nodes.some((other) => other.id === node.id))
      .length === 1,
    "removing one link did not remove exactly one Command node"
  );
  const cappedGraph = { ...linkedGraph, dropped: 7, droppedLinked: 3 };
  assert(
    layoutProjectOwnedGraph(cappedGraph, ring, centre).droppedLinked === 3,
    "the visible cap count lost the number of linked notes not shown"
  );

  const sorted = realEight.map((item) => item.id).sort(compareCodePoints);
  assert(
    JSON.stringify(ring.segments.map((segment) => segment.project.id)) ===
      JSON.stringify(sorted),
    "project ordering is not code-point stable"
  );

  return {
    passed: true,
    n8Labels: ring.labels.filter((label) => label.visible).map((label) => label.text),
    n20PersistentLabels: dense.labels
      .filter((label) => label.visible)
      .map((label) => label.text),
    n20ArcLength: dense.segments[0].drawnArcLength,
    semanticZoomThreshold: SEMANTIC_ZOOM_ARC_LENGTH_THRESHOLD,
    n30ArcLength: thirty.segments[0].drawnArcLength,
    graphNodes: constellation.nodes.length,
    crossProjectEdges: constellation.crossProjectEdges.length,
    clippedCrossEdgePieces: clipped.length,
    linkedNotShown: 3,
    hopRadii: PROJECT_GRAPH_RADII
  };
}
