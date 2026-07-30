import { useMemo, useState } from "react";
import type { ActionQueueTask } from "../../hooks/useActionQueue";
import {
  arcPathForSegment,
  layoutCentreReadout,
  layoutProjectOwnedGraph,
  layoutProjectRing
} from "../../services/projectRing";
import type {
  ProjectGraphNode,
  ProjectRingLabel,
  ProjectRingSegment
} from "../../services/projectRing";
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
      <circle
        cx={centre}
        cy={centre}
        r={radius}
        fill="none"
        className="project-ring__track"
        pointerEvents="none"
      />

      {constellation.treeEdges.map((edge) => (
        <line
          key={edge.key}
          x1={edge.from.x}
          y1={edge.from.y}
          x2={edge.to.x}
          y2={edge.to.y}
          className="project-ring__tree-edge"
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
        return (
          <g key={candidate.project.id}>
            <path
              d={arcPathForSegment(candidate, centre, radius)}
              fill="none"
              className={`project-ring__segment project-ring__segment--${candidate.project.status} ${
                hoveredProject === candidate.project.id ? "is-hovered" : ""
              }`}
              pointerEvents="none"
            />
            <path
              d={arcPathForSegment(candidate, centre, radius)}
              fill="none"
              stroke="transparent"
              strokeWidth={18}
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

      {ring.labels.map((label) => (
        <ProjectLabel
          key={label.projectId}
          label={label}
          status={
            ring.segments.find((candidate) => candidate.project.id === label.projectId)!.project
              .status
          }
          hovered={hoveredProject === label.projectId}
          renderScale={renderScale}
        />
      ))}

      {/* Territory a project owns but has not filled. Hollow, and gone the moment
          a real node lands in the wedge. */}
      {constellation.emptyWedgeMarks.map((mark) => (
        <circle
          key={`empty-${mark.projectId}`}
          cx={mark.x}
          cy={mark.y}
          r={mark.size}
          className="project-ring__empty-mark"
          pointerEvents="none"
        >
          <title>{`No notes link to this project yet`}</title>
        </circle>
      ))}

      {constellation.nodes.map((node) => (
        <circle
          key={node.id}
          cx={node.x}
          cy={node.y}
          r={node.size}
          className={`project-ring__node project-ring__node--depth-${Math.min(node.depth, 3)} ${
            hoveredNode?.id === node.id ? "is-hovered" : ""
          }`}
          onMouseEnter={() => {
            setHoveredProject(null);
            setHoveredNode(node);
          }}
          onMouseLeave={() => setHoveredNode(null)}
          onClick={() => onOpenNote(node.id)}
        >
          <title>{describeNode(node)}</title>
        </circle>
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

function ProjectLabel({
  label,
  status,
  hovered,
  renderScale
}: {
  label: ProjectRingLabel;
  status: TrackedProject["status"];
  hovered: boolean;
  renderScale: number;
}) {
  if (!label.visible && !hovered) return null;
  return (
    <text
      x={label.x}
      y={label.y}
      className={`project-ring__label project-ring__label--${status} ${
        hovered ? "is-hovered" : ""
      }`}
      style={{ fontSize: `${label.fontSize / Math.max(renderScale, 0.01)}px` }}
      textAnchor="middle"
      dominantBaseline="middle"
      pointerEvents="none"
    >
      {label.text}
      <title>{label.fullText}</title>
    </text>
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
