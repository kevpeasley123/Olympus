import {
  DIAL_RADIUS,
  GLYPH_BASELINE_OFFSET,
  GLYPH_CLEARANCE_RADIUS,
  HOP_CLAMP_DEPTH,
  LABEL_GAP_EXACT_ABOVE_SCALE,
  MAX_NODE_RADIUS,
  MAX_SUB_ROWS,
  MIN_NODE_SPACING_DIAMETERS,
  subRowOffset,
  PROJECT_RING_RADIUS,
  SEMANTIC_ZOOM_ARC_LENGTH_THRESHOLD,
  WIDEST_SEGMENT_STROKE,
  clipLineOutsideDisc,
  compareCodePoints,
  labelInnerExtent,
  labelRadius,
  layoutCentreReadout,
  layoutProjectOwnedGraph,
  layoutProjectRing,
  radiusForDepth
} from "./projectRing";
import type { ProjectGraphNode, ProjectRingLabel } from "./projectRing";
import { addedConnectedNoteIds } from "./vaultGraph";
import type { VaultGraphPayload } from "./vaultGraph";
import type { ProjectStatus, TrackedProject } from "../types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/**
 * Fixtures must fail loudly, because a wrong one fails silently.
 *
 * **[V] The failure this exists to stop, 2026-07-30.** A reconstruction of
 * `realEight` that omitted `notePath` positioned **zero** nodes at every count
 * while throwing nothing. The anchor joins projects to the graph on that field,
 * so without it no wedge owns a note and `layoutProjectOwnedGraph` correctly
 * returns an empty layout for an input that describes nothing.
 *
 * That is worse than a vacuous assertion. A vacuous assertion is real code that
 * cannot fail; this is a real assertion running against an input that silently
 * describes nothing — so the assertions pass, or the sweep reads as catastrophic
 * breakage, and neither points at the fixture. It cost a round diagnosing the
 * layout module for a defect in the test data.
 *
 * So every fixture is validated before use rather than trusted, and the layout
 * is validated against what the fixture *claimed*. Silence is not a result.
 */
function assertFixtureIsWellFormed(projects: TrackedProject[], caseName: string) {
  assert(projects.length > 0, `${caseName}: fixture has no projects at all`);

  for (const candidate of projects) {
    assert(
      Boolean(candidate.notePath),
      `${caseName}: project "${candidate.id}" has no notePath — the graph anchor ` +
        `joins on it, so this fixture would position zero nodes and throw nothing`
    );
    assert(
      Boolean(candidate.id) && Boolean(candidate.name),
      `${caseName}: a project is missing an id or a name`
    );
  }

  const ids = new Set(projects.map((candidate) => candidate.id));
  assert(
    ids.size === projects.length,
    `${caseName}: duplicate project ids — segments would collide on a stable-order key`
  );
}

/**
 * A layout that positions nothing for a graph that claims notes is a broken
 * fixture, not a passing test. Asserted separately from spacing and clearance:
 * those are properties *of* a layout, and this establishes there is one.
 */
function assertLayoutIsNotVacuous(
  positioned: number,
  claimedNotes: number,
  caseName: string
) {
  if (claimedNotes === 0) return;
  assert(
    positioned > 0,
    `${caseName}: the graph claims ${claimedNotes} linked note(s) and the layout ` +
      `positioned none. Every assertion below this would pass over an empty set. ` +
      `Check the fixture's notePath before suspecting the layout module.`
  );
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

const SCALES = [1.0, 1.2, 1.35, 1.71, 2.81];

/**
 * The smallest render scale the real window can produce.
 *
 * `tauri.conf.json` sets `minWidth: 1280` / `minHeight: 800`, and the dial is
 * `min(100vh - 206px, 100vw - 560px)` over a 440-unit viewBox, so the scale floors
 * at about 1.35. Scales below this are reachable only in the browser dev server,
 * where behaviour is asserted to degrade gracefully rather than to hold.
 */
const MIN_WINDOW_SCALE = 1.35;

/**
 * Depth must be readable as depth. The previous bands were 29 units, then 12,
 * then a total collapse of every depth at or beyond 3 onto one radius — which no
 * assertion would have caught, because nothing asserted the bands were distinct.
 */
function assertHopDepthIsEncoded(minimumSeparation: number) {
  for (const scale of SCALES) {
    void scale; // radii are in viewBox units, so they are scale-invariant by construction
  }
  for (let depth = 1; depth < HOP_CLAMP_DEPTH; depth += 1) {
    const outer = radiusForDepth(depth, DIAL_RADIUS);
    const inner = radiusForDepth(depth + 1, DIAL_RADIUS);
    assert(
      outer - inner >= minimumSeparation,
      `hop depth ${depth}->${depth + 1} separation ${(outer - inner).toFixed(2)} is below the ${minimumSeparation} minimum`
    );
  }

  // The clamp is where it is documented to be, and one band beyond it is shared.
  assert(
    radiusForDepth(HOP_CLAMP_DEPTH, DIAL_RADIUS) ===
      radiusForDepth(HOP_CLAMP_DEPTH + 3, DIAL_RADIUS),
    "depths beyond the clamp must share the innermost band"
  );
  assert(
    radiusForDepth(HOP_CLAMP_DEPTH - 1, DIAL_RADIUS) >
      radiusForDepth(HOP_CLAMP_DEPTH, DIAL_RADIUS),
    `the clamp fires early: depth ${HOP_CLAMP_DEPTH - 1} is not outside depth ${HOP_CLAMP_DEPTH}`
  );

  // The innermost band still clears the glyph by a full maximum node radius.
  assert(
    radiusForDepth(HOP_CLAMP_DEPTH, DIAL_RADIUS) - MAX_NODE_RADIUS >
      GLYPH_CLEARANCE_RADIUS,
    "the innermost note band reaches into the glyph clearance disc"
  );
}

/**
 * The label lane holds a constant on-screen distance from the stroke, and never
 * reaches inward far enough to touch a hop-1 note.
 */
function assertLabelLaneHolds() {
  const innerEdge = PROJECT_RING_RADIUS - WIDEST_SEGMENT_STROKE / 2;
  const hopOne = radiusForDepth(1, DIAL_RADIUS);

  // Containment holds at every scale, including below the real window's floor.
  for (const scale of [0.6, 0.8, ...SCALES, 4.0]) {
    for (const fontSize of [10, 11.5]) {
      const radius = labelRadius(fontSize, scale);
      assert(
        radius < innerEdge,
        `scale ${scale}: a ${fontSize}px label crossed the segment stroke`
      );
      const extent = labelInnerExtent(fontSize, scale);
      assert(
        extent > hopOne + MAX_NODE_RADIUS,
        `scale ${scale}: a ${fontSize}px label reaches into the hop-1 band (${extent.toFixed(2)} vs ${(hopOne + MAX_NODE_RADIUS).toFixed(2)})`
      );
    }
  }

  // Above the derived threshold the gap is exactly constant in pixels, which is
  // the fix for the detachment. A unit-based inset would drift with the dial.
  const gapsPx = new Set<string>();
  for (const scale of SCALES.filter((value) => value >= LABEL_GAP_EXACT_ABOVE_SCALE)) {
    const gapPx = (innerEdge - labelRadius(10, scale)) * scale;
    const expected = 5 + 10 * 0.7;
    assert(
      Math.abs(gapPx - expected) < 1e-6,
      `scale ${scale}: label gap ${gapPx.toFixed(3)}px drifted from the constant ${expected}px`
    );
    gapsPx.add(gapPx.toFixed(6));
  }
  assert(
    gapsPx.size === 1,
    `the label gap changed with the dial scale: ${[...gapsPx].join(", ")}`
  );
}

/**
 * Sub-rows break a crowded band back into countable nodes without becoming a hop.
 *
 * Built as a stress case on purpose: one wedge with `count` depth-1 notes, which is
 * the configuration that made Olympus's band render as a continuous stroke.
 */
function denseSingleProjectGraph(count: number): VaultGraphPayload {
  const anchor = "01 - Projects/Project Olympus.md";
  const nodes: VaultGraphPayload["nodes"] = [
    { id: anchor, title: "Project Olympus", folder: "01 - Projects", hop: 0, isProject: true, degree: count }
  ];
  const edges: VaultGraphPayload["edges"] = [];
  for (let index = 0; index < count; index += 1) {
    const id = `02 - Research/dense-note-${index.toString().padStart(2, "0")}.md`;
    nodes.push({ id, title: `Dense ${index}`, folder: "02 - Research", hop: 1, isProject: false, degree: 1 });
    edges.push({ from: anchor, to: id });
  }
  return payload(nodes, edges);
}

function assertSubRowsAreLegible(count: number, caseName: string, withinCapacity: boolean) {
  const centre = 220;
  const requiredSpacing = MIN_NODE_SPACING_DIAMETERS * 2 * MAX_NODE_RADIUS;
  const depthStep = radiusForDepth(1, DIAL_RADIUS) - radiusForDepth(2, DIAL_RADIUS);

  for (const scale of SCALES) {
    const ring = layoutProjectRing(realEight, centre, PROJECT_RING_RADIUS, scale);
    const graph = denseSingleProjectGraph(count);
    const laid = layoutProjectOwnedGraph(graph, ring, centre);
    // Before any property of the layout: is there a layout? An empty result here
    // means the fixture, not the module.
    assertLayoutIsNotVacuous(laid.nodes.length, graph.hopOneCount, `${caseName} @ ${scale}x`);
    const band = laid.nodes.filter((node) => node.depth === 1);
    assert(band.length === count, `${caseName} @ ${scale}x: expected ${count} depth-1 notes`);

    const rows = band[0].subRowCount;
    assert(
      band.every((node) => node.subRowCount === rows),
      `${caseName} @ ${scale}x: one band disagreed with itself about its row count`
    );
    assert(
      rows <= MAX_SUB_ROWS,
      `${caseName} @ ${scale}x: ${rows} sub-rows exceeds the derived maximum`
    );

    // The stagger must never be mistakable for a hop.
    const offset = subRowOffset(rows, DIAL_RADIUS);
    assert(
      offset < depthStep / 2,
      `${caseName}: sub-row offset ${offset.toFixed(2)} is at or past half the ${depthStep.toFixed(2)} depth step`
    );

    // Same-row neighbours clear the minimum spacing, which is the whole point.
    // Only asserted within sub-row capacity: two rows space about 14 notes in a
    // 42-degree wedge, and beyond that the band degrades by crowding. The stress
    // case below pins that degradation stays containment-safe.
    if (rows > 1 && withinCapacity) {
      const byRow = new Map<number, typeof band>();
      for (const node of band) {
        if (!byRow.has(node.subRow)) byRow.set(node.subRow, []);
        byRow.get(node.subRow)!.push(node);
      }
      for (const [row, members] of byRow) {
        const sorted = members.slice().sort((left, right) => left.angle - right.angle);
        for (let index = 1; index < sorted.length; index += 1) {
          const gap = Math.hypot(
            sorted[index].x - sorted[index - 1].x,
            sorted[index].y - sorted[index - 1].y
          );
          assert(
            gap >= requiredSpacing - 1e-9,
            `${caseName} @ ${scale}x: row ${row} spacing ${gap.toFixed(2)} is below the ${requiredSpacing.toFixed(2)} minimum`
          );
        }
      }
    }

    // No node leaves its own depth band's allowance.
    for (const node of band) {
      assert(
        node.radius <= radiusForDepth(1, centre) + 1e-9,
        `${caseName} @ ${scale}x: a depth-1 node rose above its band and into the label lane`
      );
      assert(
        node.radius - node.size > radiusForDepth(2, centre) + MAX_NODE_RADIUS,
        `${caseName} @ ${scale}x: a depth-1 node crossed into the depth-2 allowance`
      );
    }
  }

  // Nothing is ever dropped, at any count. Crowding is the degradation, not hiding.
  {
    const ring = layoutProjectRing(realEight, centre, PROJECT_RING_RADIUS, MIN_WINDOW_SCALE);
    const laid = layoutProjectOwnedGraph(denseSingleProjectGraph(count), ring, centre);
    assert(
      laid.nodes.length === count,
      `${caseName}: ${count - laid.nodes.length} note(s) vanished instead of crowding`
    );
  }

  // Determinism: reversed and repeated inputs must produce identical rows.
  const ring = layoutProjectRing(realEight, centre, PROJECT_RING_RADIUS, MIN_WINDOW_SCALE);
  const forward = denseSingleProjectGraph(count);
  const reversed: VaultGraphPayload = {
    ...forward,
    nodes: forward.nodes.slice().reverse(),
    edges: forward.edges.slice().reverse()
  };
  const rowsOf = (graph: VaultGraphPayload) =>
    JSON.stringify(
      layoutProjectOwnedGraph(graph, ring, centre)
        .nodes.map((node) => [node.id, node.subRow, node.subRowCount, node.radius])
        .sort()
    );
  assert(
    rowsOf(forward) === rowsOf(forward),
    `${caseName}: repeated layout of the same input changed the rows`
  );
  assert(
    rowsOf(forward) === rowsOf(reversed),
    `${caseName}: reversing the input array changed the row assignment`
  );
}

/** Every readout line stays inside the disc, at every scale, or is dropped. */
function assertCentreReadoutIsContained() {
  const centre = 220;
  const lines = [
    "FIDELITY AGENTIC AI DEVELOPMENT · UNCLASSIFIED",
    "TASKS UNAVAILABLE",
    "feature/some-long-branch · abc1234 A commit subject"
  ];
  for (const scale of SCALES) {
    const laid = layoutCentreReadout(lines, centre, scale);
    const fontSize = 9 / scale;
    for (const line of laid) {
      const offset = line.y - centre;
      // The line's TOP must clear the glyph's ink, not its centre. Cinzel's
      // omega has zero descent, so its ink stops exactly on the baseline and a
      // centre-based check let the first line sit on the glyph's feet.
      const top = offset - (9 / scale) * 0.6;
      assert(
        top > GLYPH_BASELINE_OFFSET,
        `scale ${scale}: readout line "${line.text}" has its top at ${top.toFixed(2)}, on or above the glyph baseline at ${GLYPH_BASELINE_OFFSET}`
      );
      const halfWidth = (line.text.length * fontSize * 0.62) / 2;
      const bottom = offset + fontSize * 0.6;
      const reach = Math.hypot(halfWidth, bottom);
      assert(
        reach <= GLYPH_CLEARANCE_RADIUS + 1e-9,
        `scale ${scale}: readout line "${line.text}" reaches ${reach.toFixed(2)}, outside the ${GLYPH_CLEARANCE_RADIUS} clearance disc`
      );
      assert(
        line.text.length <= line.maxCharacters,
        `scale ${scale}: readout line was not truncated to its own budget`
      );
    }
    assert(laid.length >= 1, `scale ${scale}: the readout vanished entirely`);
  }
}

export function runProjectRingHarness() {
  const centre = 220;
  // Fixtures first. Every assertion below runs against these, and a malformed
  // one produces an empty layout rather than an error — so validate the input
  // before trusting anything measured from it.
  assertFixtureIsWellFormed(realEight, "realEight");
  // The reference ring is built at the smallest scale the real window can reach,
  // not at 1:1. Label geometry now depends on the render scale, so 1:1 is both
  // unreachable and the tightest case — using it as the reference would pin the
  // layout to a configuration no operator will ever see. Multi-scale loops below
  // cover the range explicitly, including below this floor.
  const REFERENCE_SCALE = 1.35;
  const ring = layoutProjectRing(realEight, centre, PROJECT_RING_RADIUS, REFERENCE_SCALE);
  assert(ring.segments.length === 8, "N=8: expected one segment per project");
  assertNoLabelCollisions(ring.labels, "N=8");
  assert(
    ring.labels.every((label) => label.radius < PROJECT_RING_RADIUS),
    "N=8: a label escaped into the day-arc lane"
  );
  assertHopDepthIsEncoded(20);
  assertLabelLaneHolds();
  assertCentreReadoutIsContained();
  // 14 is the real vault's Olympus band — the case that rendered as a stroke, and
  // the top of what two sub-rows can space in a 42-degree wedge.
  assertSubRowsAreLegible(14, "dense band N=14", true);
  assertSubRowsAreLegible(6, "sparse band N=6", true);
  // 15 is the first count past the ceiling, and the one the operator will hit
  // next. It was previously unasserted: 14 and 28 bracketed it, so the boundary
  // itself — the step from "meets the minimum" to "under it but still discrete"
  // — was covered only by inference. **[V]** Verified by sweep before adding:
  // every count from 14 to 40 positions its whole band at two rows.
  assertSubRowsAreLegible(15, "first over-capacity band N=15", false);
  assertSubRowsAreLegible(28, "over-capacity band N=28", false);

  // The spacing minimum and the row cap are independent, and this pins the seam.
  // The real 14-note band must satisfy whatever `MIN_NODE_SPACING_DIAMETERS` says,
  // so raising it fails here rather than silently under-spacing the live vault —
  // the cap would absorb the change and the picture would not move.
  {
    const ring = layoutProjectRing(realEight, centre, PROJECT_RING_RADIUS, MIN_WINDOW_SCALE);
    const band = layoutProjectOwnedGraph(denseSingleProjectGraph(14), ring, centre).nodes;
    const rows = new Map<number, typeof band>();
    for (const node of band) {
      if (!rows.has(node.subRow)) rows.set(node.subRow, []);
      rows.get(node.subRow)!.push(node);
    }
    let worst = Number.POSITIVE_INFINITY;
    for (const members of rows.values()) {
      const sorted = members.slice().sort((left, right) => left.angle - right.angle);
      for (let index = 1; index < sorted.length; index += 1) {
        worst = Math.min(
          worst,
          Math.hypot(
            sorted[index].x - sorted[index - 1].x,
            sorted[index].y - sorted[index - 1].y
          )
        );
      }
    }
    assert(
      worst >= MIN_NODE_SPACING_DIAMETERS * 2 * MAX_NODE_RADIUS,
      `the live 14-note band spaces at ${worst.toFixed(2)} but the declared minimum is ${(MIN_NODE_SPACING_DIAMETERS * 2 * MAX_NODE_RADIUS).toFixed(2)} — the row cap cannot absorb a higher minimum, so either lower it or accept the band is below it`
    );
  }

  // Labels are laid out at the size they are drawn at, so collisions must be
  // checked at each scale rather than only at the 1:1 reference.
  for (const scale of SCALES) {
    assertNoLabelCollisions(
      layoutProjectRing(realEight, centre, PROJECT_RING_RADIUS, scale).labels,
      `N=8 @ ${scale}x`
    );
  }
  const widths = new Set(ring.segments.map((segment) => segment.drawnWidth.toFixed(8)));
  assert(widths.size === 1, "N=8: segment widths are not equal");

  const changedStatus = realEight.map((item) =>
    item.id === "olympus" ? { ...item, status: "scaffold" as const } : item
  );
  const statusRing = layoutProjectRing(
    changedStatus.reverse(),
    centre,
    PROJECT_RING_RADIUS,
    REFERENCE_SCALE
  );
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
  assertFixtureIsWellFormed(twenty, "N=20 portfolio");
  // Checked at every scale the window can actually reach, not only at the 1:1
  // reference. The counter-scaled font shrinks in viewBox units as the dial grows,
  // so a dense ring is *easier* at large scales — the binding case is the small
  // end, and 1:1 sits below `tauri.conf.json`'s floor of about 1.35x.
  const dense = layoutProjectRing(twenty, centre, PROJECT_RING_RADIUS, MIN_WINDOW_SCALE);
  for (const scale of SCALES.filter((value) => value >= MIN_WINDOW_SCALE)) {
    const scaled = layoutProjectRing(twenty, centre, PROJECT_RING_RADIUS, scale);
    assertNoLabelCollisions(scaled.labels, `N=20 @ ${scale}x`);
    const visible = scaled.labels.filter((label) => label.visible);
    assert(
      visible.length === 5,
      `N=20 @ ${scale}x: only active and watching labels should persist, got ${visible.length}`
    );
    const texts = visible.map((label) => label.text);
    assert(
      new Set(texts).size === texts.length,
      `N=20 @ ${scale}x: persistent labels are non-colliding but indistinguishable`
    );
  }
  // Below the reachable floor the single lane runs out of arc and drops labels
  // rather than overlapping them. Degradation, pinned so it cannot get worse.
  const belowFloor = layoutProjectRing(twenty, centre, PROJECT_RING_RADIUS, 1.0);
  assertNoLabelCollisions(belowFloor.labels, "N=20 @ 1.0x");
  assert(
    belowFloor.labels.filter((label) => label.visible).length >= 4,
    "N=20 @ 1.0x: dense labels degraded further than dropping one"
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
    constellation.nodes.every(
      (node) => node.radius === radiusForDepth(node.depth, centre)
    ),
    "project graph did not use the declared radial hop bands"
  );
  assert(
    constellation.emptyWedgeMarks.length === 7 &&
      !constellation.emptyWedgeMarks.some((mark) => mark.projectId === "olympus"),
    "the seven unpopulated wedges did not each get exactly one mark"
  );
  assert(
    constellation.emptyWedgeMarks.every(
      (mark) => mark.radius === radiusForDepth(1, centre)
    ),
    "an empty-wedge mark left the hop-1 radius"
  );
  assert(
    constellation.emptyWedgeMarks.every((mark) => {
      const segment = ring.segments.find(
        (candidate) => candidate.project.id === mark.projectId
      );
      return segment !== undefined && mark.angle === segment.midAngle;
    }),
    "an empty-wedge mark drifted off its own wedge's bearing"
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

  // Target state: every wedge populated, 3-6 notes each, chains reaching depth 3.
  // Today's one-populated-wedge case cannot show whether labels and clusters
  // collide, which is the condition the label move has to survive.
  const targetNodes: VaultGraphPayload["nodes"] = [];
  const targetEdges: VaultGraphPayload["edges"] = [];
  realEight.forEach((item, index) => {
    targetNodes.push({
      id: item.notePath!,
      title: item.name,
      folder: "01 - Projects",
      hop: 0,
      isProject: true,
      degree: 4
    });
    const children = 3 + (index % 4);
    for (let child = 0; child < children; child += 1) {
      const id = `02 - Research/${item.id}-note-${child}.md`;
      targetNodes.push({
        id,
        title: `${item.name} note ${child}`,
        folder: "02 - Research",
        hop: 1,
        isProject: false,
        degree: 2
      });
      targetEdges.push({ from: item.notePath!, to: id });
      if (child > 0) continue;
      let parent = id;
      for (let depth = 2; depth <= 3; depth += 1) {
        const deeper = `02 - Research/${item.id}-depth-${depth}.md`;
        targetNodes.push({
          id: deeper,
          title: `${item.name} depth ${depth}`,
          folder: "02 - Research",
          hop: depth,
          isProject: false,
          degree: 2
        });
        targetEdges.push({ from: parent, to: deeper });
        parent = deeper;
      }
    }
  });
  const targetGraph = payload(targetNodes, targetEdges);
  for (const scale of SCALES) {
    const scaledRing = layoutProjectRing(
      realEight,
      centre,
      PROJECT_RING_RADIUS,
      scale
    );
    const target = layoutProjectOwnedGraph(targetGraph, scaledRing, centre);
    assert(
      target.emptyWedgeMarks.length === 0,
      `target state @ ${scale}x: a populated wedge kept its empty mark`
    );
    assert(
      new Set(target.nodes.map((node) => node.projectId)).size === 8,
      `target state @ ${scale}x: a project lost its cluster`
    );
    assert(
      target.nodes.some((node) => node.depth === HOP_CLAMP_DEPTH),
      `target state @ ${scale}x: the innermost band never drew`
    );
    assertNodesInsideParentWedges(target.nodes, `target state @ ${scale}x`);
    // Label-vs-cluster clearance is asserted only at scales the operator can
    // reach. Below the window floor the counter-scaled label box is at its
    // largest in viewBox units and does crowd hop-1 notes in a fully populated
    // ring; that is a known limit of the browser dev server, not a defended
    // property, and it is recorded here so it is not rediscovered as a bug.
    if (scale >= MIN_WINDOW_SCALE) {
      assertLabelsClearOfNodes(scaledRing.labels, target.nodes, `target state @ ${scale}x`);
    }
    // Notes stay inside the territory their own project owns.
    for (const node of target.nodes) {
      const segment = scaledRing.segments.find(
        (candidate) => candidate.project.id === node.projectId
      )!;
      assert(
        node.angle >= segment.startAngle - 1e-9 &&
          node.angle <= segment.endAngle + 1e-9,
        `target state @ ${scale}x: ${node.id} escaped its project's wedge`
      );
    }
  }

  const targetClearanceAt = (scale: number) => {
    const scaledRing = layoutProjectRing(realEight, centre, PROJECT_RING_RADIUS, scale);
    const target = layoutProjectOwnedGraph(targetGraph, scaledRing, centre);
    let worst = Infinity;
    for (const label of scaledRing.labels.filter((item) => item.visible)) {
      const left = label.x - label.width / 2;
      const right = label.x + label.width / 2;
      const top = label.y - label.height / 2;
      const bottom = label.y + label.height / 2;
      for (const node of target.nodes) {
        const nearestX = Math.max(left, Math.min(node.x, right));
        const nearestY = Math.max(top, Math.min(node.y, bottom));
        worst = Math.min(
          worst,
          Math.hypot(node.x - nearestX, node.y - nearestY) - node.size
        );
      }
    }
    return Number(worst.toFixed(2));
  };

  // Stress case: one wedge holding 28 depth-1 notes. Beyond what any stagger can
  // space, so the assertion here is containment — sub-rowing must not push nodes
  // into the label lane even when it cannot fully solve the crowding.
  const stressClearance = (() => {
    let worst = Infinity;
    for (const scale of SCALES.filter((value) => value >= MIN_WINDOW_SCALE)) {
      const scaledRing = layoutProjectRing(realEight, centre, PROJECT_RING_RADIUS, scale);
      const stress = layoutProjectOwnedGraph(denseSingleProjectGraph(28), scaledRing, centre);
      assertLabelsClearOfNodes(scaledRing.labels, stress.nodes, `stress N=28 @ ${scale}x`);
      for (const node of stress.nodes) {
        assert(
          node.radius <= radiusForDepth(1, centre) + 1e-9,
          `stress N=28 @ ${scale}x: a node rose above the depth-1 band`
        );
      }
      for (const label of scaledRing.labels.filter((item) => item.visible)) {
        for (const node of stress.nodes) {
          const nearestX = Math.max(
            label.x - label.width / 2,
            Math.min(node.x, label.x + label.width / 2)
          );
          const nearestY = Math.max(
            label.y - label.height / 2,
            Math.min(node.y, label.y + label.height / 2)
          );
          worst = Math.min(
            worst,
            Math.hypot(node.x - nearestX, node.y - nearestY) - node.size
          );
        }
      }
    }
    return Number(worst.toFixed(2));
  })();

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
    hopRadii: {
      depth1: radiusForDepth(1, DIAL_RADIUS),
      depth2: radiusForDepth(2, DIAL_RADIUS),
      depth3: radiusForDepth(3, DIAL_RADIUS),
      depth4AndBeyond: radiusForDepth(HOP_CLAMP_DEPTH, DIAL_RADIUS),
      step: radiusForDepth(1, DIAL_RADIUS) - radiusForDepth(2, DIAL_RADIUS),
      clampDepth: HOP_CLAMP_DEPTH
    },
    labelGapPx: (PROJECT_RING_RADIUS - WIDEST_SEGMENT_STROKE / 2 - labelRadius(10, 1.71)) * 1.71,
    labelRadiusByScale: SCALES.map((scale) => ({
      scale,
      radius: Number(labelRadius(10, scale).toFixed(2))
    })),
    emptyWedgeMarks: constellation.emptyWedgeMarks.length,
    minWindowScale: MIN_WINDOW_SCALE,
    subRows: {
      minSpacingDiameters: MIN_NODE_SPACING_DIAMETERS,
      requiredSpacingUnits: Number((MIN_NODE_SPACING_DIAMETERS * 2 * MAX_NODE_RADIUS).toFixed(2)),
      maxRows: MAX_SUB_ROWS,
      offsetUnits: Number(subRowOffset(2, DIAL_RADIUS).toFixed(2)),
      offsetAsFractionOfDepthStep: Number(
        (
          subRowOffset(2, DIAL_RADIUS) /
          (radiusForDepth(1, DIAL_RADIUS) - radiusForDepth(2, DIAL_RADIUS))
        ).toFixed(3)
      ),
      rowsForRealOlympusBand: (() => {
        const ring14 = layoutProjectRing(realEight, centre, PROJECT_RING_RADIUS, MIN_WINDOW_SCALE);
        return layoutProjectOwnedGraph(denseSingleProjectGraph(14), ring14, centre).nodes[0]
          .subRowCount;
      })()
    },
    stressN28WorstLabelClearance: stressClearance,
    targetStateLabelNodeClearance: SCALES.map((scale) => ({
      scale,
      clearance: targetClearanceAt(scale),
      reachable: scale >= MIN_WINDOW_SCALE
    })),
    centreReadoutBudgets: SCALES.map((scale) => ({
      scale,
      lines: layoutCentreReadout(
        ["A · B", "C", "D"],
        220,
        scale
      ).map((line) => line.maxCharacters)
    }))
  };
}
