import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { isTauriRuntime } from "./launcher";

/** One step of real agent work, as normalized by `commands/agent_events.rs`. */
export type AgentEventKind =
  | "run_started" | "thinking" | "message" | "file_read" | "file_edit" | "search"
  | "command" | "subagent_started" | "tool_call" | "tool_failed" | "result" | "error";

export interface AgentEvent {
  id: number;
  runId: string;
  engine: string;
  agent: string;
  kind: AgentEventKind;
  summary: string;
  detail: string | null;
  tool: string | null;
  path: string | null;
  subagent: boolean;
  createdAt: string;
}

/** The feed is a window on recent work, not an archive; SQLite keeps the rest. */
export const FEED_LIMIT = 200;

/** Adds events in id order, dropping repeats, and keeps only the newest `limit`. */
export function mergeAgentEvents(current: readonly AgentEvent[], incoming: readonly AgentEvent[], limit = FEED_LIMIT): AgentEvent[] {
  const byId = new Map<number, AgentEvent>();
  for (const event of current) byId.set(event.id, event);
  for (const event of incoming) byId.set(event.id, event);
  return [...byId.values()].sort((a, b) => a.id - b.id).slice(-limit);
}

export interface AgentRunGroup { runId: string; engine: string; agent: string; events: AgentEvent[]; active: boolean }

/** Groups a feed by run: runs in progress first, then the most recent. A run is in progress until it reports a result or error. */
export function groupAgentRuns(events: readonly AgentEvent[]): AgentRunGroup[] {
  const groups = new Map<string, AgentRunGroup>();
  for (const event of events) {
    let group = groups.get(event.runId);
    if (!group) groups.set(event.runId, group = { runId: event.runId, engine: event.engine, agent: event.agent, events: [], active: true });
    group.events.push(event);
    // A helper's own result ends the helper, not the run.
    if (!event.subagent) group.active = event.kind !== "result" && event.kind !== "error";
  }
  const last = (group: AgentRunGroup) => group.events[group.events.length - 1].id;
  return [...groups.values()].sort((a, b) => Number(b.active) - Number(a.active) || last(b) - last(a));
}

/** The agents with a run in progress, for anything that shows who is working. */
export function workingAgents(events: readonly AgentEvent[]): string[] {
  return [...new Set(groupAgentRuns(events).filter(group => group.active).map(group => group.agent))];
}

export const engineLabel = (engine: string) => engine === "claude-code" ? "Claude Code" : engine === "codex" ? "Codex" : engine === "ollama" ? "Local model" : engine;

let snapshot: AgentEvent[] = [];
const listeners = new Set<() => void>();
let started = false;

function publish(incoming: readonly AgentEvent[]) {
  const next = mergeAgentEvents(snapshot, incoming);
  if (next.length === snapshot.length && next.every((event, index) => event === snapshot[index])) return;
  snapshot = next;
  listeners.forEach(listener => listener());
}

function start() {
  if (started || !isTauriRuntime()) return;
  started = true;
  // Listen before loading, so an event that arrives during the load is not lost; ids make the overlap harmless.
  void listen<AgentEvent>("agent-event", event => publish([event.payload])).catch(() => undefined);
  void invoke<AgentEvent[]>("agent_events", { limit: FEED_LIMIT }).then(publish).catch(() => { started = false; });
}

export function subscribeAgentEvents(listener: () => void) {
  listeners.add(listener);
  start();
  return () => { listeners.delete(listener); };
}
export const agentEventsSnapshot = () => snapshot;
/** Browser fixtures only: the desktop app's events come from the backend. */
export function seedAgentEvents(events: readonly AgentEvent[]) { publish(events); }
