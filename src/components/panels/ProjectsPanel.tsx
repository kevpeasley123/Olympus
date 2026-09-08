import { GitBranch, ListChecks } from "lucide-react";
import type { ProjectStatus, SessionBoundary, TrackedProject } from "../../types";
import { formatPath } from "../../utils/formatPath";
import type { ObsidianActionResult } from "../../services/obsidian";
import { useActionQueue, type ActionQueueTask } from "../../hooks/useActionQueue";
import { attributeTasks, groupBySourceFile } from "../../services/taskAttribution";
import { useState } from "react";
import { useDelegationRuns } from "../../hooks/useDelegationRuns";
import { buildProjectCommandBoard, operationalStatuses, reviewProjectContext, sortCommandProjects, type OperationalStatus } from "../../services/projectCommandBoard";
import { isTauriRuntime } from "../../services/launcher";
import {
  DelegationPanel,
  type DelegationProposal
} from "./DelegationPanel";

interface ProjectsPanelProps {
  projects: TrackedProject[];
  sessionBoundary: SessionBoundary | null;
  onSyncCanvas: () => Promise<ObsidianActionResult>;
  /** Problems with `01 - Projects` itself, not with any one project. */
  noteWarnings?: string[];
  focusMode?: boolean;
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
  sessionBoundary,
  onSyncCanvas,
  noteWarnings = [],
  focusMode = false,
  projectFilter = null,
  onClearFilter,
  onFocusProject,
  onOpenNote
}: ProjectsPanelProps) {
  const [status, setStatus] = useState<ObsidianActionResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [delegationProposal, setDelegationProposal] = useState<DelegationProposal | null>(null);
  const [filter, setFilter] = useState<OperationalStatus | "ALL">("ALL");
  const [sort, setSort] = useState<"priority" | "recent" | "name">("priority");
  const { tasks, error: tasksError, loading: tasksLoading } = useActionQueue();
  const { data: runs, error: runsError, loading: runsLoading } = useDelegationRuns();
  const rows = buildProjectCommandBoard(allProjects, tasks, runs, { tasks: !tasksError && !tasksLoading, runs: !runsError && !runsLoading });
  const selected = rows.find(row => row.project.id === projectFilter);
  const visible = sortCommandProjects(rows.filter(row => filter === "ALL" || row.operationalStatus === filter), sort);
  const attention = rows.filter(row => row.operatorDecisions.length > 0);
  const { perProject, unattributed } = attributeTasks(allProjects, tasks);
  const warnings = [...noteWarnings, ...allProjects.flatMap(project => project.warnings)];
  const label = (value: string) => value.replace(/_/g, " ");
  async function handleSyncCanvas() {
    setSyncing(true);
    try { setStatus(await onSyncCanvas()); } finally { setSyncing(false); }
  }
  return <section className={`dashboard-panel projects-panel project-command ${focusMode ? "focus-projects" : ""}`}>
    <header className="command-board-heading">
      <div><span className="command-board-kicker">OLYMPUS / PORTFOLIO</span><h2>{selected ? selected.project.name : "PROJECT COMMAND"}</h2></div>
      {projectFilter ? <button className="ghost-action" onClick={onClearFilter}>← All projects</button> : <span>{rows.filter(row => row.operationalStatus !== "COMPLETE").length} OPEN</span>}
    </header>
    <div className="command-board-scroll">
      {!isTauriRuntime() && <p className="command-board-notice">Browser preview · example project data. Desktop provides live records.</p>}
      {(tasksError || runsError || tasksLoading || runsLoading) && <p className="command-board-notice">{tasksError || runsError ? "Some sources are unavailable. Counts and execution state may be incomplete." : "Reading tasks and execution records…"}</p>}
      {warnings.length > 0 && <details className="command-board-notice"><summary>{warnings.length} source warnings</summary>{warnings.map((warning,i) => <p key={i}>{warning}</p>)}</details>}
      {projectFilter && !selected ? <p>Project is no longer available. Return to the portfolio.</p> : selected ? <>
        <section className="command-project-detail">
          <span className="command-board-kicker">{label(selected.operationalStatus)} · {selected.project.status}</span>
          <h3>Project intent</h3><p>{selected.project.vision || selected.project.summary || "No vision recorded."}</p>
          {selected.project.notePath && <button className="ghost-action" onClick={() => onOpenNote(selected.project.notePath!)}>Open project note</button>}
          <h3>Current state</h3><p>{selected.currentState}</p>
          <h3>Recorded next action · execution unverified</h3><p>{selected.nextAction || "Not recorded"}</p>
          <h3>Ω Olympus recommends · rule-based</h3><p>{selected.olympusRecommendation}</p>
          <h3>{sessionBoundary?.previousSessionStartedAt ? "Commits since previous session" : "Recent commits"}</h3>
          <ul>{(sessionBoundary?.previousSessionStartedAt ? selected.project.sinceSessionCommits : selected.project.recentCommits).map((commit,i) => <li key={i}>{commit.subject} · {commit.at}</li>)}</ul>
          <p>Blockers and general operator decisions: not recorded as structured fields. Delegation checkpoints appear below.</p>
          <div className="command-board-actions"><button className="ghost-action" onClick={() => reviewProjectContext([selected])}>Review with Olympus</button>
          {selected.project.path && <button className="ghost-action" onClick={() => setDelegationProposal({projectId:selected.project.id,projectName:selected.project.name,task:selected.nextAction ?? ""})}>Prepare Claude run</button>}</div>
        </section>
        <DelegationPanel projectId={selected.project.id} proposal={delegationProposal?.projectId === selected.project.id ? delegationProposal : null} onDismissProposal={() => setDelegationProposal(null)} />
        <ProjectCard project={selected.project} tasks={perProject.get(selected.project.id) ?? []} />
      </> : <>
        <section className="command-board-brief" aria-label="Olympus brief">
          <div><h3>Ω OLYMPUS BRIEF</h3><span>DETERMINISTIC STATUS SUMMARY</span></div>
          <p>{attention.length} projects have recorded operator checkpoints. {rows.filter(row => row.operationalStatus === "IN_PROGRESS").length} have active delegated work. {rows.filter(row => row.operationalStatus === "MONITORING").length} are on the watchlist. {rows.filter(row => row.operationalStatus === "UNKNOWN").length} have unconfirmed operational state.</p>
          <button className="ghost-action" onClick={() => reviewProjectContext(rows)}>Review priorities with Olympus →</button>
        </section>
        <section className="command-attention" aria-label="Needs your attention">
          <h3>NEEDS YOUR ATTENTION <span>{attention.reduce((sum,row) => sum+row.operatorDecisions.length,0)}</span></h3>
          {attention.length ? attention.map(row => <div className="command-attention-item" key={row.project.id}><div><strong>{row.project.name}</strong>{row.operatorDecisions.map(decision => <p key={decision.runId}>{decision.text}</p>)}<small>Ω Review evidence before approving.</small></div><button className="ghost-action" onClick={() => onFocusProject(row.project.id)}>Review →</button></div>) : <p>No operator checkpoints are confirmed{runsError || runsLoading ? "; execution records are not currently available" : ". General task ownership is not recorded"}.</p>}
        </section>
        <nav className="command-board-filters" aria-label="Filter projects by operational status">
          {(["ALL", ...operationalStatuses] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label(value)} <span>{value === "ALL" ? rows.length : rows.filter(row => row.operationalStatus === value).length}</span></button>)}
        </nav>
        <div className="command-board-list-heading"><span>{visible.length} PROJECTS</span><label>Sort <select value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="priority">Priority</option><option value="recent">Recently changed</option><option value="name">Name</option></select></label></div>
        <div className="command-board-rows">
          {visible.map(row => <article className={`command-project-row status-${row.operationalStatus.toLowerCase()}`} key={row.project.id}>
            <header><h3>{row.project.name}</h3><span className="command-operational-status">{label(row.operationalStatus)}</span></header>
            <p className="command-project-purpose">{row.project.summary || "Purpose not recorded"}</p>
            <div className="command-project-columns">
              <section><h4>STATE</h4><p>{row.currentState}</p></section>
              <section><h4>NEXT MOVE <span>{row.nextMoveOwner === "OPERATOR" ? "YOU" : row.nextMoveOwner ?? "OWNER UNKNOWN"}</span></h4><p>{row.nextMove || (row.nextMoveOwner === "NONE" ? "No current move recorded or expected." : "Not recorded")}</p></section>
              <section><h4>Ω OLYMPUS RECOMMENDS</h4><p>{row.olympusRecommendation}</p><small>Rule-based suggestion · not approval</small></section>
            </div>
            <footer><div><span>{row.openTaskCount ?? "Unknown"} open tasks</span><span>{row.operatorDecisions.length} delegation checkpoints</span><span>{row.project.status} · {row.project.statusSource}</span><span>{row.lastMeaningfulChange ? `${row.lastMeaningfulChange.source}: ${new Date(row.lastMeaningfulChange.at).toLocaleDateString()}` : "Change date unavailable"}</span></div><button className="ghost-action" onClick={() => onFocusProject(row.project.id)}>Open project →</button></footer>
          </article>)}
          {!visible.length && <p>No projects match this status.</p>}
        </div>
        <p className="command-board-notice">Ready, blocked, and external waiting require explicit readiness or dependency evidence; these fields are not yet recorded. A next-step note alone does not authorize Olympus to execute.</p>
        {unattributed.length > 0 && <details className="command-unattributed"><summary>{unattributed.length} tasks without a project</summary><UnattributedTasks tasks={unattributed} /></details>}
      </>}
    </div>
    <footer className="projects-footer">{status && <p className={`section-copy action-feedback ${status.tone}`}>{status.message}</p>}<button className="ghost-action" onClick={() => void handleSyncCanvas()} disabled={syncing}>{syncing ? "Updating…" : "Update Canvas"}</button></footer>
  </section>;
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
          {project.linkedWorktrees.length > 0 ? (
            <span
              className="project-worktree-count tabular-data"
              title={`${project.linkedWorktrees.length} linked worktree ${
                project.linkedWorktrees.length === 1 ? "is" : "are"
              } tracked below`}
            >
              <GitBranch size={12} />
              {project.linkedWorktrees.length}
            </span>
          ) : null}
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
      {project.linkedWorktrees.length > 0 ? (
        <div className="project-worktrees">
          {project.linkedWorktrees.map((worktree) => (
            <div key={worktree.path} className="project-worktree">
              <span>{worktree.branch}</span>
              <span className={worktree.changedFiles > 0 ? "pending" : "quiet"}>
                {worktree.changedFiles > 0
                  ? `${worktree.changedFiles} uncommitted ${
                      worktree.changedFiles === 1 ? "file" : "files"
                    }`
                  : `clean at ${worktree.head || "HEAD"}`}
              </span>
            </div>
          ))}
        </div>
      ) : null}
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
