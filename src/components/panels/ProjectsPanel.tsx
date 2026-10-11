import {useOrganizer} from "../../hooks/useOrganizer";
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
import type { DelegationRun } from "../../services/delegation";
import type { ProjectScanState } from "../../hooks/useDashboardData";
import { isTauriRuntime } from "../../services/launcher";
import { clockTime, dayLabel, formatWhen, toDate } from "../../services/time";
import { readViewSlice, writeViewSlice } from "../../state/viewState";
import { DelegationPanel } from "./DelegationPanel";
import { OrganizerPanel } from "./organizer/OrganizerPanel";
import "./projects.css";
import {ProjectEcosystem, ProjectEmblem, projectColor} from "./ProjectEcosystem";
import "./projectPortfolio.css";
import {ProjectAddDialog, ProjectBrief} from "./ProjectManagement";
import {projectMembership, publishProjectMember, type ProjectMember} from "../../services/projectMembership";

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
  projects: scannedProjects,
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
  const native=isTauriRuntime();
  const [members,setMembers]=useState<ProjectMember[]|null>(null);
  const [addTarget,setAddTarget]=useState<ProjectMember|null|undefined>(undefined);
  const [membershipError,setMembershipError]=useState("");
  const [membershipBusy,setMembershipBusy]=useState("");
  const [removed,setRemoved]=useState<ProjectMember|null>(null);
  const membershipLock=useRef(false),membershipVersion=useRef(0);
  const reloadMembers=useCallback(async()=>{if(!native)return;const version=++membershipVersion.current;try{const m=await projectMembership.list();if(version===membershipVersion.current){setMembers(m);setMembershipError("")}}catch(e){if(version===membershipVersion.current){setMembers(null);setMembershipError(String(e))}}},[native]);
  useEffect(()=>{void reloadMembers();return()=>{membershipVersion.current++}},[reloadMembers,scannedProjects]);
  const updateMember=useCallback((m:ProjectMember)=>{membershipVersion.current++;setMembers(current=>[...(current??[]).filter(p=>p.project.id!==m.project.id),m]);publishProjectMember(m);void Promise.resolve().then(()=>onRescan?.()).catch(e=>setMembershipError(String(e)))},[onRescan]);
  const allProjects=useMemo(()=>native?(members??[]).filter(m=>m.visibility==="visible").map(m=>scannedProjects.find(p=>p.id===m.project.id)??m.project):scannedProjects,[native,members,scannedProjects]);
  async function changeVisibility(member:ProjectMember,visibility:"visible"|"removed"){
    if(membershipLock.current)return;membershipLock.current=true;setMembershipBusy(member.project.id);setMembershipError("");
    try{const updated=await projectMembership.visibility(member.project.id,visibility);updateMember(updated);setRemoved(visibility==="removed"?updated:null);if(projectFilter===member.project.id&&visibility==="removed")onClearFilter?.()}
    catch(e){setMembershipError(String(e))}finally{membershipLock.current=false;setMembershipBusy("")}
  }
  function linked(member:ProjectMember){setAddTarget(undefined);updateMember(member);onFocusProject(member.project.id);setMembershipError("");setMembershipBusy(member.project.id);
    void projectMembership.inspect(member.project.id).then(updateMember).catch(e=>setMembershipError(`Project saved. ${String(e)}`)).finally(()=>setMembershipBusy(""));
  }
  const [status, setStatus] = useState<ObsidianActionResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<OperationalStatus | "ALL">("ALL");
  useEffect(() => {
    if (!requestedStatus || requestedStatus.revision === consumedVoiceRevision) return;
    consumedVoiceRevision = requestedStatus.revision;
    setFilter(requestedStatus.status);
  }, [requestedStatus]);
  const [portfolioView,setPortfolioView]=useState<"cards"|"ecosystem">("cards");
  const [search,setSearch]=useState("");
  const [sort, setSort] = useState<"priority" | "recent" | "name">("priority");
  const { tasks, error: tasksError, loading: tasksLoading, lastSuccessAt: tasksAt } = useActionQueue();
  const { data: runs, error: runsError, loading: runsLoading, lastSuccessAt: runsAt } = useDelegationRuns();
  const organizer=useOrganizer();
  const tasksAvailable = !tasksError && !tasksLoading, runsAvailable = !runsError && !runsLoading;
  const rows = useMemo(() => buildProjectCommandBoard(allProjects, tasks, runs, { tasks: tasksAvailable, runs: runsAvailable },undefined,demoData?undefined:{rows:organizer.data,available:!organizer.error&&organizer.lastSuccessAt!==null}),
    [allProjects, tasks, runs, tasksAvailable, runsAvailable,organizer.data,organizer.error,organizer.lastSuccessAt,demoData]);
  const selected = rows.find(row => row.project.id === projectFilter);
  const visible = sortCommandProjects(rows.filter(row => (filter === "ALL" || row.operationalStatus === filter) && row.project.name.toLowerCase().includes(search.toLowerCase())), sort);
  const { perProject, unattributed } = attributeTasks(allProjects, tasks);
  const warnings = [...noteWarnings, ...allProjects.flatMap(project => project.warnings)];
  const scanLoading = !demoData && (projectScan.status === "loading" || (native&&members===null&&!membershipError));

  // Board and detail scroll survive a mode switch (review U3). Tracked in a ref
  // and written on the way out: writing the slice on every scroll event would
  // re-render App, which subscribes to it.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollTop = useRef(0);
  useLayoutEffect(()=>{if(scrollRef.current){scrollRef.current.scrollTop=0;scrollTop.current=0}},[portfolioView]);
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

  return <section className={`dashboard-panel projects-panel project-command portfolio-art ${projectFilter ? "portfolio-detail" : "portfolio-overview"} ${focusMode ? "focus-projects" : ""}`}>
    <header className="command-board-heading">
      <div><h2>{selected ? selected.project.name : <>Projects <span className="portfolio-count">{rows.length}</span></>}</h2></div>
      {demoData&&<span className="portfolio-demo" title="Browser preview · example project data. Desktop provides live records.">Demo data</span>}
      {!projectFilter&&<div className="portfolio-switch" role="group" aria-label="Project view"><button aria-pressed={portfolioView==="cards"} onClick={()=>setPortfolioView("cards")}>Cards</button><button aria-pressed={portfolioView==="ecosystem"} onClick={()=>setPortfolioView("ecosystem")}>Ecosystem</button></div>}
      {projectFilter ? <button className="ghost-action" onClick={backToBoard}>← All projects</button> : <button className="command-project-action" disabled={!native} title={native?undefined:"Add projects in the desktop app"} onClick={()=>setAddTarget(null)}>+ Add project</button>}
    </header>
    <div className="command-board-scroll" ref={scrollRef} onScroll={event => { scrollTop.current = event.currentTarget.scrollTop; }}>
      <div className="command-board-inner">
        {addTarget!==undefined&&<ProjectAddDialog target={addTarget} onClose={()=>setAddTarget(undefined)} onLinked={linked}/>}
        {membershipError&&<div role="alert" className="project-form-error"><p>{membershipError}</p><button className="ghost-action" onClick={()=>void reloadMembers()}>Reload projects</button></div>}
        {membershipBusy&&<p role="status" className="project-help">Updating project…</p>}
        {removed&&<div role="status" className="project-removal-feedback"><span>{removed.project.name} removed from the dashboard. Files and history are kept.</span><button disabled={!!membershipBusy} onClick={()=>void changeVisibility(removed,"visible")}>Undo</button></div>}
        {!projectFilter&&members?.some(m=>m.visibility!=="visible")&&<div className="project-management-bar">{members&&members.some(m=>m.visibility!=="visible")&&<details><summary>Available &amp; removed projects</summary><div className="project-membership-list">{members.filter(m=>m.visibility!=="visible").map(m=><div key={m.project.id}><span>{m.project.name}<small> · {m.visibility==="removed"?"Removed":"Discovered"}</small></span><button disabled={!!membershipBusy} onClick={()=>void changeVisibility(m,"visible")}>{m.visibility==="removed"?"Restore":"Add"}</button></div>)}</div></details>}</div>}
        <ScanStatus scan={projectScan} demoData={demoData} empty={allProjects.length === 0} root={projectsRootPath} onRescan={onRescan} />

        {projectFilter && (tasksError || runsError) && <p role="status" className="command-board-notice">Some sources are unavailable. Counts and execution state may be incomplete.</p>}
        {projectFilter && boardWarnings}
        {selected&&members?.find(m=>m.project.id===selected.project.id)&&<details key={selected.project.id} className="project-brief-disclosure" open={!selected.project.vision}><summary>Project brief &amp; sources</summary><ProjectBrief member={members.find(m=>m.project.id===selected.project.id)!} onChanged={updateMember} onLink={()=>setAddTarget(members.find(m=>m.project.id===selected.project.id)!)}/></details>}
        {projectFilter && !selected ? (scanLoading ? <BoardSkeleton /> : <p className="command-board-notice">Project is no longer available. Return to the portfolio.</p>) : selected ? <ProjectDetail
            row={selected} runs={runsAvailable ? runs : null} tasks={perProject.get(selected.project.id) ?? []}
            sessionBoundary={sessionBoundary} onOpenNote={onOpenNote} />
        : scanLoading ? <BoardSkeleton /> : rows.length === 0 ? boardWarnings : <>
          <div className="command-board-controls">{(tasksError || runsError || ((tasksLoading || runsLoading) && !scanLoading)) && <details className="portfolio-source-status"><summary>{tasksError || runsError ? "Some sources unavailable" : "Reading task records"}</summary><p>Counts and execution state may be incomplete. Unavailable task counts are shown as unknown.</p></details>}<input className="portfolio-search" aria-label="Search projects" placeholder="Search projects…" value={search} onChange={e=>setSearch(e.target.value)}/>
            <label className="command-board-sort">Show <select aria-label="Filter projects by operational status" value={filter} onChange={event => setFilter(event.target.value as typeof filter)}>
              <option value="ALL">All projects ({rows.length})</option>
              {operationalStatuses.filter(value => value === filter || counts(value) > 0).map(value => <option key={value} value={value}>{operationalStatusLabels[value]} ({counts(value)})</option>)}
            </select></label>
            <label className="command-board-sort">Sort <select value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="priority">Priority</option><option value="recent">Recently changed</option><option value="name">Name</option></select></label>
          </div>
          {portfolioView==="ecosystem" ? <ProjectEcosystem rows={visible} onOpen={openProject}/> : <div className="command-board-rows">
            {visible.map(row => <ProjectRow key={row.project.id} row={row} onOpen={openProject} management={native&&members?.some(m=>m.project.id===row.project.id)?<details className="project-row-options" onKeyDown={event=>{if(event.key==="Escape"){event.currentTarget.open=false;event.currentTarget.querySelector("summary")?.focus();event.stopPropagation()}}}><summary aria-label={`Options for ${row.project.name}`}>•••</summary><div><button disabled={!!membershipBusy} onClick={()=>setAddTarget(members!.find(m=>m.project.id===row.project.id)!)}>Link another source</button><button disabled={!!membershipBusy||!!row.openRun||row.operatorDecisions.length>0} onClick={()=>void changeVisibility(members!.find(m=>m.project.id===row.project.id)!,"removed")}>Remove from dashboard</button><p>{row.openRun||row.operatorDecisions.length?"Resolve active work or its review first.":"Keeps project files and history. You can restore it later."}</p></div></details>:undefined}/>)}
            {!visible.length && <p className="command-board-notice">No projects match this status.</p>}
          </div>}
          {boardWarnings}
          {unattributed.length > 0 && <details className="command-unattributed"><summary>{plural(unattributed.length, "task", "tasks")} without a project</summary><UnattributedTasks tasks={unattributed} /></details>}
        </>}
        <details className="command-portfolio-tools">
          <summary>Sources &amp; project tools</summary>
          {rows.length>0&&<button className="ghost-action" onClick={() => reviewProjectContext(rows)}>Review priorities with Olympus →</button>}
          <Freshness scan={projectScan} demoData={demoData} tasksAt={tasksAt} runsAt={runsAt} runsLive={isTauriRuntime() && runsAvailable} onRescan={onRescan} />
          <p>Recommendations use recorded project information and rules. They are suggestions, not approved work. Git observations do not establish project readiness.</p>
          <button className="ghost-action" onClick={() => void handleSyncCanvas()} disabled={syncing}>{syncing ? "Updating…" : "Update Canvas"}</button>
          {status && <p role="status" className={`section-copy action-feedback ${status.tone}`}>{status.message}</p>}
        </details>
      </div>
    </div>
  </section>;
}

function ScanStatus({ scan, demoData, empty, root, onRescan }: { scan: ProjectScanState; demoData: boolean; empty: boolean; root?: string; onRescan?: () => void | Promise<void> }) {
  if (demoData) return null;
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
    <p>No projects on your dashboard yet. Add a folder, repository, or idea to get started. Previously removed projects can be restored above.</p><details><summary>Discovery sources</summary><p>Folders under <code>{root || "the projects root"}</code> and vault notes in <code>01 - Projects</code>.</p></details>{onRescan && <button type="button" className="ghost-action command-scan-banner__retry" disabled={scan.scanning} onClick={() => void onRescan()}><RefreshCw size={12} aria-hidden="true" />{scan.scanning ? "Scanning…" : "Rescan"}</button>}
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

function ProjectRow({ row, onOpen, management }: { row: ProjectCommandState; onOpen: (projectId: string) => void; management?:React.ReactNode }) {
  const pinned = isPinnedStatus(row.operationalStatus);
  const decision = row.operatorDecisions[0];
  const action = decision ? (decision.phase === "waiting" ? "Review plan" : "Review result")
    : row.openRun ? "View progress" : row.operationalStatus === "COMPLETE" ? "View project" : "Continue project";
  return <article className={`command-project-row status-${row.operationalStatus.toLowerCase()} ${pinned ? "is-pinned" : ""}`} aria-label={row.project.name} style={{"--project-hue":projectColor(row.project.id)} as React.CSSProperties}>
    <header>
      <ProjectEmblem id={row.project.id}/><h3>{row.project.name}</h3>
      {row.operationalStatus !== "UNKNOWN" && <span className="command-operational-status">{operationalStatusLabels[row.operationalStatus]}</span>}
      {management}
    </header>
    <p className={`command-project-purpose ${row.project.vision.trim() ? "" : "is-missing"}`}>{row.project.vision.trim() || "This project's purpose and vision haven't been recorded yet."}</p>
    <div className="portfolio-workload" title="Open tasks recorded in the vault task ledger">{row.openTaskCount===null?"Tasks unknown":`${row.openTaskCount} open tasks`}</div>
    <div className="command-project-next">
      <section className="command-recommendation">
        <h4>{row.nextMove ? "Next step" : "Olympus recommends"}</h4>
        <p title={row.nextMove || row.olympusRecommendation}>{row.nextMove || row.olympusRecommendation}</p>
      </section>
      <button className="command-project-action" onClick={() => onOpen(row.project.id)}>{action==="Continue project"?<>Continue<span className="projects-sr-only"> project</span></>:action}<span className="projects-sr-only"> {row.project.name}</span><span aria-hidden="true"> ↗</span></button>
    </div>
    <details className="command-row-details">
      <summary>Project details{row.operatorDecisions.length > 1 ? ` · ${row.operatorDecisions.length} reviews pending` : ""}</summary>
      <p><strong>Olympus recommends</strong> · {row.olympusRecommendation}</p>
      <p>{row.currentState}</p>
      <OwnerChip row={row} />
      {row.operationalStatus === "UNKNOWN" && <p>Operational status has not been confirmed.</p>}
      {row.operatorDecisions.length > 1 && <ul>{row.operatorDecisions.map(decision => <li key={decision.runId}>{decision.text}</li>)}</ul>}
      {row.attention.length > 0 && <ul>{row.attention.map((item,i) => <li key={i}>{item.text} <small>· {item.source}</small></li>)}</ul>}
      {row.lastMeaningfulChange && <p>{row.lastMeaningfulChange.source} · {formatWhen(row.lastMeaningfulChange.at)}</p>}
    </details>
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
      <p className="command-detail-vision">{project.vision.trim() || "This project's purpose and vision haven't been recorded yet."}</p>
      <div className="command-detail-grid">
        <section className="command-recommendation"><h3>Ω Olympus recommends <span>rule-based suggestion · not approval</span></h3><p>{row.olympusRecommendation}</p></section>
      </div>
      <div className="command-board-actions"><button className="ghost-action" onClick={() => reviewProjectContext([row])}>Review with Olympus</button></div>
    </section>

    <OrganizerPanel key={project.id} projectId={project.id} blocker={blocker} />
    {project.path ? <details className="command-project-detail" open={Boolean(row.openRun)}><summary>{row.openRun ? "Current work & reviews" : "Other coding runs"}</summary><DelegationPanel project={project} blocker={blocker} /></details> : null}

    <details className="command-project-detail command-project-background">
      <summary>Project background &amp; activity</summary>
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

      <h3>Current state</h3><p>{row.currentState}</p>
      <h3>Recorded next action</h3><p>{row.nextAction || "Not recorded"}</p>
      {project.vision && <p className="command-detail-note">{project.visionReviewedAt ? `Vision reviewed ${dayLabel(`${project.visionReviewedAt}T00:00:00`)}` : "Vision has no review date."}</p>}
      <h3>{sessionBoundary?.previousSessionStartedAt ? "Commits since previous session" : "Recent commits"}</h3>
      {commits.length ? <ul className="command-commit-list">{commits.map((commit,i) => <li key={i}><span>{commit.subject}</span><time dateTime={commit.at}>{formatWhen(commit.at)}</time></li>)}</ul>
        : <p className="command-detail-note">{sessionBoundary?.previousSessionStartedAt ? "No commits since the previous Olympus session." : "No commits in the last 24 hours."}</p>}
      <p className="command-detail-note">Blockers and general operator decisions are not recorded as structured fields. Delegation checkpoints appear above.</p>
      <ProjectTasks project={project} tasks={tasks} />
    </details>
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
