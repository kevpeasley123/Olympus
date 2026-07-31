import type { TrackedProject } from "../types";
import type {
  VaultGraphNode,
  VaultGraphPayload
} from "./vaultGraph";

/**
 * The viewBox half-extent, and therefore the dial radius: the viewBox is square
 * and centred, so `centre` and the dial radius are the same number.
 *
 * Every radius below is declared as a fraction of this and multiplied back up,
 * so the relationship survives someone changing the viewBox. Note that viewBox
 * units already scale with the dial — `b5993a4` did not leave these behind. The
 * fractions are for legibility and against a future `SIZE` change, not a fix for
 * a scale bug.
 */
export const DIAL_RADIUS = 220;

/** The existing project-ring radius. The omega and day arc do not move. */
export const PROJECT_RING_RADIUS = 168;

/**
 * The widest tier stroke in `styles.css` (`--active`, 11). Strokes are in user
 * units, so they scale with the dial. The label lane is measured from the widest
 * one, which makes a single formula correct for every tier instead of leaving
 * active projects' labels sitting under their own thicker stroke.
 */
export const WIDEST_SEGMENT_STROKE = 11;

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

const LABEL_FONT_SIZE = 10;
const ACTIVE_LABEL_FONT_SIZE = 11.5;
const MAX_LABEL_CHARACTERS = 14;
const MIN_LABEL_CHARACTERS = 7;

/**
 * Constant on-screen pixels between the stroke's inner edge and the label's cap
 * height.
 *
 * **Pixels, deliberately, not units.** The font size is counter-scaled to a
 * constant on-screen size, so a unit-based inset makes the gap grow with the dial
 * while the text does not: measured from the stroke's inner edge to the glyph
 * top, the old fixed radius of 158 drifted from ~9.6px at 1.35x to ~16.2px at
 * 2.81x, which is what made labels read as floating rather than belonging to a
 * segment. Dividing by the render scale holds it constant instead.
 */
const LABEL_STROKE_GAP_PX = 5;

/** Cap height over font size. JetBrains Mono at the configured tracking. */
const LABEL_CAP_RATIO = 0.7;

/** Clear space between the label's box and a hop-1 note's outer edge. */
const LABEL_HOP_MARGIN = 2;

/**
 * There is exactly one label lane.
 *
 * The previous design had two, and fell back to the inner one on a collision. A
 * second lane is itself a form of floating — a label 13px further in no longer
 * reads as attached to anything — and it pushed the worst-case label extent deep
 * enough to pin hop 1 outward. Collisions are resolved by shortening the text and
 * then, above twelve projects, by hiding non-persistent labels.
 */
export function labelRadius(
  fontSize: number,
  renderScale: number,
  ringRadius = PROJECT_RING_RADIUS,
  dialRadius = DIAL_RADIUS
): number {
  const scale = Math.max(renderScale, 0.01);
  const innerEdge = ringRadius - WIDEST_SEGMENT_STROKE / 2;
  const tight = innerEdge - (LABEL_STROKE_GAP_PX + fontSize * LABEL_CAP_RATIO) / scale;

  // Containment floor. Below roughly 1.2x, holding a constant pixel gap would
  // push the counter-scaled box into the hop-1 band, so the label stops moving
  // inward instead. What degrades below that scale is the gap's exactness, never
  // the clearance — and the real window cannot go there anyway
  // (`tauri.conf.json` floors the render scale at about 1.35).
  const floor =
    radiusForDepth(1, dialRadius) +
    MAX_NODE_RADIUS +
    LABEL_HOP_MARGIN +
    (fontSize * 0.6) / scale;
  return Math.max(tight, floor);
}

/** How far the label's own box reaches inward. Bounds hop 1. */
export function labelInnerExtent(
  fontSize: number,
  renderScale: number,
  ringRadius = PROJECT_RING_RADIUS,
  dialRadius = DIAL_RADIUS
): number {
  const scale = Math.max(renderScale, 0.01);
  return (
    labelRadius(fontSize, renderScale, ringRadius, dialRadius) -
    (fontSize * 0.6) / scale
  );
}

/**
 * The scale at and above which the label gap is exactly constant in pixels.
 *
 * Derived, not chosen: below about 0.7x the containment floor takes over from the
 * constant-pixel inset for the 11.5px active label. Rounded up. The real window
 * floors at about 1.35x, so the gap is exactly constant everywhere it can be seen.
 */
export const LABEL_GAP_EXACT_ABOVE_SCALE = 0.75;

export const GLYPH_CLEARANCE_RADIUS = 82;

/**
 * Project-owned note bands, outside in, as fractions of the dial radius.
 *
 * **Hop 1 cannot move outward, and the reason is not the label's radius — it is
 * the label's footprint.** Label boxes are axis-aligned, and a project with a
 * single linked note puts that note on the wedge's own bearing, directly beneath
 * its own label. Separation then depends on the box's half-width and half-height,
 * not on radial distance: measured at the reference scale, the largest hop 1 that
 * keeps a single-child wedge clear is about 129. The previous 128 was already at
 * that limit, which is why it was 128. Moving labels tight to the stroke buys a
 * unit, not fourteen.
 *
 * So the span for note bands is fixed at roughly 128 down to 87, and the choice is
 * how many bands to cut it into:
 *
 * - three bands: 20.5 units apart, collapsing at depth 3
 * - four bands: 13.7 units apart, collapsing at depth 4
 *
 * **Three is chosen.** The vault's deepest chain is depth 2 across 43 real nodes,
 * so a fourth band encodes a depth that does not occur at the cost of compressing
 * the two that do — and 13.7 units is thinner than the 12-unit step that made
 * depth unreadable in the first place. Moving to four is a one-line change to
 * `HOP_CLAMP_DEPTH` if the vault starts growing chains.
 */
export const HOP_1_FRACTION = 0.582;
export const HOP_STEP_FRACTION = (HOP_1_FRACTION - 82 / DIAL_RADIUS - 0.0225) / 2;

/**
 * Depths at or beyond this share the innermost band.
 *
 * **A test pins this number.** The previous `deep` band silently collapsed depths
 * 3, 4 and 5 onto one radius and nothing asserted the bands were distinct, so the
 * collapse was invisible. The clamp is now declared, asserted, and the depth one
 * step outside it is asserted to be genuinely outside it.
 */
export const HOP_CLAMP_DEPTH = 3;

/** Radius for a note at `depth`, clamped. Depth 0 is the project anchor. */
export function radiusForDepth(depth: number, dialRadius = DIAL_RADIUS): number {
  const band = Math.min(Math.max(depth, 1), HOP_CLAMP_DEPTH) - 1;
  return (HOP_1_FRACTION - band * HOP_STEP_FRACTION) * dialRadius;
}

/**
 * Minimum centre-to-centre spacing between same-row neighbours, in node diameters.
 *
 * **The problem this solves is angular density, not radial spacing.** Olympus's 14
 * depth-1 notes sit about 6.7 units apart in a 42° wedge while a node can be 7.58
 * units across — so they touch, and the band renders as a continuous stroke of dots.
 * A solid arc above a sparse scatter cannot read as parent-and-child at *any*
 * radial separation, which is why widening the hop step did not fix it.
 *
 * **Derived on its own terms, then confirmed by looking.** Three reference points:
 *
 * - **1.0** — centre-to-centre equal to a diameter. Nodes touch exactly. Below this
 *   they overlap. This is where the band was, at 0.88.
 * - **1.5** — half a diameter of clear gap, the point at which a row of dots stops
 *   reading as a dashed line and starts reading as discrete marks.
 * - **1.75** — three quarters of a diameter, comfortably countable.
 *
 * **[V] 1.65 was confirmed in the running app**: the operator judged the real
 * 14-note band, at 12.65 units and about 20px, as reading in countable nodes.
 *
 * **This constant does not encode the row cap, and raising it would not change the
 * picture.** At 1.75 the 14-note band would ask for three rows, be refused by
 * `MAX_SUB_ROWS`, and render at 12.65 units exactly as it does now — the only
 * difference would be that the harness stopped calling that sufficient. The cap is
 * geometric and the minimum is perceptual; they are independent, and a test pins
 * the real band against whatever this value is so that raising it fails loudly.
 */
export const MIN_NODE_SPACING_DIAMETERS = 1.65;

/**
 * How much of a depth step the sub-rows may spread across.
 *
 * Sub-rows are the *same hop* and must not imply otherwise, so the stagger has to
 * read as band thickness. At 0.35 of a step the offset is 7.19 units against a
 * 20.5-unit hop — a third of a hop, comfortably below the half-step ceiling.
 */
export const SUBROW_SPAN_FRACTION = 0.35;

/**
 * **Two is the maximum, and it is derived rather than chosen.**
 *
 * Sub-rows separate angular neighbours by staggering them radially, so the offset
 * has to keep a *cross-row* neighbour clear too: `hypot(gap, offset) >= diameter`.
 * The span is fixed at 0.35 of a step, so the offset *shrinks* as rows are added —
 * 7.19 units at two rows, 3.59 at three.
 *
 * Worked through in a 42° wedge at the depth-1 radius, where the arc is 94 units:
 * at three rows and 21 notes the angular gap is 4.2 units and the offset 3.59, so
 * cross-row neighbours sit `hypot(4.2, 3.59) = 5.5` apart against a 7.58-unit
 * diameter — they overlap. Making three rows work needs an offset of about 6.3,
 * which is a span of 12.6 units, or 0.61 of a hop. **Past half a hop the stagger
 * reads as depth, which is the one thing it must not do.** So three rows are not
 * available, and two is the ceiling.
 *
 * **[V] Measured capacity in a 42° wedge, and the degradation past it:**
 *
 * | notes | spacing | reads as |
 * |---|---|---|
 * | 14 | 12.65 | meets the minimum — today's Olympus band, exactly at the ceiling |
 * | 15 | 11.81 | below the minimum, still clearly separated |
 * | 21 | 8.44 | separated but tight |
 * | 24+ | < 7.58 | **touching again — the stroke returns** |
 *
 * So the threshold for reaching after cap-and-overflow is **24, not 15**: between
 * 15 and 23 the band is under the comfortable minimum but the dots are still
 * discrete. **[V] Nothing is ever dropped** — every reachable note is positioned at
 * every count tested, so the band degrades by visible crowding, never by silently
 * hiding a node. Capacity scales with arc, so a wider wedge holds more.
 */
export const MAX_SUB_ROWS = 2;

/** Total radial spread of a band's sub-rows. Independent of the row count. */
export function subRowSpan(dialRadius = DIAL_RADIUS): number {
  return SUBROW_SPAN_FRACTION * HOP_STEP_FRACTION * dialRadius;
}

/**
 * How many sub-rows a band needs, from its measured minimum angular gap.
 *
 * Triggered on measured spacing rather than node count, so one rule covers every
 * wedge width and every band radius with no second code path. Two details that were
 * wrong on the first attempt and are worth keeping straight:
 *
 * - **The gap is evaluated at the innermost row, not at the band radius.** Rows step
 *   inward, and the same angle spans less arc there — measured at the band radius the
 *   trigger under-counts and the inner row ends up below its own minimum.
 * - **The diameter used is the maximum a node can draw**, not the degrees actually
 *   present, so a note gaining a link cannot silently re-row the band.
 */
export function subRowCountFor(
  minimumGapArc: number,
  bandRadius: number,
  dialRadius = DIAL_RADIUS
): number {
  const required = MIN_NODE_SPACING_DIAMETERS * 2 * MAX_NODE_RADIUS;
  if (minimumGapArc <= 0 || bandRadius <= 0) return MAX_SUB_ROWS;
  const innermost = Math.max(bandRadius - subRowSpan(dialRadius), 1);
  const gapAtInnermost = minimumGapArc * (innermost / bandRadius);
  return Math.min(
    MAX_SUB_ROWS,
    Math.max(1, Math.ceil(required / gapAtInnermost))
  );
}

/** Radial offset between adjacent sub-rows. Zero when a band needs only one. */
export function subRowOffset(rows: number, dialRadius = DIAL_RADIUS): number {
  if (rows < 2) return 0;
  return subRowSpan(dialRadius) / (rows - 1);
}

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
  /** The logical hop. Sub-rowing never changes it — one band is one depth. */
  depth: number;
  x: number;
  y: number;
  angle: number;
  radius: number;
  size: number;
  wedgeStart: number;
  wedgeEnd: number;
  /** Which staggered row inside the depth band, outermost first. */
  subRow: number;
  /** How many rows the band was split into. 1 means no stagger. */
  subRowCount: number;
}

export interface ProjectGraphEdge {
  key: string;
  from: Point;
  to: Point;
  /**
   * The child's depth. Carried on the edge itself rather than left to be
   * recovered from the endpoints.
   *
   * **[V] This field exists because its absence produced a wrong answer.** The
   * renderer only ever reads `from.x/y` and `to.x/y`, so an analysis attributing
   * depth through the target's id got `undefined` and silently bucketed every
   * edge as depth 1 — reporting "100% of the ink is depth-1" when the real figure
   * was 84.8%. The number was clean, plausible, and ran toward the conclusion
   * being argued for. Making depth readable from the edge removes the need to
   * re-derive it, which is where the error lived.
   */
  depth: number;
}

/**
 * One drawable segment of a cross-project edge, after clipping around the glyph
 * disc.
 *
 * Its own type rather than a reused `ProjectGraphEdge`: a clipped segment is not
 * a parentage edge and has no depth, so sharing the shape would have forced a
 * meaningless field onto it. The two were interchangeable only while both
 * happened to be a key and two points.
 */
export interface CrossProjectEdgePiece {
  key: string;
  from: Point;
  to: Point;
}

export interface CrossProjectEdge {
  key: string;
  fromProjectId: string;
  toProjectId: string;
  pieces: CrossProjectEdgePiece[];
}

/**
 * One mark per project that owns no notes.
 *
 * A wedge with nothing in it is currently indistinguishable from a wedge nobody
 * has looked at, which is the same class of finding as the orphan rim: absence
 * that has to be inferred from a gap rather than read. A hollow dot at the hop-1
 * radius says it in the vocabulary already established — filled means a note,
 * hollow means territory that exists and is empty.
 *
 * Deliberately not a radial tick: the day arc already owns radial marks, where
 * they mean "work happened at this time". Borrowing that for "nothing is linked"
 * would be a category error.
 */
export interface EmptyWedgeMark {
  projectId: string;
  x: number;
  y: number;
  angle: number;
  radius: number;
  /** Matches the smallest real note, so the two read as the same kind of thing. */
  size: number;
}

export interface ProjectOwnedGraphLayout {
  nodes: ProjectGraphNode[];
  treeEdges: ProjectGraphEdge[];
  crossProjectEdges: CrossProjectEdge[];
  emptyWedgeMarks: EmptyWedgeMark[];
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
  centre: number,
  ringRadius: number,
  renderScale: number
): ProjectRingLabel[] {
  const count = segments.length;
  const labels = new Map<string, ProjectRingLabel>();
  const placed: Array<ReturnType<typeof labelBounds>> = [];
  const ordered = segments.slice().sort((left, right) => {
    const priority = labelPriority(left.project) - labelPriority(right.project);
    return priority || compareCodePoints(left.project.id, right.project.id);
  });

  for (const segment of ordered) {
    const fontSize =
      segment.project.status === "active" ? ACTIVE_LABEL_FONT_SIZE : LABEL_FONT_SIZE;
    // Bounds are measured at the size the label will actually be drawn at.
    // Previously this used the unscaled font size and never saw renderScale, so
    // the collision test was merely conservative above 1x and wrong below it.
    const drawnFontSize = fontSize / Math.max(renderScale, 0.01);
    const radius = labelRadius(fontSize, renderScale, ringRadius);
    const anchor = pointOnProjectRing(segment.midAngle, radius, centre);

    const hidden = (text: string, persistent: boolean): ProjectRingLabel => ({
      projectId: segment.project.id,
      text,
      fullText: segment.project.name,
      x: anchor.x,
      y: anchor.y,
      radius,
      fontSize,
      width: 0,
      height: 0,
      visible: false,
      persistent
    });

    if (!projectLabelIsPersistent(segment.project, count)) {
      labels.set(
        segment.project.id,
        hidden(shortenAtWordBoundary(segment.project.name, MAX_LABEL_CHARACTERS), false)
      );
      continue;
    }

    let placement: ProjectRingLabel | null = null;
    for (let maximum = MAX_LABEL_CHARACTERS; maximum >= MIN_LABEL_CHARACTERS; maximum -= 2) {
      const text = shortenAtWordBoundary(segment.project.name, maximum);
      const bounds = labelBounds(text, drawnFontSize, anchor);
      if (collides(bounds, placed)) continue;
      placement = {
        projectId: segment.project.id,
        text,
        fullText: segment.project.name,
        x: anchor.x,
        y: anchor.y,
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

    labels.set(
      segment.project.id,
      placement ??
        hidden(shortenAtWordBoundary(segment.project.name, MIN_LABEL_CHARACTERS), true)
    );
  }

  return segments.map((segment) => labels.get(segment.project.id)!);
}

export function layoutProjectRing(
  projects: TrackedProject[],
  centre: number,
  radius = PROJECT_RING_RADIUS,
  renderScale = 1
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
    labels: placeLabels(segments, centre, radius, renderScale),
    sectorWidth,
    gapAngle,
    semanticZoomRecommended:
      segments[0].drawnArcLength < SEMANTIC_ZOOM_ARC_LENGTH_THRESHOLD
  };
}

/** The smallest and largest a note can draw. Bounds every clearance check. */
export const MIN_NODE_RADIUS = 2.25;
export const MAX_NODE_RADIUS = MIN_NODE_RADIUS + 7 * 0.22;

function nodeRadius(node: VaultGraphNode): number {
  return MIN_NODE_RADIUS + Math.min(node.degree, 7) * 0.22;
}

/**
 * Splits crowded depth bands into staggered sub-rows, in place.
 *
 * Each `(project, depth)` band is handled independently on its own measured
 * spacing. Row assignment is `index % rows` over an angle-then-code-point ordering,
 * so the same vault produces the same picture and a reversed input array produces
 * the same rows.
 *
 * Rows step *inward* so the band's outer edge stays at its nominal radius — that is
 * what protects the label clearance measured above hop 1. The innermost band is the
 * exception and steps outward, because the glyph clearance disc bounds it from
 * below and stepping inward would put notes on top of the Ω.
 */
function applySubRows(nodes: ProjectGraphNode[], dialRadius: number): void {
  const bands = new Map<string, ProjectGraphNode[]>();
  for (const node of nodes) {
    const key = `${node.projectId}|${node.depth}`;
    if (!bands.has(key)) bands.set(key, []);
    bands.get(key)!.push(node);
  }

  for (const band of bands.values()) {
    if (band.length < 2) continue;
    band.sort(
      (left, right) => left.angle - right.angle || compareCodePoints(left.id, right.id)
    );

    const bandRadius = band[0].radius;
    let minimumGap = Number.POSITIVE_INFINITY;
    for (let index = 1; index < band.length; index += 1) {
      const sweep = ((band[index].angle - band[index - 1].angle) * Math.PI) / 180;
      minimumGap = Math.min(minimumGap, sweep * bandRadius);
    }

    const rows = subRowCountFor(minimumGap, bandRadius, dialRadius);
    if (rows < 2) continue;

    const offset = subRowOffset(rows, dialRadius);
    const outward = band[0].depth >= HOP_CLAMP_DEPTH;
    band.forEach((node, index) => {
      const row = index % rows;
      const radius = outward ? bandRadius + row * offset : bandRadius - row * offset;
      const point = pointOnProjectRing(node.angle, radius, dialRadius);
      node.radius = radius;
      node.x = point.x;
      node.y = point.y;
      node.subRow = row;
      node.subRowCount = rows;
    });
  }
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

  // Angles are final here; radii are not. Sub-rowing adjusts radius afterwards,
  // so tree edges are built once positions are settled rather than during descent.
  function spread(
    id: string,
    projectId: string,
    wedgeStart: number,
    wedgeEnd: number
  ) {
    const node = nodesById.get(id);
    const parentId = parent.get(id);
    const nodeDepth = depth.get(id);
    if (!node || !parentId || nodeDepth === undefined) return;
    const angle = wedgeStart + (wedgeEnd - wedgeStart) / 2;
    const radius = radiusForDepth(nodeDepth, centre);
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
      wedgeEnd,
      subRow: 0,
      subRowCount: 1
    });

    const kids = children.get(id) ?? [];
    const total = kids.reduce((sum, child) => sum + subtreeSize(child), 0);
    let cursor = wedgeStart;
    for (const child of kids) {
      const width = ((wedgeEnd - wedgeStart) * subtreeSize(child)) / total;
      spread(child, projectId, cursor, cursor + width);
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
      spread(child, projectId, cursor, cursor + width);
      cursor += width;
    }
  }

  applySubRows(positioned, centre);

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

  // Built from settled positions, so a sub-rowed child's edge still terminates on
  // the node rather than where it sat before the stagger.
  //
  // **Every tree edge is drawn, including depth 1 — and `depth` on the edge is
  // what lets the renderer weight them differently.**
  //
  // **[V] Depth-1 edges were removed on 2026-07-30 and restored the same day.**
  // The measurement behind the removal was sound and its conclusion did not
  // follow. 14 depth-1 edges carried 777 units of stroke, 84.8% of all edge ink,
  // stating a relationship position already encodes — a depth-1 node sits in its
  // project's wedge by construction. That is a true statement about *information
  // content*, and it was the wrong question.
  //
  // **Encoding a relationship and making it visible are different properties.**
  // Without the strokes the cluster read as a loose scatter floating near the
  // ring rather than as fourteen notes belonging to Olympus, and the surviving
  // depth-2 edges hung mid-scatter connecting to nothing followable — worse than
  // the spray it was meant to fix. The lines were doing perceptual grouping,
  // which ink-share cannot measure because ink-share measures redundancy.
  //
  // So depth 1 is pushed back rather than removed, and depth 2+ holds its weight
  // as the legible layer. The dial is `--tree-edge-hop1-opacity` in `styles.css`.
  const treeEdges: ProjectGraphEdge[] = [];
  for (const [child, parentId] of parent) {
    const childNode = positionedById.get(child);
    if (!childNode) continue;
    const parentNode = positionedById.get(parentId);
    const from = parentNode
      ? { x: parentNode.x, y: parentNode.y }
      : segmentByProject.get(owner.get(parentId) ?? "")?.root;
    if (!from) continue;
    treeEdges.push({
      key: `${parentId}→${child}`,
      from,
      to: { x: childNode.x, y: childNode.y },
      depth: childNode.depth
    });
  }
  treeEdges.sort((left, right) => compareCodePoints(left.key, right.key));

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

  // A wedge earns its mark by owning nothing. The moment one real node lands in
  // it, the mark is gone — which is also what makes the landing legible.
  const owned = new Set(positioned.map((node) => node.projectId));
  const emptyWedgeMarks: EmptyWedgeMark[] = ring.segments
    .filter((segment) => !owned.has(segment.project.id))
    .map((segment) => {
      const radius = radiusForDepth(1, centre);
      const point = pointOnProjectRing(segment.midAngle, radius, centre);
      return {
        projectId: segment.project.id,
        x: point.x,
        y: point.y,
        angle: segment.midAngle,
        radius,
        size: MIN_NODE_RADIUS
      };
    });

  return {
    nodes: positioned,
    treeEdges,
    crossProjectEdges,
    emptyWedgeMarks,
    droppedLinked: graph.droppedLinked ?? graph.dropped
  };
}

const READOUT_FONT_PX = 9;
/**
 * Clear pixels between the glyph's baseline and the top of the first line.
 *
 * **[V] Cinzel's Ω has zero descent** — canvas metrics report
 * `actualBoundingBoxDescent = 0.00` at 150px — so its ink stops exactly on the
 * baseline at `GLYPH_BASELINE_OFFSET`. The first attempt placed the line's
 * *centre* one gap below the baseline, which put its top 0.5 units *above* the
 * ink and the readout sat on the glyph's feet. The half-line is now part of the
 * offset.
 */
const READOUT_TOP_GAP_PX = 5;
const READOUT_LINE_PX = 10;
/** Matches `CommandInstrument`'s glyph `y = CENTRE + 52`. */
export const GLYPH_BASELINE_OFFSET = 52;

export interface CentreReadoutLine {
  text: string;
  y: number;
  /** How many characters fit inside the clearance disc on this line. */
  maxCharacters: number;
}

/**
 * Lays the hover readout into the interior beneath the omega.
 *
 * The interior around the glyph is the only region guaranteed clear of the
 * segment ring, the labels, the day arc, and every note band — so a fixed
 * position there never reflows and never collides, including at target state with
 * all eight wedges populated.
 *
 * The disc narrows sharply toward the bottom, so each line's budget is computed
 * from the geometry at the given scale rather than assumed. A line that cannot
 * fit inside the disc is dropped rather than allowed to cross it: the containment
 * guarantee outranks showing the whole string.
 */
export function layoutCentreReadout(
  lines: string[],
  centre: number,
  renderScale: number,
  clearance = GLYPH_CLEARANCE_RADIUS
): CentreReadoutLine[] {
  const scale = Math.max(renderScale, 0.01);
  const fontSize = READOUT_FONT_PX / scale;
  const halfHeight = fontSize * 0.6;
  const characterWidth = fontSize * 0.62;
  // The offset is to the line's *top*, so half a line is part of it.
  const first =
    GLYPH_BASELINE_OFFSET + (READOUT_TOP_GAP_PX + READOUT_FONT_PX * 0.6) / scale;

  const out: CentreReadoutLine[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const offset = first + (index * READOUT_LINE_PX) / scale;
    // Measured at the line's lowest point, which is where the disc is tightest.
    const bottom = offset + halfHeight;
    const available = clearance * clearance - bottom * bottom;
    if (available <= 0) continue;
    const maxCharacters = Math.floor((2 * Math.sqrt(available)) / characterWidth);
    if (maxCharacters < MIN_LABEL_CHARACTERS) continue;
    out.push({
      text: truncateToFit(lines[index], maxCharacters),
      y: centre + offset,
      maxCharacters
    });
  }
  return out;
}

function truncateToFit(text: string, maximum: number): string {
  if (text.length <= maximum) return text;
  return `${text.slice(0, Math.max(1, maximum - 1))}…`;
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
