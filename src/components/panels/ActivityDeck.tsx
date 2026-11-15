import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { CheckCircle2, ChevronRight, Crosshair, Layers, X } from "lucide-react";
import { Modal } from "../Modal";
import { AgentEmblem } from "./AgentEmblem";
import { SkillRunResult } from "./SkillRunResult";
import { agentEventsSnapshot, engineLabel, subscribeAgentEvents } from "../../services/agentEvents";
import { setAgentHighlight } from "../../services/agentConstellation";
import { skillRunsSnapshot, subscribeSkillRuns } from "../../services/skillRuns";
import { DECK_ROLES, STATUS_LABEL, buildDeck, classifyFailure, deckName, isLive, operationTimeline, type DeckAgent, type DeckStatus, type TimelineEntry } from "../../services/activityDeck";
import "./activityDeck.css";

/** What the Armory already knows about an Olympian: its catalog entry and any recorded mission step it holds. */
export interface DeckRosterEntry {
  id: string; name: string; description: string;
  /** Idle, Planned, Unverified or Unavailable: never more ready than the catalog says. */
  readiness: string;
  /** A recorded mission step outside the skill runner (research, coding delegation), when one is in progress. */
  mission: { title: string; step: string; waiting: boolean } | null;
  bind: Record<string, unknown>;
}
interface Props {
  roster: readonly DeckRosterEntry[] | null;
  /** The column's Activity / Armory switch, drawn under the heading. */
  tabs?: ReactNode;
  onInspectProfile: (id: string) => void;
  /** Rendered at the foot of the deck: the resource drawer and any caution the Armory raises. */
  children?: ReactNode;
}

const since = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.round(minutes / 60)} h ago` : new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
};

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
const span = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m`; };
/** Elapsed time from a recorded start. Ticks every second on its own, so nothing else re-renders. */
function Elapsed({ from, to }: { from: string; to: string | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (to) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [to]);
  return <>{span((to ? new Date(to).getTime() : now) - new Date(from).getTime())}</>;
}
const QUIET_MS = 3 * 60_000;

function Timeline({ entries }: { entries: TimelineEntry[] }) {
  const [all, setAll] = useState(false);
  if (!entries.length) return null;
  const shown = all ? entries : entries.slice(-3);
  const who = (entry: TimelineEntry) => entry.to ? `${deckName(entry.agent)} → ${deckName(entry.to)}` : deckName(entry.agent);
  return <section className="deck-section deck-timeline" aria-label="Operation timeline">
    <h3>Timeline <span>({entries.length})</span></h3>
    <ol>{shown.map(entry => <li key={entry.key} data-kind={entry.kind}><time dateTime={entry.at}>{clock(entry.at)}</time><span><b>{who(entry)}</b> {entry.text}</span></li>)}</ol>
    {entries.length > 3 && <button type="button" className="deck-link" aria-expanded={all} onClick={() => setAll(!all)}>{all ? "Show the latest" : `Show all ${entries.length}`}</button>}
  </section>;
}

function AgentCard({ agent, open, onToggle, bind }: { agent: DeckAgent; open: boolean; onToggle: () => void; bind?: Record<string, unknown> }) {
  const role = DECK_ROLES[agent.agent];
  return <li className="deck-agent" data-status={agent.status} data-open={open || undefined}>
    <button type="button" className="deck-agent-head" aria-expanded={open} onClick={onToggle} {...bind}>
      <span className="deck-emblem"><AgentEmblem id={agent.agent} size={22}/></span>
      <span className="deck-agent-copy"><strong>{role?.name ?? agent.agent}</strong><span>{role?.role ?? "Agent"}</span></span>
      <span className="deck-status" data-status={agent.status}>{STATUS_LABEL[agent.status]}</span>
      <span className="deck-agent-line">{agent.activity}</span>
      {(agent.status === "running" || agent.status === "coordinating") && <span className="deck-pulse" aria-hidden="true"/>}
    </button>
    {open && <div className="deck-agent-detail">
      {agent.assignment && <><h5>Assignment</h5><p>{agent.assignment}</p></>}
      {agent.recent.length > 0 && <><h5>Recent activity</h5><ol>{agent.recent.map(step => <li key={step.id}>{step.text}</li>)}</ol></>}
      {agent.finding && <><h5>Reported</h5><p>{agent.finding}</p></>}
      {agent.error && <><h5>Stopped</h5><p className="deck-error">{agent.error}</p></>}
      {!agent.assignment && !agent.recent.length && !agent.finding && !agent.error && <p>Nothing recorded yet.</p>}
    </div>}
  </li>;
}

/**
 * The left column of Command: who is working, on what, and how far along.
 * Everything shown is recorded state (`services/activityDeck.ts`); when
 * nothing is running the deck is quiet rather than filled.
 */
export function ActivityDeck({ roster, tabs, onInspectProfile, children }: Props) {
  const { runs, skills } = useSyncExternalStore(subscribeSkillRuns, skillRunsSnapshot);
  const events = useSyncExternalStore(subscribeAgentEvents, agentEventsSnapshot);
  const deck = buildDeck(runs, events, skills);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [profile, setProfile] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);
  // "min ago" is the only thing here that changes without a recorded event.
  const [, tick] = useState(0);
  useEffect(() => { const timer = window.setInterval(() => tick(n => n + 1), 60_000); return () => window.clearInterval(timer); }, []);

  const operation = deck.operation;
  const timeline = operation ? operationTimeline(runs, events, operation.id) : [];
  // A recorded hand-off or return briefly lights its receiving Olympian through the existing
  // highlight, once, and only when it just happened: history never replays as motion.
  const lastHandoff = [...timeline].reverse().find(entry => entry.kind === "handoff" || entry.kind === "return");
  const handoffKey = lastHandoff && Date.now() - new Date(lastHandoff.at).getTime() < 15_000 ? lastHandoff.key : null;
  useEffect(() => {
    const target = handoffKey && lastHandoff?.to;
    if (!target) return;
    const token = {};
    setAgentHighlight(token, target);
    const timer = window.setTimeout(() => setAgentHighlight(token, null), 1600);
    return () => { window.clearTimeout(timer); setAgentHighlight(token, null); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoffKey]);
  const live = operation?.status === "running";
  // Mission steps recorded outside the skill runner keep their place: an Olympian holding one is working.
  const missionAgents: DeckAgent[] = (roster ?? []).filter(entry => entry.mission && !deck.agents.some(agent => agent.agent === entry.id && isLive(agent.status)))
    .map(entry => ({ agent: entry.id, status: (entry.mission!.waiting ? "blocked" : "running") as DeckStatus, activity: entry.mission!.waiting ? "Waiting for your approval" : entry.mission!.step, runId: null, assignment: entry.mission!.title, recent: [], finding: null, error: null }));
  const cards = [...(live ? deck.agents : deck.agents.filter(agent => isLive(agent.status))), ...missionAgents];
  const working = cards.filter(agent => isLive(agent.status)).length;
  const settled = new Map((live ? [] : deck.agents).map(agent => [agent.agent, agent]));
  const order = Object.keys(DECK_ROLES);
  const rank = (id: string) => { const at = order.indexOf(id); return at < 0 ? order.length : at; };
  const idle = (roster ?? []).filter(entry => !cards.some(agent => agent.agent === entry.id)).sort((a, b) => rank(a.id) - rank(b.id));
  const bindFor = (id: string) => roster?.find(entry => entry.id === id)?.bind;
  const percent = operation?.progress ? Math.round(operation.progress.done / operation.progress.total * 100) : null;

  return <>
    <header className="armory-heading deck-heading">
      <Layers className="deck-heading-mark" size={26} strokeWidth={1.4} aria-hidden="true"/>
      <div><h2>Activity Deck</h2><p>Agent operations · {live || missionAgents.length ? "Live" : "Idle"}</p></div>
    </header>
    {tabs}

    {/* Delegations are Olympians holding live work right now: skill-runner agents and recorded mission steps. */}
    <p className="deck-delegations" data-active={working > 0 || undefined} role="status">
      <span className="deck-delegations-dot" aria-hidden="true"/>
      {working === 0 ? "No active delegations" : `${working} active delegation${working === 1 ? "" : "s"}`}
    </p>

    {operation ? <button type="button" className="deck-operation" data-status={operation.status} onClick={() => setInspecting(true)} aria-haspopup="dialog" aria-label={`Inspect operation: ${operation.title}`}>
      {operation.status === "completed" ? <CheckCircle2 className="deck-operation-mark" size={26} strokeWidth={1.4} aria-hidden="true"/> : <Crosshair className="deck-operation-mark" size={30} strokeWidth={1.1} aria-hidden="true"/>}
      <span className="deck-operation-copy">
        <span className="deck-operation-state"><small>{live ? "Active operation" : `Last operation · ${since(operation.finishedAt ?? operation.startedAt)}`}</small><em className="deck-status deck-outcome" data-status={operation.status}>{STATUS_LABEL[operation.status]}</em></span>
        <strong>{operation.title}</strong>
        {/* A settled card's badge already names its outcome; keep the line only when it says more. */}
        <span className="deck-operation-meta">{deckName(operation.lead)} · <Elapsed from={operation.startedAt} to={live ? null : operation.finishedAt}/>{live ? " elapsed" : ""}</span>
        {(live || operation.line.trim().toLowerCase() !== STATUS_LABEL[operation.status].toLowerCase() || operation.alsoRunning > 0) && <span>{operation.line}{operation.alsoRunning ? ` · ${operation.alsoRunning} more running` : ""}</span>}
      </span>
      {operation.progress && live && <span className="deck-operation-count" aria-label={`Stage ${operation.progress.done} of ${operation.progress.total}`}>{operation.progress.done}/{operation.progress.total}</span>}
      {live && operation.next && <span className="deck-operation-next">Next: {operation.next}</span>}
      {live && operation.lastEventAt && Date.now() - new Date(operation.lastEventAt).getTime() > QUIET_MS && <span className="deck-operation-quiet" role="status">No activity recorded since {clock(operation.lastEventAt)}</span>}
      {operation.status === "failed" && (() => { const failure = classifyFailure(operation.run?.error ?? operation.line); return <span className="deck-operation-blocker" data-kind={failure.kind}>{failure.label}</span>; })()}
      {live && <span className="deck-bar" data-measured={percent !== null || undefined} role={percent !== null ? "progressbar" : undefined} aria-valuemin={percent !== null ? 0 : undefined} aria-valuemax={percent !== null ? 100 : undefined} aria-valuenow={percent ?? undefined}><i style={percent !== null ? { width: `${percent}%` } : undefined}/></span>}
    </button> : <div className="deck-operation deck-operation--idle">
      <Crosshair className="deck-operation-mark" size={30} strokeWidth={1.1} aria-hidden="true"/>
      <span className="deck-operation-copy"><small>No active operation</small><span>Olympus is standing by. Ask in the chat to begin.</span></span>
    </div>}

    {operation && <Timeline key={operation.id} entries={timeline}/>}

    {cards.length > 0 && <section className="deck-section" aria-label="Agent activity">
      <h3>Agent activity <span>({working} active)</span></h3>
      <ul className="deck-agents">{cards.map(agent => { const key = `${agent.runId ?? "queued"}:${agent.agent}`; return <AgentCard key={key} agent={agent} open={expanded === key} onToggle={() => setExpanded(expanded === key ? null : key)} bind={bindFor(agent.agent)}/>; })}</ul>
    </section>}

    <section className="deck-section deck-idle" aria-label="Idle agents">
      <h3>Agents <span>(idle)</span></h3>
      {!roster ? <p className="deck-note">Reading the roster…</p> : idle.length === 0 ? <p className="deck-note">Every Olympian is assigned.</p> : <ul>{idle.map(entry => { const last = settled.get(entry.id); const open = profile === entry.id; return <li key={entry.id} data-open={open || undefined}>
        <button type="button" className="deck-idle-row" aria-expanded={open} onClick={() => setProfile(open ? null : entry.id)} {...entry.bind}>
          <span className="deck-emblem deck-emblem--small"><AgentEmblem id={entry.id} size={17}/></span>
          <strong>{entry.name}</strong>
          <span className="deck-status" data-status={entry.readiness.toLowerCase()}>{entry.readiness}</span>
          <ChevronRight size={13} aria-hidden="true"/>
        </button>
        {open && <div className="deck-agent-detail">
          <p>{entry.description}</p>
          {last && <p>{last.activity}{last.error ? `. ${last.error}` : ""}</p>}
          <button type="button" className="deck-link" onClick={() => onInspectProfile(entry.id)}>Open profile</button>
        </div>}
      </li>; })}</ul>}
    </section>

    <div className="deck-actions">
      {children}
      <button type="button" className="deck-link deck-diagnostics" onClick={() => window.dispatchEvent(new Event("olympus:open-diagnostics"))}>Diagnostics</button>
    </div>

    <Modal open={inspecting && !!operation} onClose={() => setInspecting(false)} title="Operation" showTitle={false} className="deck-dialog">
      {operation && <>
        <header><div><small>{operation.status === "running" ? "Active operation" : "Operation"}{operation.run ? ` · ${engineLabel(operation.run.engine)}` : ""}</small><h2>{operation.title}</h2><p data-status={operation.status}>{operation.line}</p></div><button type="button" className="armory-close" onClick={() => setInspecting(false)} aria-label="Close operation"><X size={18}/></button></header>
        <div className="deck-dialog-body">
          <ul className="deck-dialog-agents">{deck.agents.map(agent => <li key={`${agent.runId}:${agent.agent}`} data-status={agent.status}>
            <span className="deck-emblem deck-emblem--small"><AgentEmblem id={agent.agent} size={17}/></span>
            <div><strong>{DECK_ROLES[agent.agent]?.name ?? agent.agent} <span className="deck-status" data-status={agent.status}>{STATUS_LABEL[agent.status]}</span></strong>
              {agent.assignment && agent.runId !== operation.id && <p>{agent.assignment}</p>}
              <p>{agent.error ?? agent.finding ?? agent.activity}</p></div>
          </li>)}</ul>
          {operation.run && operation.run.status === "completed" && <section><h3>Result</h3><SkillRunResult run={operation.run}/></section>}
          <button type="button" className="deck-link" onClick={() => { setInspecting(false); window.dispatchEvent(new Event("olympus:open-diagnostics")); }}>Open the step-by-step record</button>
        </div>
      </>}
    </Modal>
  </>;
}
