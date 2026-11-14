import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronRight, Crosshair, Layers, SlidersHorizontal, X } from "lucide-react";
import { Modal } from "../Modal";
import { AgentEmblem } from "./AgentEmblem";
import { SkillRunResult } from "./SkillRunResult";
import { agentEventsSnapshot, engineLabel, subscribeAgentEvents } from "../../services/agentEvents";
import { skillRunsSnapshot, subscribeSkillRuns } from "../../services/skillRuns";
import { DECK_ROLES, STATUS_LABEL, buildDeck, isLive, type DeckAgent, type DeckStatus } from "../../services/activityDeck";
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
  onOpenArmory: () => void;
  onInspectProfile: (id: string) => void;
  /** Rendered at the foot of the deck: the resource drawer and any caution the Armory raises. */
  children?: ReactNode;
}

const since = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return minutes < 1 ? "just now" : minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.round(minutes / 60)} h ago` : new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
};

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
export function ActivityDeck({ roster, onOpenArmory, onInspectProfile, children }: Props) {
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
      <button type="button" className="deck-manage" onClick={onOpenArmory} aria-haspopup="dialog" aria-label="Open the Armory" title="Armory: agents, plugins and skills"><SlidersHorizontal size={14}/></button>
    </header>

    {operation ? <button type="button" className="deck-operation" data-status={operation.status} onClick={() => setInspecting(true)} aria-haspopup="dialog" aria-label={`Inspect operation: ${operation.title}`}>
      <Crosshair className="deck-operation-mark" size={30} strokeWidth={1.1} aria-hidden="true"/>
      <span className="deck-operation-copy">
        <small>{live ? "Active operation" : `Last operation · ${since(operation.finishedAt ?? operation.startedAt)}`}</small>
        <strong>{operation.title}</strong>
        <span>{operation.line}{operation.alsoRunning ? ` · ${operation.alsoRunning} more running` : ""}</span>
      </span>
      {operation.progress && live && <span className="deck-operation-count" aria-label={`Stage ${operation.progress.done} of ${operation.progress.total}`}>{operation.progress.done}/{operation.progress.total}</span>}
      {live && <span className="deck-bar" data-measured={percent !== null || undefined} role={percent !== null ? "progressbar" : undefined} aria-valuemin={percent !== null ? 0 : undefined} aria-valuemax={percent !== null ? 100 : undefined} aria-valuenow={percent ?? undefined}><i style={percent !== null ? { width: `${percent}%` } : undefined}/></span>}
    </button> : <div className="deck-operation deck-operation--idle">
      <Crosshair className="deck-operation-mark" size={30} strokeWidth={1.1} aria-hidden="true"/>
      <span className="deck-operation-copy"><small>No active operation</small><span>Olympus is standing by. Ask in the chat to begin.</span></span>
    </div>}

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
          <span className="deck-status" data-status={last?.status ?? "idle"}>{last ? STATUS_LABEL[last.status] : entry.readiness}</span>
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
