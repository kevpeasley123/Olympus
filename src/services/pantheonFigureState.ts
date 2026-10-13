import type { Mission } from './capabilities';
import type { CommandCatalog } from './commandAgents';

/**
 * The living Pantheon's roster and the states its figures may show. A figure
 * works only while a recorded mission step names its runtime agent; nothing
 * here estimates progress or invents activity. Names are presentation; the
 * runtime IDs carry authority, as in `pantheonAgents`.
 */
export type FigureState = 'dormant' | 'unavailable' | 'idle' | 'assigned' | 'working' | 'waiting' | 'reviewing' | 'completed' | 'blocked';
export type FigureId = 'zeus' | 'athena' | 'hephaestus' | 'dionysus' | 'themis';

export interface FigureSpec {
  id: FigureId;
  /** The runtime agent this figure represents. */
  agent: string;
  name: string;
  role: string;
  words: string;
  /** Station on the Omega's plane, in scene units (Omega at the origin). */
  station: readonly [number, number, number];
  accent: number;
  /** Seconds between idle gestures and gaze shifts; a slower god has longer gaps. */
  temperament: { tempo: number; gesture: readonly [number, number]; gaze: readonly [number, number] };
}

// Positions follow the operator's reference render: Zeus above the Omega,
// Athena and Hephaestus upper left and right, Dionysus and Themis lower.
export const PANTHEON_FIGURES: readonly FigureSpec[] = [
  { id: 'zeus', agent: 'olympus', name: 'Zeus', role: 'Orchestrator', words: 'Align · Coordinate · Execute', station: [0, 140, 0], accent: 0xf2c46b, temperament: { tempo: .8, gesture: [9, 16], gaze: [5, 9] } },
  { id: 'athena', agent: 'research', name: 'Athena', role: 'Research analyst', words: 'Discover · Analyze · Advise', station: [-212, 80, 0], accent: 0x7fd3e6, temperament: { tempo: 1, gesture: [7, 12], gaze: [2.5, 5] } },
  { id: 'hephaestus', agent: 'coding-delegate', name: 'Hephaestus', role: 'Systems engineer', words: 'Build · Optimize · Empower', station: [212, 80, 0], accent: 0xff9a4a, temperament: { tempo: 1, gesture: [6, 11], gaze: [4, 8] } },
  { id: 'dionysus', agent: 'dionysus', name: 'Dionysus', role: 'Creative strategist', words: 'Imagine · Create · Amplify', station: [-205, -118, 0], accent: 0xb98ae8, temperament: { tempo: 1.15, gesture: [4.5, 9], gaze: [3, 6] } },
  { id: 'themis', agent: 'verification', name: 'Themis', role: 'Verification analyst', words: 'Verify · Validate · Ensure', station: [205, -118, 0], accent: 0xf3ead2, temperament: { tempo: .9, gesture: [8, 14], gaze: [4.5, 8] } },
];

/** Figures with a model in the scene. The rest keep their constellation emblem until their art exists. */
export const MANIFESTED_FIGURES: readonly FigureId[] = ['hephaestus'];

export interface AgentSession { missionId: string; title: string; step: string; startedAt: string | null; stepKey: string }

/** The recorded step each agent is on, if any. Session time is the mission's recorded start. */
export function agentSessions(missions: readonly Mission[]): Map<string, AgentSession & { kind: 'active' | 'waiting' | 'failed'; approval: boolean }> {
  const sessions = new Map<string, AgentSession & { kind: 'active' | 'waiting' | 'failed'; approval: boolean }>();
  const rank = { active: 3, waiting: 2, failed: 1 } as const;
  for (const mission of missions) {
    if (mission.status !== 'running' && mission.status !== 'waiting') continue;
    for (const step of mission.steps) {
      if (!step.agent || (step.state !== 'active' && step.state !== 'waiting' && step.state !== 'failed')) continue;
      // A mission parked on approval names the agent whose step is held.
      const kind = step.state === 'active' && mission.status === 'waiting' ? 'waiting' : step.state;
      const previous = sessions.get(step.agent);
      if (previous && rank[previous.kind] >= rank[kind]) continue;
      sessions.set(step.agent, { missionId: mission.id, title: mission.title, step: step.label, startedAt: mission.startedAt, stepKey: `${mission.id}/${step.id}`, kind, approval: Boolean(mission.approval?.required) });
    }
  }
  return sessions;
}

export interface FigureMemory { state: FigureState; since: number; stepKey: string | null }
export const ASSIGNED_SECONDS = 1.6, COMPLETED_SECONDS = 3.2;

/**
 * One figure's state at `now` (seconds), given what was shown before.
 * Assigned and completed are brief, observed transitions: assigned when a new
 * step starts for this agent, completed only when a step it was working on is
 * recorded completed. A run that simply disappears returns the figure to idle.
 */
export function nextFigureState(spec: FigureSpec, missions: readonly Mission[], catalog: CommandCatalog | null, previous: FigureMemory | null, now: number): FigureMemory {
  const keep = (state: FigureState, stepKey: string | null): FigureMemory => previous && previous.state === state && previous.stepKey === stepKey ? previous : { state, since: now, stepKey };
  if (spec.agent === 'dionysus') return keep('dormant', null);
  const role = spec.agent === 'olympus' ? catalog?.orchestrator : catalog?.agents.find(a => a.id === spec.agent);
  if (role?.status === 'PLACEHOLDER') return keep('dormant', null);
  if (role?.tone === 'unavailable') return keep('unavailable', null);
  const session = spec.agent === 'olympus' ? orchestration(missions) : agentSessions(missions).get(spec.agent);
  if (session) {
    if (session.kind === 'failed') return keep('blocked', session.stepKey);
    if (session.kind === 'waiting') return keep('waiting', session.stepKey);
    const working: FigureState = spec.agent === 'verification' ? 'reviewing' : 'working';
    if (previous?.stepKey === session.stepKey && (previous.state === working || previous.state === 'assigned')) {
      return previous.state === 'assigned' && now - previous.since < ASSIGNED_SECONDS ? previous : keep(working, session.stepKey);
    }
    return { state: 'assigned', since: now, stepKey: session.stepKey };
  }
  if (previous?.stepKey && (previous.state === 'working' || previous.state === 'reviewing' || previous.state === 'assigned') && stepCompleted(missions, previous.stepKey)) return { state: 'completed', since: now, stepKey: previous.stepKey };
  if (previous?.state === 'completed' && now - previous.since < COMPLETED_SECONDS) return previous;
  return keep('idle', null);
}

function stepCompleted(missions: readonly Mission[], stepKey: string) {
  const [missionId, stepId] = stepKey.split('/');
  return missions.some(m => m.id === missionId && m.steps.some(s => s.id === stepId && s.state === 'completed'));
}

/** Zeus coordinates whenever any recorded run is live; his step is the run itself. */
function orchestration(missions: readonly Mission[]) {
  const live = missions.filter(m => m.status === 'running' || m.status === 'waiting');
  if (!live.length) return undefined;
  const first = live[0];
  return { missionId: first.id, title: first.title, step: `${live.length} live run${live.length === 1 ? '' : 's'}`, startedAt: first.startedAt, stepKey: live.map(m => m.id).sort().join('+'), kind: 'active' as const, approval: false };
}

export function sessionClock(startedAt: string | null, nowMs: number) {
  const start = startedAt ? Date.parse(startedAt) : NaN;
  if (!Number.isFinite(start) || nowMs < start) return null;
  const seconds = Math.floor((nowMs - start) / 1000), h = Math.floor(seconds / 3600), m = Math.floor(seconds / 60) % 60, s = seconds % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
