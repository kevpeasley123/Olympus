import { FolderGit2, ListChecks, X } from "lucide-react";
import type { ProjectStatus, TrackedProject } from "../../types";
import { formatPath } from "../../utils/formatPath";
import type { ObsidianActionResult } from "../../services/obsidian";
import { useActionQueue, type ActionQueueTask } from "../../hooks/useActionQueue";
import { attributeTasks, groupBySourceFile } from "../../services/taskAttribution";
import { useState } from "react";
import { ProjectBriefing } from "./ProjectBriefing";

interface ProjectsPanelProps {
  projects: TrackedProject[];
  onSyncCanvas: () => Promise<ObsidianActionResult>;
  /** Problems with `01 - Projects` itself, not with any one project. */
  noteWarnings?: string[];
  focusMode?: boolean;
  /** Set by clicking a tier arc in Command mode. */
  tierFilter?: ProjectStatus | null;
  /** Set by opening one of Project mode's detailed session paths. */
  projectFilter?: string | null;
  onClearFilter?: () => void;
  onFocusProject: (projectId: string) => void;
  onOpenNote: (notePath: string) => void;
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "ACTIVE",
  watching: "WATCHING",
  scaffold: "SCAFFOLD",
  archived: "ARCHIVED",
  unclassified: "UNCLASSIFIED"
};

/** How many tasks a card shows before it needs asking. */
const VISIBLE_TASK_LIMIT = 3;

export function ProjectsPanel({
  projects: allProjects,
  onSyncCanvas,
  noteWarnings = [],
  focusMode = false,
  tierFilter = null,
  projectFilter = null,
  onClearFilter,
  onFocusProject,
  onOpenNote
}: ProjectsPanelProps) {
  const projects = projectFilter
    ? allProjects.filter((project) => project.id === projectFilter)
    : tierFilter
      ? allProjects.filter((project) => project.status === tierFilter)
      : allProjects;
  const [status, setStatus] = useState<ObsidianActionResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  // The Action Queue dissolved into this panel, so its fetch moved with it
  // rather than a second one being added alongside.
  const { tasks, error: tasksError } = useActionQueue();

  async function handleSyncCanvas() {
    setSyncing(true);
    const result = await onSyncCanvas();
    setStatus(result);
    setSyncing(false);
  }

  // A note whose status failed to parse looks exactly like a project nobody
  // classified, so the count has to be visible rather than only logged.
  const warningCount =
    noteWarnings.length + projects.reduce((total, project) => total + project.warnings.length, 0);

  // Attribute against the whole portfolio before filtering the visible cards.
  // Otherwise tasks belonging to a hidden project are falsely presented as
  // unattributed whenever Project mode focuses one workspace.
  const { perProject, unattributed } = attributeTasks(allProjects, tasks);
  const filterLabel = projectFilter
    ? allProjects.find((project) => project.id === projectFilter)?.name ?? "project"
    : tierFilter;

  return (
    <section className={`dashboard-panel projects-panel ${focusMode ? "focus-projects" : ""}`}>
      <div className="projects-panel-top">
        <div className="panel-head">
          <span className="panel-head__icon">
            <FolderGit2 size={15} />
          </span>
          <p className="panel-head__title">Projects</p>
          <span className="panel-head__meta tabular-data">
            {projects.length === 1 ? "1 project" : `${projects.length} projects`}
          </span>
          {/* A filtered panel must say it is filtered and offer the way out, or
              it reads as a project list that lost most of its projects. */}
          {filterLabel ? (
            <button
              type="button"
              className="ghost-action projects-filter-chip"
              onClick={onClearFilter}
              title={`Showing ${filterLabel} only — click to show all ${allProjects.length}`}
            >
              {filterLabel}
              <X size={13} />
            </button>
          ) : null}
          {tasks.length > 0 ? (
            <span className="panel-head__meta tabular-data">
              {tasks.length === 1 ? "1 open task" : `${tasks.length} open tasks`}
            </span>
          ) : null}
        </div>
        {status && <p className={`section-copy action-feedback ${status.tone}`}>{status.message}</p>}
        {tasksError && (
          <p className="section-copy action-feedback warning">Couldn't reach the vault parser.</p>
        )}
        {warningCount > 0 && (
          <p
            className="section-copy action-feedback warning"
            title={[...noteWarnings, ...projects.flatMap((project) => project.warnings)].join("\n")}
          >
            {warningCount === 1
              ? "1 project note has a problem."
              : `${warningCount} project notes have problems.`}
          </p>
        )}
      </div>
      <div className="project-list">
        {!projectFilter && !tierFilter ? (
          <ProjectBriefing
            projects={allProjects}
            tasks={tasks}
            tasksError={tasksError}
            onSelectProject={onFocusProject}
            onOpenNote={onOpenNote}
          />
        ) : null}

        <div className="project-directory-heading">
          <span>{filterLabel ? `${filterLabel} projects` : "All projects"}</span>
          <span className="tabular-data">{projects.length}</span>
        </div>

        {projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            tasks={perProject.get(project.id) ?? []}
          />
        ))}

        {!projectFilter && unattributed.length > 0 ? (
          <UnattributedTasks tasks={unattributed} />
        ) : null}
      </div>
      {/* Demoted out of the header. It rewrites a file wholesale, and it should
          not be the most prominent affordance in the centrepiece panel. It has
          been gated since c62018a — it prompts when the canvas diverged from
          what Olympus last wrote — so this is about prominence, not safety. */}
      <footer className="projects-footer">
        <button
          className="ghost-action"
          onClick={() => void handleSyncCanvas()}
          disabled={syncing}
          title="Regenerate 00 - Dashboard/Olympus Projects.canvas from the current project list"
        >
          {syncing ? "Updating..." : "Update Canvas"}
        </button>
      </footer>
    </section>
  );
}

function ProjectCard({ project, tasks }: { project: TrackedProject; tasks: ActionQueueTask[] }) {
  const [expanded, setExpanded] = useState(false);
  const statusLabel = STATUS_LABELS[project.status] ?? STATUS_LABELS.unclassified;
  const pathLabel = project.path ? formatPath(project.path) : "No folder under the projects root";
  const repoStateTone =
    project.repoState === "git-active"
      ? "active"
      : project.repoState === "git-pending"
        ? "pending"
        : "neutral";

  const visible = expanded ? tasks : tasks.slice(0, VISIBLE_TASK_LIMIT);
  const hidden = tasks.length - visible.length;

  return (
    <article className="project-card">
      <div className="project-card-header">
        <strong>{project.name}</strong>
        <div className="project-top-meta">
          {tasks.length > 0 ? (
            <span
              className="project-task-count tabular-data"
              title={`${tasks.length} open ${tasks.length === 1 ? "task" : "tasks"} in ${project.notePath}`}
            >
              <ListChecks size={12} />
              {tasks.length}
            </span>
          ) : null}
          <span className="project-branch tabular-data">{project.branch}</span>
          <span className={`project-repo-state ${repoStateTone}`}>
            <span className="project-repo-dot" aria-hidden="true"></span>
            <span className="tabular-data">{project.repoState}</span>
          </span>
          <span
            className={`project-state ${project.status} ${project.statusSource}`}
            title={
              project.statusSource === "declared"
                ? `Declared in ${project.notePath ?? "the vault"}`
                : "No project note declares a status for this one"
            }
          >
            {statusLabel}
          </span>
        </div>
      </div>
      <div className="project-path" title={project.path || undefined}>
        {pathLabel}
      </div>
      {/* Empty rather than invented: an absent next step used to render one of
          three canned sentences, which read as advice while saying nothing. */}
      {project.nextStep ? (
        <div className="project-next-line" title={project.nextStep}>
          <span aria-hidden="true">{"→"}</span>
          <span>{project.nextStep}</span>
        </div>
      ) : null}

      {tasks.length > 0 ? (
        <div className="project-tasks">
          {visible.map((task) => (
            <TaskLine key={task.id} task={task} />
          ))}
          {hidden > 0 || expanded ? (
            <button
              type="button"
              className="project-tasks-toggle"
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? "Show fewer" : `${hidden} more`}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/**
 * The tasks that join to no project.
 *
 * Rendered expanded, next to the projects rather than behind a toggle. These
 * are real open work; collapsing them by default would reproduce exactly the
 * invisibility that made dissolving the Action Queue worth doing.
 */
function UnattributedTasks({ tasks }: { tasks: ActionQueueTask[] }) {
  const groups = groupBySourceFile(tasks);

  return (
    <article className="project-card unattributed-card">
      <div className="project-card-header">
        <strong>Not attributed to a project</strong>
        <div className="project-top-meta">
          <span className="project-task-count tabular-data">
            <ListChecks size={12} />
            {tasks.length}
          </span>
        </div>
      </div>
      <div className="project-path">
        These live in notes no project claims. Move a checkbox under a project note to attribute it.
      </div>
      {groups.map(([sourceFile, groupTasks]) => (
        <div key={sourceFile} className="unattributed-group">
          <div className="unattributed-group-label">{sourceFile}</div>
          <div className="project-tasks">
            {groupTasks.map((task) => (
              <TaskLine key={task.id} task={task} />
            ))}
          </div>
        </div>
      ))}
    </article>
  );
}

function TaskLine({ task }: { task: ActionQueueTask }) {
  return (
    <div className="project-task-line" title={`${task.text}\n${task.sourceFile}:${task.lineNumber}`}>
      <span className="project-task-bullet" aria-hidden="true"></span>
      <span className="project-task-text">{task.text}</span>
    </div>
  );
}
