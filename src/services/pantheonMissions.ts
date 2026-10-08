import type { Mission, MissionSnapshot } from './capabilities';

/** Only recorded live work inhabits the Pantheon. Terminal runs remain history. */
export function activeMissions(snapshot: MissionSnapshot | null): Mission[] {
  return [...new Map((snapshot?.missions ?? []).filter(m => m.status === 'running' || m.status === 'waiting').map(m => [m.id, m])).values()];
}
export function missionTelemetry(mission: Mission) {
  const steps = mission.steps.filter(s => s.state !== 'skipped' && s.state !== 'not-run');
  const done = steps.filter(s => s.state === 'completed').length;
  const blocked = mission.status === 'waiting' && mission.steps.some(s => s.state === 'failed');
  return {
    progress: steps.length ? done / steps.length : null,
    progressLabel: steps.length ? `${done}/${steps.length} steps` : 'Progress not reported',
    state: mission.approval?.required ? 'Awaiting approval' : blocked ? 'Blocked' : mission.status === 'waiting' ? 'Waiting' : 'Working',
    tone: blocked ? 'warning' : mission.status === 'waiting' || mission.approval?.required ? 'amber' : 'cyan',
    currentStep: mission.steps.find(s => s.state === 'active' || s.state === 'waiting')?.label ?? mission.phase ?? null,
  };
}
/** Stable identity fixes phase across polling, selection and list reordering. */
export function missionOrbit(id: string) {
  let hash = 2166136261;
  for (const c of id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  return { radius: 139 + hash % 28, phase: (hash % 6283) / 1000, inclination: .52 + (hash % 70) / 100, rotation: (hash % 314) / 100, period: 180 + hash % 90 };
}
