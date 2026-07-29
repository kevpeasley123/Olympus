import { useMemo, useState } from "react";
import type { ActionQueueTask } from "../../hooks/useActionQueue";
import {
  arcPathForSegment,
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
    () => layoutProjectRing(projects, centre, radius),
    [centre, projects, radius]
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

  return (
    <g className="project-ring">
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

      {hoveredNode ? (
        <text
          x={centre}
          y={centre + 158}
          className="project-ring__readout"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: `${9 / Math.max(renderScale, 0.01)}px` }}
        >
          {describeNode(hoveredNode)}
        </text>
      ) : segment ? (
        <ProjectReadout
          centre={centre}
          segment={segment}
          openTasks={taskMap.get(segment.project.id)?.length ?? 0}
          tasksError={tasksError}
          renderScale={renderScale}
        />
      ) : constellation.droppedLinked > 0 ? (
        <text
          x={centre}
          y={centre + 158}
          className="project-ring__meta"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: `${9 / Math.max(renderScale, 0.01)}px` }}
        >
          +{constellation.droppedLinked} linked{" "}
          {constellation.droppedLinked === 1 ? "note" : "notes"} not shown
        </text>
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

function ProjectReadout({
  centre,
  segment,
  openTasks,
  tasksError,
  renderScale
}: {
  centre: number;
  segment: ProjectRingSegment;
  openTasks: number;
  tasksError: string | null;
  renderScale: number;
}) {
  const taskCopy = tasksError
    ? "TASKS UNAVAILABLE"
    : `${openTasks} OPEN ${openTasks === 1 ? "TASK" : "TASKS"}`;
  return (
    <text
      x={centre}
      y={centre + 151}
      className="project-ring__readout"
      textAnchor="middle"
      style={{ fontSize: `${9 / Math.max(renderScale, 0.01)}px` }}
    >
      <tspan x={centre} dy="0">
        {segment.project.name.toUpperCase()} · {STATUS_LABEL[segment.project.status].toUpperCase()} ·{" "}
        {taskCopy}
      </tspan>
      <tspan x={centre} dy={13 / Math.max(renderScale, 0.01)}>
        {segment.project.branch} · {segment.project.lastCommit}
      </tspan>
    </text>
  );
}
