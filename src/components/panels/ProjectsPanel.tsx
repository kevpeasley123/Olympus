import type { TrackedProject } from "../../types";
import { formatPath } from "../../utils/formatPath";
import type { ObsidianActionResult } from "../../services/obsidian";
import { useState } from "react";

interface ProjectsPanelProps {
  projects: TrackedProject[];
  onSyncCanvas: () => Promise<ObsidianActionResult>;
  focusMode?: boolean;
}

export function ProjectsPanel({ projects, onSyncCanvas, focusMode = false }: ProjectsPanelProps) {
  const [status, setStatus] = useState<ObsidianActionResult | null>(null);
  const [syncing, setSyncing] = useState(false);

  async function handleSyncCanvas() {
    setSyncing(true);
    const result = await onSyncCanvas();
    setStatus(result);
    setSyncing(false);
  }

  return (
    <section className={`dashboard-panel projects-panel ${focusMode ? "focus-projects" : ""}`}>
      <div className="projects-panel-top">
        <div className="panel-header compact projects-header-row">
          <p className="projects-title">Projects</p>
          <button className="ghost-action" onClick={() => void handleSyncCanvas()} disabled={syncing}>
            {syncing ? "Updating..." : "Update Canvas"}
          </button>
        </div>
        {status && <p className={`section-copy action-feedback ${status.tone}`}>{status.message}</p>}
      </div>
      <div className="project-list">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  );
}

function ProjectCard({ project }: { project: TrackedProject }) {
  const statusLabel = project.status.toUpperCase();
  const pathLabel = formatPath(project.path);
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
          <span className={`project-state ${project.status}`}>{statusLabel}</span>
        </div>
      </div>
      <div className="project-path" title={project.path}>
        {pathLabel}
      </div>
      <div className="project-next-line" title={project.nextStep}>
        <span aria-hidden="true">{"\u2192"}</span>
        <span>{project.nextStep}</span>
      </div>
    </article>
  );
}
