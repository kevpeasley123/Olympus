import { useMemo, useState } from "react";
import type { ActionQueueTask } from "../../hooks/useActionQueue";
import {
  arcPathForSegment,
  layoutCentreReadout,
  layoutProjectOwnedGraph,
  layoutProjectRing,
  pointOnProjectRing
} from "../../services/projectRing";
import type { ProjectGraphNode, ProjectRingSegment } from "../../services/projectRing";
import { attributeTasks } from "../../services/taskAttribution";
import { describeNode } from "../../services/vaultGraph";
import type { VaultGraphPayload } from "../../services/vaultGraph";
import type { TrackedProject } from "../../types";

interface ProjectRingProps {
  centre: number;
  radius: number;
  projects: TrackedProject[];
  graph: VaultGraphPayload;
  tasks: ActionQueueTask[];
  tasksError: string | null;
  renderScale: number;
  onSelectProject: (projectId: string) => void;
  onOpenNote: (notePath: string) => void;
}

const STATUS_LABEL: Record<TrackedProject["status"], string> = {
  active: "active",
  watching: "watching",
  scaffold: "scaffold",
  unclassified: "unclassified",
  archived: "archived"
};

/**
 * The window band, uniform for every tier, in viewBox units. The panel-window
 * direction narrows the old rule: tier is carried by fill, outline and text
 * brightness only — thickness is geometry, and geometry never varies by
 * status. Centred on the ring radius; the outer edge stays inside the pulse's
 * launch radius (182) and the hit arc's outer edge (188), the inner edge stays
 * inside the hit arc's inner edge (148).
 */
const WINDOW_BAND_WIDTH = 23;

/** JetBrains Mono's measured advance, the same ratio the layout module uses. */
const NAME_CHARACTER_RATIO = 0.62;
const NAME_FONT_SIZE = 10;
const ACTIVE_NAME_FONT_SIZE = 11.5;
/** Arc kept clear at each end of a window before its name may begin. */
const NAME_END_PADDING = 6;

/** Annular sector: outer arc, radial end, inner arc back, close. */
function segmentBandPath(
  segment: Pick<ProjectRingSegment, "startAngle" | "endAngle">,
  centre: number,
  outerRadius: number,
  innerRadius: number
): string {
  const outerStart = pointOnProjectRing(segment.startAngle, outerRadius, centre);
  const outerEnd = pointOnProjectRing(segment.endAngle, outerRadius, centre);
  const innerStart = pointOnProjectRing(segment.startAngle, innerRadius, centre);
  const innerEnd = pointOnProjectRing(segment.endAngle, innerRadius, centre);
  const large = segment.endAngle - segment.startAngle > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${large} 0 ${innerStart.x} ${innerStart.y}`,
    "Z"
  ].join(" ");
}

/**
 * The arc a window's name curves along. Angle 0 is twelve o'clock, increasing
 * clockwise, so a segment whose bearing lands in the lower semicircle (90–270)
 * would hang its glyphs upside down; those get the same arc drawn in reverse,
 * which keeps the text upright at the cost of reading against the ring's
 * direction — the mock makes the same trade.
 */
function namePathForSegment(
  segment: Pick<ProjectRingSegment, "startAngle" | "endAngle" | "midAngle">,
  centre: number,
  radius: number
): string {
  const flipped = segment.midAngle > 90 && segment.midAngle < 270;
  const from = pointOnProjectRing(flipped ? segment.endAngle : segment.startAngle, radius, centre);
  const to = pointOnProjectRing(flipped ? segment.startAngle : segment.endAngle, radius, centre);
  const large = segment.endAngle - segment.startAngle > 180 ? 1 : 0;
  return `M ${from.x} ${from.y} A ${radius} ${radius} 0 ${large} ${flipped ? 0 : 1} ${to.x} ${to.y}`;
}

/** Capacity-truncated to the window's usable arc, using the module's ratio. */
function nameForWindow(
  name: string,
  segment: Pick<ProjectRingSegment, "startAngle" | "endAngle">,
  radius: number,
  fontSize: number,
  renderScale: number
): string {
  const usable =
    ((segment.endAngle - segment.startAngle) * Math.PI * radius) / 180 - NAME_END_PADDING * 2;
  const character = (fontSize / Math.max(renderScale, 0.01)) * NAME_CHARACTER_RATIO;
  const capacity = Math.floor(usable / character);
  if (name.length <= capacity) return name;
  return capacity <= 1 ? "…" : `${name.slice(0, capacity - 1).trimEnd()}…`;
}

function projectDetails(
  segment: ProjectRingSegment,
  openTasks: number,
  tasksError: string | null
): string {
  const taskCopy = tasksError
    ? "tasks unavailable"
    : `${openTasks} open ${openTasks === 1 ? "task" : "tasks"}`;
  return `${segment.project.name} · ${STATUS_LABEL[segment.project.status]} · ${segment.project.branch} · ${segment.project.lastCommit} · ${taskCopy}`;
}

/**
 * The readout's content, widest-first.
 *
 * Identity leads because the interior is a fixed position and the eye lands there
 * expecting to learn which project it is on. Provenance goes last because the disc
 * is narrowest at the bottom and a truncated commit subject still reads.
 *
 * `tasksError` yields "TASKS UNAVAILABLE", never a zero — a false zero is a
 * stronger claim than silence.
 */
function readoutLines(
  segment: ProjectRingSegment,
  openTasks: number,
  tasksError: string | null
): string[] {
  const project = segment.project;
  return [
    `${project.name.toUpperCase()} · ${STATUS_LABEL[project.status].toUpperCase()}`,
    tasksError
      ? "TASKS UNAVAILABLE"
      : `${openTasks} OPEN ${openTasks === 1 ? "TASK" : "TASKS"}`,
    `${project.branch} · ${project.lastCommit}`
  ];
}

export function ProjectRing({
  centre,
  radius,
  projects,
  graph,
  tasks,
  tasksError,
  renderScale,
  onSelectProject,
  onOpenNote
}: ProjectRingProps) {
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<ProjectGraphNode | null>(null);
  const ring = useMemo(
    () => layoutProjectRing(projects, centre, radius, renderScale),
    [centre, projects, radius, renderScale]
  );
  const constellation = useMemo(
    () => layoutProjectOwnedGraph(graph, ring, centre),
    [centre, graph, ring]
  );
  const taskMap = useMemo(() => attributeTasks(projects, tasks).perProject, [projects, tasks]);
  const segment = ring.segments.find((candidate) => candidate.project.id === hoveredProject);

  function showProject(projectId: string) {
    setHoveredNode(null);
    setHoveredProject(projectId);
  }

  function hideProject(projectId: string) {
    setHoveredProject((current) => (current === projectId ? null : current));
  }

  const focused = Boolean(hoveredProject || hoveredNode);

  return (
    <g className={`project-ring ${focused ? "is-focused" : ""}`}>
      <defs>
        {/* Sphere shading is gradients, never `filter: blur`. A gradient blob
            composites; a per-node Gaussian would re-raster on every hover-dim
            transition, and the count scales with the vault. This is the same
            constraint that keeps the breath off the glyph's drop-shadow. */}
        <radialGradient id="ring-node-shadow">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.32" />
          <stop offset="60%" stopColor="#000000" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ring-node-spec">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle
        cx={centre}
        cy={centre}
        r={radius}
        fill="none"
        className="project-ring__track"
        pointerEvents="none"
      />

      {/* Weighted by depth, not drawn uniformly. Depth-1 edges are perceptual
          grouping — they say "these fourteen belong to Olympus" — and at full
          weight fourteen of them bury the depth-2 strokes that carry actual
          parentage. Pushed back to a haze; depth 2+ holds the legible layer. */}
      {constellation.treeEdges.map((edge) => (
        <line
          key={edge.key}
          x1={edge.from.x}
          y1={edge.from.y}
          x2={edge.to.x}
          y2={edge.to.y}
          className={`project-ring__tree-edge project-ring__tree-edge--${
            edge.depth <= 1 ? "hop1" : "deep"
          }`}
          pointerEvents="none"
        />
      ))}

      {constellation.crossProjectEdges.flatMap((edge) =>
        edge.pieces.map((piece) => (
          <line
            key={piece.key}
            x1={piece.from.x}
            y1={piece.from.y}
            x2={piece.to.x}
            y2={piece.to.y}
            className="project-ring__cross-edge"
            pointerEvents="none"
          />
        ))
      )}

      {ring.segments.map((candidate) => {
        const details = projectDetails(
          candidate,
          taskMap.get(candidate.project.id)?.length ?? 0,
          tasksError
        );
        const outer = radius + WINDOW_BAND_WIDTH / 2;
        const inner = radius - WINDOW_BAND_WIDTH / 2;
        const nameFontSize =
          candidate.project.status === "active" ? ACTIVE_NAME_FONT_SIZE : NAME_FONT_SIZE;
        return (
          <g key={candidate.project.id}>
            {/* The panel window: an enclosed annular sector — glass fill, full
                outline, a lit face at the outer edge — with the project's name
                curving inside it on a textPath. The label lane this replaces
                is gone; the name is the label now. Tier is carried by fill,
                outline and text brightness only, so the band is one thickness
                for every status. The active glow is stacked strokes, not a
                filter — nothing here may re-raster while the group animates
                opacity on hover. */}
            <g
              className={`project-ring__segment project-ring__segment--${candidate.project.status} ${
                hoveredProject === candidate.project.id ? "is-hovered" : ""
              }`}
              pointerEvents="none"
            >
              <path
                d={segmentBandPath(candidate, centre, outer, inner)}
                strokeWidth={0.8}
                className="project-ring__segment-fill"
              />
              {candidate.project.status === "active" ? (
                <path
                  d={arcPathForSegment(candidate, centre, outer - 1)}
                  fill="none"
                  strokeWidth={3.4}
                  className="project-ring__segment-glow"
                />
              ) : null}
              <path
                d={arcPathForSegment(candidate, centre, outer - 1)}
                fill="none"
                strokeWidth={1.4}
                className="project-ring__segment-face"
              />
              <path
                d={arcPathForSegment(candidate, centre, inner + 0.8)}
                fill="none"
                strokeWidth={0.9}
                className="project-ring__segment-shade"
              />
              <defs>
                <path
                  id={`ring-name-${candidate.project.id}`}
                  d={namePathForSegment(candidate, centre, radius)}
                  fill="none"
                />
              </defs>
              <text
                className={`project-ring__window-name project-ring__window-name--${candidate.project.status}`}
                style={{ fontSize: `${nameFontSize / Math.max(renderScale, 0.01)}px` }}
              >
                <textPath
                  href={`#ring-name-${candidate.project.id}`}
                  startOffset="50%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {nameForWindow(
                    candidate.project.name,
                    candidate,
                    radius,
                    nameFontSize,
                    renderScale
                  )}
                </textPath>
              </text>
            </g>
            {/* 40 units, not 18. Centred on the ring it spans 148-188, so the
                whole visible unit is hittable — the stroke at 168, the label lane
                below it, and clear space above — instead of an 11px stroke. It
                stops short of the day arc's innermost tick at 196. */}
            <path
              d={arcPathForSegment(candidate, centre, radius)}
              fill="none"
              stroke="transparent"
              strokeWidth={40}
              className="project-ring__hit"
              tabIndex={0}
              role="button"
              aria-label={`${details} — open in Project mode`}
              onMouseEnter={() => showProject(candidate.project.id)}
              onMouseLeave={() => hideProject(candidate.project.id)}
              onFocus={() => showProject(candidate.project.id)}
              onBlur={() => hideProject(candidate.project.id)}
              onClick={() => onSelectProject(candidate.project.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectProject(candidate.project.id);
                }
              }}
            />
          </g>
        );
      })}

      {/* Territory a project owns but has not filled. Hollow, and gone the moment
          a real node lands in the wedge. */}
      {constellation.emptyWedgeMarks.map((mark) => (
        <circle
          key={`empty-${mark.projectId}`}
          cx={mark.x}
          cy={mark.y}
          r={mark.size}
          className="project-ring__empty-mark"
          onMouseEnter={() => showProject(mark.projectId)}
          onMouseLeave={() => hideProject(mark.projectId)}
          onClick={() => onSelectProject(mark.projectId)}
        >
          <title>{`No notes link to this project yet`}</title>
        </circle>
      ))}

      {constellation.nodes.map((node) => (
        /* Depth opacity moved from the body circle to the group, so the shadow,
           rim and specular fade with their node instead of popping at full
           strength on a depth-3 ghost. The body keeps the class the hover rules
           and the reduced-motion guard already target. */
        <g
          key={node.id}
          className={`project-ring__node-group project-ring__node-group--depth-${Math.min(
            node.depth,
            3
          )}`}
        >
          <circle
            cx={node.x + node.size * 0.42}
            cy={node.y + node.size * 0.55}
            r={node.size * 1.1}
            fill="url(#ring-node-shadow)"
            className="project-ring__node-drop"
            pointerEvents="none"
          />
          <circle
            cx={node.x}
            cy={node.y}
            r={node.size}
            className={`project-ring__node ${hoveredNode?.id === node.id ? "is-hovered" : ""}`}
            onMouseEnter={() => {
              setHoveredProject(null);
              setHoveredNode(node);
            }}
            onMouseLeave={() => setHoveredNode(null)}
            onClick={() => onOpenNote(node.id)}
          >
            <title>{describeNode(node)}</title>
          </circle>
          <circle
            cx={node.x}
            cy={node.y}
            r={node.size}
            fill="none"
            className="project-ring__node-rim"
            pointerEvents="none"
          />
          <circle
            cx={node.x - node.size * 0.33}
            cy={node.y - node.size * 0.4}
            r={node.size * 0.38}
            fill="url(#ring-node-spec)"
            className="project-ring__node-spec"
            pointerEvents="none"
          />
        </g>
      ))}

      {/* One fixed position for every readout, in the interior beneath the omega.
          Nothing here shifts the layout: SVG text at absolute coordinates. */}
      {hoveredNode ? (
        <CentreReadout
          lines={[describeNode(hoveredNode)]}
          centre={centre}
          renderScale={renderScale}
        />
      ) : segment ? (
        <CentreReadout
          lines={readoutLines(
            segment,
            taskMap.get(segment.project.id)?.length ?? 0,
            tasksError
          )}
          centre={centre}
          renderScale={renderScale}
        />
      ) : constellation.droppedLinked > 0 ? (
        <CentreReadout
          lines={[
            `+${constellation.droppedLinked} LINKED ${
              constellation.droppedLinked === 1 ? "NOTE" : "NOTES"
            } NOT SHOWN`
          ]}
          centre={centre}
          renderScale={renderScale}
          muted
        />
      ) : null}

      {/* The constant is live and assertable now; the behavior waits for its
          separate design approval. No hidden visual change at the threshold. */}
      {ring.semanticZoomRecommended ? (
        <title>Project sectors are below the semantic-zoom threshold.</title>
      ) : null}
    </g>
  );
}

function CentreReadout({
  lines,
  centre,
  renderScale,
  muted = false
}: {
  lines: string[];
  centre: number;
  renderScale: number;
  muted?: boolean;
}) {
  const laid = layoutCentreReadout(lines, centre, renderScale);
  if (laid.length === 0) return null;
  const fontSize = 9 / Math.max(renderScale, 0.01);
  return (
    <g pointerEvents="none">
      {laid.map((line, index) => (
        <text
          key={index}
          x={centre}
          y={line.y}
          className={muted ? "project-ring__meta" : "project-ring__readout"}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: `${fontSize}px` }}
        >
          {line.text}
        </text>
      ))}
    </g>
  );
}
