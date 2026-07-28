import type { ActionQueueTask } from "../../hooks/useActionQueue";
import {
  buildSessionBriefing,
  type ProjectBrief
} from "../../services/projectBriefing";
import { isTauriRuntime } from "../../services/launcher";
import type { TrackedProject } from "../../types";

interface ProjectBriefingProps {
  projects: TrackedProject[];
  tasks: ActionQueueTask[];
  tasksError: string | null;
  onSelectProject: (projectId: string) => void;
  onOpenNote: (notePath: string) => void;
}

/**
 * The readable session-path layer.
 *
 * This deliberately lives in Project mode. Command owns the ambient instrument;
 * vision, recent work, recommendations, and attention require the operator to
 * lean in and read. Keeping that boundary explicit prevents a useful briefing
 * from slowly turning Command into a second project dashboard.
 */
export function ProjectBriefing({
  projects,
  tasks,
  tasksError,
  onSelectProject,
  onOpenNote
}: ProjectBriefingProps) {
  const briefing = buildSessionBriefing(projects, tasks);
  const [featured, ...secondary] = briefing.projects;
  const previewMode = !isTauriRuntime();

  return (
    <section className="project-briefing" aria-labelledby="project-briefing-title">
      <header className="project-briefing__header">
        <div>
          <p className="project-briefing__eyebrow">Session paths</p>
          <h2 id="project-briefing-title">Where should we focus?</h2>
          <p className="project-briefing__introduction">{briefing.introduction}</p>
        </div>
        <div className="project-briefing__portfolio-meta tabular-data">
          <span>{briefing.activeCount} active</span>
          <span>{briefing.totalProjectCount} tracked</span>
          {briefing.hiddenActiveCount > 0 ? (
            <span>{briefing.hiddenActiveCount} active path hidden</span>
          ) : null}
          {briefing.watchlistOptions > 0 ? (
            <span>{briefing.watchlistOptions} watchlist option</span>
          ) : null}
        </div>
      </header>

      {previewMode ? (
        <p className="project-briefing__warning">
          Browser preview uses example project state. Open the desktop app for live Git and vault
          data.
        </p>
      ) : tasksError ? (
        <p className="project-briefing__warning">
          Project tasks are unavailable, so recommendations omit the task list.
        </p>
      ) : null}

      {featured ? (
        <div className="project-briefing__paths">
          <ProjectBriefCard
            brief={featured}
            featured
            onSelectProject={onSelectProject}
            onOpenNote={onOpenNote}
          />
          {secondary.length > 0 ? (
            <div className="project-briefing__secondary">
              {secondary.map((brief) => (
                <ProjectBriefCard
                  key={brief.project.id}
                  brief={brief}
                  onSelectProject={onSelectProject}
                  onOpenNote={onOpenNote}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="project-briefing__empty">
          <p>No trustworthy project path is available yet.</p>
          <p>Declare a project active or add current intent to its project note.</p>
        </div>
      )}

      <footer className="project-briefing__legend">
        <span>
          <i className="briefing-key briefing-key--committed" /> Committed by you
        </span>
        <span>
          <i className="briefing-key briefing-key--recommended" /> Recommended by Olympus
        </span>
        <span>
          <i className="briefing-key briefing-key--attention" /> Needs attention
        </span>
      </footer>
    </section>
  );
}

function ProjectBriefCard({
  brief,
  featured = false,
  onSelectProject,
  onOpenNote
}: {
  brief: ProjectBrief;
  featured?: boolean;
  onSelectProject: (projectId: string) => void;
  onOpenNote: (notePath: string) => void;
}) {
  const { project } = brief;

  return (
    <article
      className={[
        "briefing-card",
        `briefing-card--${project.status}`,
        featured ? "briefing-card--featured" : "briefing-card--secondary"
      ].join(" ")}
    >
      <div className="briefing-card__head">
        <div>
          <div className="briefing-card__status-line">
            <span className={`briefing-card__status ${project.status}`}>{project.status}</span>
            {brief.isWatchlistOption ? <span>Optional path</span> : <span>Active path</span>}
          </div>
          <h2>{project.name}</h2>
        </div>
        <div className="briefing-card__activity tabular-data">
          <span>{brief.activityLabel}</span>
          <span>{project.branch}</span>
          {brief.openTasks.length > 0 ? (
            <span>
              {brief.openTasks.length} open {brief.openTasks.length === 1 ? "task" : "tasks"}
            </span>
          ) : null}
        </div>
      </div>

      <div className="briefing-card__vision">
        <span className="briefing-card__label">Current vision</span>
        <p>{project.vision || "Vision not yet stated."}</p>
        {project.notePath ? (
          <button
            type="button"
            className="briefing-card__note-link"
            onClick={() => onOpenNote(project.notePath as string)}
          >
            Review in Obsidian
          </button>
        ) : null}
      </div>

      <div className="briefing-card__columns">
        <section>
          <span className="briefing-card__label">Recent work</span>
          <ul className="briefing-card__list">
            {brief.recentWork.map((item, index) => (
              <li key={`${index}-${item}`}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="briefing-card__committed">
          <span className="briefing-card__label">Committed next</span>
          <p>{brief.committedAction ?? "No committed next action."}</p>
        </section>
      </div>

      <section className="briefing-card__recommendation">
        <span className="briefing-card__label">Olympus recommends</span>
        <p>{brief.recommendation}</p>
      </section>

      {brief.attention.length > 0 ? (
        <section className="briefing-card__attention">
          <span className="briefing-card__label">Needs attention</span>
          <ul>
            {brief.attention.map((item, index) => (
              <li key={`${index}-${item}`}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <button
        type="button"
        className="briefing-card__focus"
        onClick={() => onSelectProject(project.id)}
      >
        Open project workspace
      </button>
    </article>
  );
}
