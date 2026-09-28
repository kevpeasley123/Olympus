import { useCallback } from "react";
import {
  readViewSlice,
  useViewSlice,
  writeViewSlice,
  type CommunicationsSituationTarget,
  type NavigationTargets,
  type ResearchEntryTarget
} from "../state/viewState";

/**
 * Cross-surface navigation (review U5 groundwork).
 *
 * A surface that wants to show evidence elsewhere — a chat source in the
 * library, a situation in Communications — calls one of these. App listens,
 * switches mode, and parks the target in the view store; the destination panel
 * reads it with `useNavigationTarget` once mounted and clears it when done.
 *
 * Navigation only. Nothing here approves, executes or writes.
 */

export type NavigationRequest =
  | { kind: "research"; target: ResearchEntryTarget }
  | { kind: "communications"; target: CommunicationsSituationTarget }
  | { kind: "project"; projectId: string };

const listeners = new Set<(request: NavigationRequest) => void>();
let revision = 0;

function emit(request: NavigationRequest): void {
  // Parked before listeners run, so a destination that is already mounted and
  // one that mounts because of the mode switch both see the same target.
  if (request.kind === "research") {
    writeViewSlice("navigation", (current) => ({ ...current, research: { ...request.target, revision: ++revision } }));
  } else if (request.kind === "communications") {
    writeViewSlice("navigation", (current) => ({ ...current, communications: { ...request.target, revision: ++revision } }));
  }
  listeners.forEach((listener) => listener(request));
}

/** Open a library entry, optionally highlighting an excerpt. */
export function openResearchEntry(target: ResearchEntryTarget): void {
  emit({ kind: "research", target });
}

export function openCommunicationsSituation(target: CommunicationsSituationTarget): void {
  emit({ kind: "communications", target });
}

/** Open a project's detail in Project mode. */
export function openProject(projectId: string): void {
  emit({ kind: "project", projectId });
}

/** App subscribes once; returns the unsubscribe. */
export function subscribeToNavigation(listener: (request: NavigationRequest) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

type TargetKind = keyof NavigationTargets;

/**
 * The pending target for one destination, and a `consume` that clears it.
 * Consume only the revision you handled, so a newer request that arrived in
 * between is not dropped.
 */
export function useNavigationTarget<K extends TargetKind>(kind: K): [NavigationTargets[K], (handledRevision: number) => void] {
  const [targets] = useViewSlice("navigation");
  const consume = useCallback((handledRevision: number) => consumeNavigationTarget(kind, handledRevision), [kind]);
  return [targets[kind], consume];
}

export function consumeNavigationTarget(kind: TargetKind, handledRevision: number): void {
  if (readViewSlice("navigation")[kind]?.revision !== handledRevision) return;
  writeViewSlice("navigation", (current) => ({ ...current, [kind]: null }));
}

/**
 * Operator-requested refresh (Ctrl+R, the dock button). Stores that App cannot
 * reach directly — Communications' mail and situation polls — subscribe here
 * so one gesture refreshes everything the registry label promises.
 */
const refreshListeners = new Set<() => void>();

export function subscribeToRefresh(listener: () => void): () => void {
  refreshListeners.add(listener);
  return () => { refreshListeners.delete(listener); };
}

export function emitRefreshRequested(): void {
  refreshListeners.forEach((listener) => listener());
}
