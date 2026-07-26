import { FolderGit2 } from "lucide-react";
import type { ProjectStatus, TrackedProject } from "../../types";
import { formatPath } from "../../utils/formatPath";
import type { ObsidianActionResult } from "../../services/obsidian";
import { useState } from "react";

interface ProjectsPanelProps {
  projects: TrackedProject[];
  onSyncCanvas: () => Promise<ObsidianActionResult>;
  /** Problems with `01 - Projects` itself, not with any one project. */
  noteWarnings?: string[];
  focusMode?: boolean;
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "ACTIVE",
  watching: "WATCHING",
  scaffold: "SCAFFOLD",
  archived: "ARCHIVED",
  unclassified: "UNCLASSIFIED"
};

export function ProjectsPanel({
  projects,
  onSyncCanvas,
  noteWarnings = [],
  focusMode = false
}: ProjectsPanelProps) {
  const [status, setStatus] = useState<ObsidianActionResult | null>(null);
  const [syncing, setSyncing] = useState(false);

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
        </div>
        {status && <p className={`section-copy action-feedback ${status.tone}`}>{status.message}</p>}
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
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
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

function ProjectCard({ project }: { project: TrackedProject }) {
  const statusLabel = STATUS_LABELS[project.status] ?? STATUS_LABELS.unclassified;
  const pathLabel = project.path ? formatPath(project.path) : "No folder under the projects root";
  const repoStateTone =
    project.repoState === "git-active"
      ? "active"
      : project.repoState === "git-pending"
        ? "pending"
        : "neutral";

  return (
    <article className="project-card">
      <div className="project-card-header">
        <strong>{project.name}</strong>
        <div className="project-top-meta">
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
    </article>
  );
}
