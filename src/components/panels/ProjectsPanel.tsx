import { GitBranch, ListChecks, RefreshCw } from "lucide-react";
import type { ProjectStatus, SessionBoundary, TrackedProject } from "../../types";
import { formatPath } from "../../utils/formatPath";
import type { ObsidianActionResult } from "../../services/obsidian";
import { refreshActionQueue, useActionQueue, type ActionQueueTask } from "../../hooks/useActionQueue";
import { attributeTasks, groupBySourceFile } from "../../services/taskAttribution";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { refreshDelegationRuns, useDelegationRuns } from "../../hooks/useDelegationRuns";
import {
  buildProjectCommandBoard, isPinnedStatus, operationalStatuses, operationalStatusLabels, ownerLabels,
  prepareBlocker, reviewProjectContext, sortCommandProjects,
  type OperationalStatus, type ProjectCommandState
} from "../../services/projectCommandBoard";
import type { AttentionItem } from "../../services/projectBriefing";
import type { DelegationRun } from "../../services/delegation";
import type { ProjectScanState } from "../../hooks/useDashboardData";
import { isTauriRuntime } from "../../services/launcher";
import { clockTime, dayLabel, formatWhen, toDate } from "../../services/time";
import { readViewSlice, writeViewSlice } from "../../state/viewState";
import { DelegationPanel } from "./DelegationPanel";
import "./projects.css";

interface ProjectsPanelProps {
  requestedStatus?: {status:OperationalStatus|"ALL";revision:number};
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
  /** Where the project scan stands; the board renders nothing it cannot vouch for. */
  projectScan?: ProjectScanState;
  onRescan?: () => void | Promise<void>;
  /** Browser preview: the projects are seed fixtures. */
  demoData?: boolean;
  projectsRootPath?: string;
}

const READY_SCAN: ProjectScanState = { status: "ready", lastSuccessAt: null, error: null, scanning: false };

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "ACTIVE",
  watching: "WATCHING",
  scaffold: "SCAFFOLD",
  archived: "ARCHIVED",
  unclassified: "UNCLASSIFIED"
};

const REPO_STATE_LABELS: Record<TrackedProject["repoState"], string> = {
  "git-active": "clean",
  "git-pending": "uncommitted changes",
  "folder-only": "folder, no Git",
  "no-repo": "no folder"
};

/**
 * The last voice filter revision applied. Module scope, not a ref: the panel
 * unmounts in Command and Research, and a voice request made from Command must
 * still apply when it mounts, while a remount must not re-apply an old one.
 */
let consumedVoiceRevision = 0;

/** Which project `detailScrollTop` in the view store was measured on. */
let detailScrollOwner: string | null = null;

/** How many tasks a card shows before it needs asking. */
const VISIBLE_TASK_LIMIT = 3;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const summaryWords: Partial<Record<OperationalStatus, [string, string]>> = {
  NEEDS_YOU: ["needs you", "need you"], BLOCKED: ["blocked", "blocked"], IN_PROGRESS: ["in progress", "in progress"],
  UNKNOWN: ["unconfirmed", "unconfirmed"], MONITORING: ["monitoring", "monitoring"], COMPLETE: ["archived", "archived"],
  READY: ["ready", "ready"], WAITING: ["waiting", "waiting"]
};

/** Re-renders a freshness line on its own clock; polls do not notify on time alone. */
function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** "2 min ago" for today, else the short date: a source age, not a timestamp. */
function age(value: string | null, now: Date): string {
  if (!value) return "not yet";
  return formatWhen(value, { now }).split(" · ")[0];
}

export function ProjectsPanel({
  requestedStatus,
  projects: allProjects,
  sessionBoundary,
  onSyncCanvas,
  noteWarnings = [],
  focusMode = false,
  projectFilter = null,
  onClearFilter,
  onFocusProject,
  onOpenNote,
  projectScan = READY_SCAN,
  onRescan,
  demoData = !isTauriRuntime(),
  projectsRootPath
}: ProjectsPanelProps) {
  const [status, setStatus] = useState<ObsidianActionResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<OperationalStatus | "ALL">("ALL");
  useEffect(() => {
    if (!requestedStatus || requestedStatus.revision === consumedVoiceRevision) return;
    consumedVoiceRevision = requestedStatus.revision;
    setFilter(requestedStatus.status);
  }, [requestedStatus]);
  const [sort, setSort] = useState<"priority" | "recent" | "name">("priority");
  const { tasks, error: tasksError, loading: tasksLoading, lastSuccessAt: tasksAt } = useActionQueue();
  const { data: runs, error: runsError, loading: runsLoading, lastSuccessAt: runsAt } = useDelegationRuns();
  const tasksAvailable = !tasksError && !tasksLoading, runsAvailable = !runsError && !runsLoading;
  const rows = useMemo(() => buildProjectCommandBoard(allProjects, tasks, runs, { tasks: tasksAvailable, runs: runsAvailable }),
    [allProjects, tasks, runs, tasksAvailable, runsAvailable]);
  const selected = rows.find(row => row.project.id === projectFilter);
  const visible = sortCommandProjects(rows.filter(row => filter === "ALL" || row.operationalStatus === filter), sort);
  const { perProject, unattributed } = attributeTasks(allProjects, tasks);
  const warnings = [...noteWarnings, ...allProjects.flatMap(project => project.warnings)];
  const scanLoading = !demoData && projectScan.status === "loading";

  // Board and detail scroll survive a mode switch (review U3). Tracked in a ref
  // and written on the way out: writing the slice on every scroll event would
  // re-render App, which subscribes to it.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollTop = useRef(0);
  const inDetail = Boolean(projectFilter);
  const viewRef = useRef(projectFilter);
  viewRef.current = projectFilter;
  useEffect(() => () => {
    const detail = viewRef.current;
    if (detail) detailScrollOwner = detail;
    const key = detail ? "detailScrollTop" : "boardScrollTop";
    writeViewSlice("project", current => current[key] === scrollTop.current ? current : { ...current, [key]: scrollTop.current });
  }, []);
  const hasContent = inDetail ? Boolean(selected) : rows.length > 0;
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node || !hasContent) return;
    const view = readViewSlice("project");
    // A detail opened from elsewhere (the ring, voice) starts at the top.
    node.scrollTop = inDetail ? (detailScrollOwner === projectFilter ? view.detailScrollTop : 0) : view.boardScrollTop;
    scrollTop.current = node.scrollTop;
  }, [inDetail, projectFilter, hasContent]);

  const openProject = useCallback((projectId: string) => {
    writeViewSlice("project", current => ({ ...current, boardScrollTop: scrollTop.current, detailScrollTop: 0 }));
    detailScrollOwner = projectId;
    onFocusProject(projectId);
  }, [onFocusProject]);
  const backToBoard = useCallback(() => {
    writeViewSlice("project", current => ({ ...current, detailScrollTop: 0 }));
    onClearFilter?.();
  }, [onClearFilter]);

  async function handleSyncCanvas() {
    setSyncing(true);
    try { setStatus(await onSyncCanvas()); } finally { setSyncing(false); }
  }
  // Below the rows on the board: they qualify the data, they are not the first thing to read.
  const boardWarnings = warnings.length > 0 ? <details className="command-board-notice"><summary>{plural(warnings.length, "source warning", "source warnings")}</summary>{warnings.map((warning,i) => <p key={i}>{warning}</p>)}</details> : null;
  const counts = (value: OperationalStatus) => rows.filter(row => row.operationalStatus === value).length;
  const openCount = rows.filter(row => row.operationalStatus !== "COMPLETE").length;

  return <section className={`dashboard-panel projects-panel project-command ${focusMode ? "focus-projects" : ""}`}>
    <header className="command-board-heading">
      <div><span className="command-board-kicker">OLYMPUS / PORTFOLIO</span><h2>{selected ? selected.project.name : "PROJECT COMMAND"}</h2></div>
      {projectFilter ? <button className="ghost-action" onClick={backToBoard}>← All projects</button> : scanLoading || projectScan.status === "failed" ? null : <span>{openCount} OPEN</span>}
    </header>
    <div className="command-board-scroll" ref={scrollRef} onScroll={event => { scrollTop.current = event.currentTarget.scrollTop; }}>
      <div className="command-board-inner">
        <ScanStatus scan={projectScan} demoData={demoData} empty={allProjects.length === 0} root={projectsRootPath} onRescan={onRescan} />
        {(tasksError || runsError || ((tasksLoading || runsLoading) && !scanLoading)) && <p className="command-board-notice">{tasksError || runsError ? "Some sources are unavailable. Counts and execution state may be incomplete." : "Reading tasks and execution records…"}</p>}
        {projectFilter && boardWarnings}
        {projectFilter && !selected ? (scanLoading ? <BoardSkeleton /> : <p className="command-board-notice">Project is no longer available. Return to the portfolio.</p>) : selected ? <ProjectDetail
            row={selected} runs={runsAvailable ? runs : null} tasks={perProject.get(selected.project.id) ?? []}
            sessionBoundary={sessionBoundary} onOpenNote={onOpenNote} />
        : scanLoading ? <BoardSkeleton /> : rows.length === 0 ? boardWarnings : <>
          <section className="command-board-summary" aria-label="Olympus brief">
            <p><span className="command-board-summary__label">Ω BRIEF</span>{operationalStatuses.filter(value => counts(value) > 0).map(value => {
              const [one, many] = summaryWords[value] ?? [value, value];
              return `${counts(value)} ${counts(value) === 1 ? one : many}`;
            }).join(" · ")}</p>
            <button className="ghost-action" onClick={() => reviewProjectContext(rows)}>Review priorities with Olympus →</button>
          </section>
          <div className="command-board-meta">
            <Freshness scan={projectScan} demoData={demoData} tasksAt={tasksAt} runsAt={runsAt} runsLive={!isTauriRuntime() ? false : runsAvailable} onRescan={onRescan} />
            <p className="command-board-legend"><span>Ω rule-based suggestion · not approval</span><span>Attention: observations, not blockers</span></p>
          </div>
          <div className="command-board-controls">
            <nav className="command-board-filters" aria-label="Filter projects by operational status">
              {(["ALL", ...operationalStatuses] as const).filter(value => value === "ALL" || value === filter || counts(value) > 0).map(value =>
                <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === "ALL" ? "ALL" : operationalStatusLabels[value]} <span>{value === "ALL" ? rows.length : counts(value)}</span></button>)}
            </nav>
            <label className="command-board-sort">Sort <select value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="priority">Priority</option><option value="recent">Recently changed</option><option value="name">Name</option></select></label>
          </div>
          <div className="command-board-rows">
            {visible.map(row => <ProjectRow key={row.project.id} row={row} onOpen={openProject} />)}
            {!visible.length && <p className="command-board-notice">No projects match this status.</p>}
          </div>
          <p className="command-board-notice">Attention items are observations from Git, vault notes and run records; they never change a project's status. Ready, blocked, and external waiting require explicit readiness or dependency evidence; these fields are not yet recorded. A next-step note alone does not authorize Olympus to execute.</p>
          {boardWarnings}
          {unattributed.length > 0 && <details className="command-unattributed"><summary>{plural(unattributed.length, "task", "tasks")} without a project</summary><UnattributedTasks tasks={unattributed} /></details>}
        </>}
      </div>
    </div>
    <footer className="projects-footer">{status && <p className={`section-copy action-feedback ${status.tone}`}>{status.message}</p>}<button className="ghost-action" onClick={() => void handleSyncCanvas()} disabled={syncing}>{syncing ? "Updating…" : "Update Canvas"}</button></footer>
  </section>;
}

function ScanStatus({ scan, demoData, empty, root, onRescan }: { scan: ProjectScanState; demoData: boolean; empty: boolean; root?: string; onRescan?: () => void | Promise<void> }) {
  if (demoData) return <p className="command-board-notice">Browser preview · example project data. Desktop provides live records.</p>;
  const retry = onRescan && <button type="button" className="ghost-action command-scan-banner__retry" disabled={scan.scanning} onClick={() => void onRescan()}>
    <RefreshCw size={12} aria-hidden="true" />{scan.scanning ? "Scanning…" : "Retry"}
  </button>;
  const failedAt = toDate(scan.failedAt ?? null);
  // Backend messages end in a full stop; the sentence around them supplies its own.
  const reason = (scan.error ?? "no reason given").trim().replace(/[.\s]+$/, "");
  if (scan.status === "loading") return <p className="command-scan-banner is-loading" role="status">Scanning projects…</p>;
  if (scan.status === "failed") return <div className="command-scan-banner is-failed" role="alert">
    <p>Project scan failed{failedAt ? ` ${clockTime(failedAt)}` : ""} — {reason}. Showing nothing rather than stale data.</p>{retry}
  </div>;
  if (scan.status === "stale") return <div className="command-scan-banner is-stale" role="status">
    <p>Last successful scan {formatWhen(scan.lastSuccessAt)}. Latest refresh failed: {reason}. These rows may be out of date.</p>{retry}
  </div>;
  if (empty) return <div className="command-scan-banner is-empty" role="status">
    <p>No projects found. Olympus looked for folders under <code>{root || "the projects root"}</code> and notes in the vault's <code>01 - Projects</code>. The root is the stored <code>projectsRootPath</code> setting; Preferences does not edit it yet.</p>{onRescan && <button type="button" className="ghost-action command-scan-banner__retry" disabled={scan.scanning} onClick={() => void onRescan()}><RefreshCw size={12} aria-hidden="true" />{scan.scanning ? "Scanning…" : "Rescan"}</button>}
  </div>;
  return null;
}

function BoardSkeleton() {
  return <div className="command-board-skeleton" aria-hidden="true">
    {[0, 1, 2].map(i => <div key={i} className="command-board-skeleton__row"><span /><span /><span /></div>)}
  </div>;
}

function Freshness({ scan, demoData, tasksAt, runsAt, runsLive, onRescan }: {
  scan: ProjectScanState; demoData: boolean; tasksAt: string | null; runsAt: string | null; runsLive: boolean; onRescan?: () => void | Promise<void>;
}) {
  const now = useNow(15_000);
  const [refreshing, setRefreshing] = useState(false);
  const projects = demoData ? "Example projects (no scan in the browser)" : `Projects scanned ${scan.lastSuccessAt ? formatWhen(scan.lastSuccessAt, { now }) : "not yet"}`;
  const runs = runsLive ? `runs ${age(runsAt, now)} · live updates` : `runs ${age(runsAt, now)}`;
  async function refresh() {
    setRefreshing(true);
    try { await Promise.allSettled([onRescan?.(), refreshActionQueue(), refreshDelegationRuns()]); }
    finally { setRefreshing(false); }
  }
  return <button type="button" className="command-board-freshness" onClick={() => void refresh()} disabled={refreshing || scan.scanning}
    title="Rescan projects and re-read tasks and delegation runs">
    <RefreshCw size={11} aria-hidden="true" />
    <span>{refreshing || scan.scanning ? "Refreshing projects, tasks and runs…" : `${projects} · tasks ${age(tasksAt, now)} · ${runs}`}</span>
  </button>;
}

function OwnerChip({ row }: { row: ProjectCommandState }) {
  const owner = ownerLabels[row.nextMoveOwner ?? "UNKNOWN"];
  return <span className={`command-owner-chip owner-${(row.nextMoveOwner ?? "unknown").toLowerCase()}`}>Owner: {owner}</span>;
}

function AttentionLine({ items }: { items: AttentionItem[] }) {
  if (!items.length) return null;
  return <p className="command-attention-line"><span className="command-attention-line__label">Attention</span>
    {items.map((item, i) => <span key={i} className="command-attention-line__item">{item.text}<small> · {item.source}</small></span>)}
  </p>;
}

function ProjectRow({ row, onOpen }: { row: ProjectCommandState; onOpen: (projectId: string) => void }) {
  const pinned = isPinnedStatus(row.operationalStatus);
  // A checkpoint already on the row is not repeated as an observation.
  const attention = row.operatorDecisions.length ? row.attention.filter(item => item.kind !== "review") : row.attention;
  const change = row.lastMeaningfulChange;
  const footer = [
    row.openTaskCount === null ? "Tasks unavailable" : row.openTaskCount > 0 ? plural(row.openTaskCount, "open task", "open tasks") : null,
    `Vault: ${row.project.status}${row.project.statusSource === "inferred" ? " (inferred)" : ""}`,
    change ? `${change.source} ${formatWhen(change.at)}` : "Change date unavailable"
  ].filter((item): item is string => Boolean(item));
  return <article className={`command-project-row status-${row.operationalStatus.toLowerCase()} ${pinned ? "is-pinned" : ""}`} aria-label={row.project.name}>
    <header>
      <h3>{row.project.name}</h3>
      <div className="command-project-chips">
        <span className="command-operational-status">{operationalStatusLabels[row.operationalStatus]}</span>
        <OwnerChip row={row} />
      </div>
    </header>
    {row.project.summary && <p className="command-project-purpose">{row.project.summary}</p>}
    <div className={`command-project-columns ${row.recommendationGeneric ? "is-two" : ""}`}>
      <section><h4>STATE</h4><p>{row.currentState}</p></section>
      <section><h4>NEXT MOVE</h4>{pinned && row.operatorDecisions.length ? <ul className="command-checkpoints">
        {row.operatorDecisions.map(decision => <li key={decision.runId}>
          <p>{decision.text}</p>
          <button type="button" className="ghost-action" onClick={() => onOpen(row.project.id)}>Review<span className="projects-sr-only"> {decision.phase === "waiting" ? "plan" : "result"} in {row.project.name}</span> →</button>
        </li>)}
      </ul> : <p>{row.nextMove || (row.nextMoveOwner === "NONE" ? "No current move recorded or expected." : "Not recorded")}</p>}</section>
      {!row.recommendationGeneric && <section className="command-recommendation"><h4>Ω OLYMPUS RECOMMENDS</h4><p>{row.olympusRecommendation}</p></section>}
    </div>
    <AttentionLine items={attention} />
    <footer><div>{footer.map(item => <span key={item}>{item}</span>)}</div>
      <button className="ghost-action" onClick={() => onOpen(row.project.id)}>Open<span className="projects-sr-only"> {row.project.name}</span> →</button></footer>
  </article>;
}

function ProjectDetail({ row, runs, tasks, sessionBoundary, onOpenNote }: {
  row: ProjectCommandState; runs: DelegationRun[] | null; tasks: ActionQueueTask[];
  sessionBoundary: SessionBoundary | null; onOpenNote: (notePath: string) => void;
}) {
  const project = row.project;
  const commits = sessionBoundary?.previousSessionStartedAt ? project.sinceSessionCommits : project.recentCommits;
  const blocker = prepareBlocker(project, runs, isTauriRuntime());
  return <>
    <section className="command-project-detail" aria-label={`${project.name} detail`}>
      <div className="command-detail-chips">
        <span className="command-operational-status">{operationalStatusLabels[row.operationalStatus]}</span>
        <OwnerChip row={row} />
        <span className={`project-state ${project.status} ${project.statusSource}`}
          title={project.statusSource === "declared" ? `Declared in ${project.notePath ?? "the vault"}` : "No project note declares a status for this one"}>
          Vault: {STATUS_LABELS[project.status] ?? STATUS_LABELS.unclassified}{project.statusSource === "inferred" ? " (inferred)" : ""}
        </span>
      </div>
      <ProjectFacts project={project} onOpenNote={onOpenNote} />

      {row.attention.length > 0 && <section className="command-detail-attention" aria-label="Attention">
        <h3>Attention <span>observations · not blockers</span></h3>
        <ul>{row.attention.map((item, i) => <li key={i}>{item.text}<small> · {item.source}</small></li>)}</ul>
      </section>}

      <div className="command-detail-grid">
        <section><h3>Current state</h3><p>{row.currentState}</p></section>
        <section><h3>Recorded next action <span>execution unverified</span></h3><p>{row.nextAction || "Not recorded"}</p></section>
        <section className="command-recommendation"><h3>Ω Olympus recommends <span>rule-based suggestion · not approval</span></h3><p>{row.olympusRecommendation}</p></section>
      </div>
      <div className="command-board-actions"><button className="ghost-action" onClick={() => reviewProjectContext([row])}>Review with Olympus</button></div>
    </section>

    {project.path ? <DelegationPanel project={project} blocker={blocker} /> : null}

    <section className="command-project-detail">
      <h3>Project intent</h3>
      <p>{project.vision || project.summary || "No vision recorded."}</p>
      {project.vision && <p className="command-detail-note">{project.visionReviewedAt ? `Vision reviewed ${dayLabel(`${project.visionReviewedAt}T00:00:00`)}` : "Vision has no review date."}</p>}
      <h3>{sessionBoundary?.previousSessionStartedAt ? "Commits since previous session" : "Recent commits"}</h3>
      {commits.length ? <ul className="command-commit-list">{commits.map((commit,i) => <li key={i}><span>{commit.subject}</span><time dateTime={commit.at}>{formatWhen(commit.at)}</time></li>)}</ul>
        : <p className="command-detail-note">{sessionBoundary?.previousSessionStartedAt ? "No commits since the previous Olympus session." : "No commits in the last 24 hours."}</p>}
      <p className="command-detail-note">Blockers and general operator decisions are not recorded as structured fields. Delegation checkpoints appear above.</p>
    </section>
    <ProjectTasks project={project} tasks={tasks} />
  </>;
}

function ProjectFacts({ project, onOpenNote }: { project: TrackedProject; onOpenNote: (notePath: string) => void }) {
  const repoStateTone = project.repoState === "git-active" ? "active" : project.repoState === "git-pending" ? "pending" : "neutral";
  return <dl className="command-project-facts">
    <div><dt>Branch</dt><dd className="tabular-data"><GitBranch size={12} aria-hidden="true" /> {project.branch || "—"}</dd></div>
    <div><dt>Checkout</dt><dd><span className={`project-repo-state ${repoStateTone}`}><span className="project-repo-dot" aria-hidden="true"></span>{REPO_STATE_LABELS[project.repoState]}</span></dd></div>
    <div><dt>Last commit</dt><dd>{project.lastCommitAt ? <><span className="command-facts-commit">{project.lastCommit}</span> · {formatWhen(project.lastCommitAt)}</> : "No commits yet"}</dd></div>
    <div><dt>Folder</dt><dd title={project.path || undefined}>{project.path ? formatPath(project.path) : "No folder under the projects root"}</dd></div>
    {project.linkedWorktrees.length > 0 && <div className="is-wide"><dt>Worktrees</dt><dd><ul className="command-worktrees">{project.linkedWorktrees.map(worktree => <li key={worktree.path}>
      <span className="tabular-data">{worktree.branch}</span>
      <span className={worktree.changedFiles > 0 ? "pending" : "quiet"}>{worktree.changedFiles > 0 ? plural(worktree.changedFiles, "uncommitted file", "uncommitted files") : `clean at ${worktree.head || "HEAD"}`}</span>
    </li>)}</ul></dd></div>}
    {project.notePath && <div><dt>Note</dt><dd><button className="ghost-action" onClick={() => onOpenNote(project.notePath!)}>Open project note</button></dd></div>}
  </dl>;
}

function ProjectTasks({ project, tasks }: { project: TrackedProject; tasks: ActionQueueTask[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? tasks : tasks.slice(0, VISIBLE_TASK_LIMIT);
  const hidden = tasks.length - visible.length;
  return <section className="command-project-detail" aria-label="Open tasks">
    <h3>Open tasks <span className="tabular-data"><ListChecks size={12} aria-hidden="true" /> {tasks.length}</span></h3>
    {tasks.length === 0 ? <p className="command-detail-note">No open tasks{project.notePath ? ` in ${project.notePath}` : ""}.</p> : <div className="project-tasks">
      {visible.map((task) => <TaskLine key={task.id} task={task} />)}
      {hidden > 0 || expanded ? <button type="button" className="project-tasks-toggle" onClick={() => setExpanded((value) => !value)}>{expanded ? "Show fewer" : `${hidden} more`}</button> : null}
    </div>}
  </section>;
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
