/**
 * What the instrument's activity dots read.
 *
 * A dot that never lights has to mean "this scan is dead", so every source that
 * gets a dot must actually poll in every mode. Two of these used to run only
 * where their panel was mounted — Command mode showed neither — which would
 * have made two of five dots permanently dark by construction.
 */

export type PollSourceKey = "git" | "tasks" | "markets" | "weather" | "pantheon";

/** Dot order around the ring, clockwise from twelve. */
export const POLL_SOURCE_KEYS: PollSourceKey[] = [
  "git",
  "tasks",
  "pantheon",
  "markets",
  "weather"
];

export const POLL_SOURCE_LABELS: Record<PollSourceKey, string> = {
  git: "git",
  tasks: "vault tasks",
  pantheon: "pantheon",
  markets: "markets",
  weather: "weather"
};

export interface PollSourceState {
  key: PollSourceKey;
  lastSuccessAt: number | null;
  lastError?: string;
  /** Bumped on every landed scan, so a dot can flash without a timestamp diff. */
  landings: number;
}

const state = new Map<PollSourceKey, PollSourceState>(
  POLL_SOURCE_KEYS.map((key) => [key, { key, lastSuccessAt: null, landings: 0 }])
);

const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function reportPollSuccess(key: PollSourceKey): void {
  const current = state.get(key);
  if (!current) return;
  state.set(key, {
    key,
    lastSuccessAt: Date.now(),
    lastError: undefined,
    landings: current.landings + 1
  });
  notify();
}

export function reportPollFailure(key: PollSourceKey, error: string): void {
  const current = state.get(key);
  if (!current) return;
  state.set(key, { ...current, lastError: error });
  notify();
}

export function getPollSources(): PollSourceState[] {
  return POLL_SOURCE_KEYS.map((key) => state.get(key) as PollSourceState);
}

export function subscribeToPollSources(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
