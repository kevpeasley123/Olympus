import { useCallback, useSyncExternalStore } from "react";

/**
 * Session view state that must survive a mode switch or a poll (review U3).
 *
 * Panels unmount when the operator glances at another mode, and their local
 * `useState` goes with them: an open project, an unsent run proposal, review
 * notes, a library search, a half-written reply. This keeps those in module
 * memory for the life of the window.
 *
 * Deliberately in memory only. Drafts can hold private correspondence and
 * review evidence; writing them to localStorage or sessionStorage would leave
 * copies on disk outside SQLite and the write gate. A restart clears them, and
 * the Restart confirmation says so.
 *
 * Surfaces wire themselves in:
 *
 *   const [research, setResearch] = useViewSlice("research");
 *   setResearch(current => ({ ...current, query }));
 *
 *   const [draft, setDraft] = useViewEntry("projectDrafts", project.id, EMPTY_PROJECT_DRAFT);
 *
 * Slices are keyed by stable ids (project id, run id, account id), never by
 * list position, so a refresh that reorders data cannot attach a draft to the
 * wrong item.
 */

export interface ProjectViewState {
  /** The project whose detail is open in Project mode; null shows the board. */
  detailProjectId: string | null;
  boardScrollTop: number;
  detailScrollTop: number;
}

export interface ProjectDraft {
  task: string;
  criteria: string[];
}

export interface ReviewNotesState {
  notes: string[];
  evidence: string[];
  reviewed: boolean;
  /**
   * The workspace the notes were written against. When the run's workspace
   * hash changes, the surface resets only the choices that went stale.
   */
  workspaceHash?: string;
  /** Lets App keep a project open while its review is unfinished. */
  projectId?: string;
}

export interface ResearchViewState {
  view: "grouped" | "recent" | "all";
  query: string;
  /** Pantheon category id of the section in view, or null for the first. */
  section: string | null;
  detailEntryId: string | null;
  listScrollTop: number;
}

export interface CommsReplyDraft {
  subject: string;
  body: string;
  /** What the draft answers, so it can be reattached after a remount. */
  situationId?: string;
  messageId?: string;
  /** Communications: the recipients field verbatim, the thread, the saved revision and the last saved text. */
  to?: string;
  threadId?: string;
  revision?: number;
  stale?: boolean;
  saved?: { to: string; subject: string; body: string };
}

export interface CommsAccountViewState {
  situationId: string | null;
  workstreamId: string | null;
  actorId: string | null;
  tab: string | null;
  /** Unsent local reply drafts by draft id. */
  drafts: Record<string, CommsReplyDraft>;
  /** Communications: the draft open in the editor, the primary view, the overview and navigator filter. */
  openDraftId?: string | null;
  view?: "situations" | "mail";
  overview?: boolean;
  navigatorFilter?: string;
  navigatorQuery?: string;
}

/** A request from another surface, consumed once by the destination panel. */
export interface ResearchEntryTarget {
  sourceFile: string;
  excerpt?: string;
  fingerprint?: string;
}

export interface CommunicationsSituationTarget {
  accountId?: string;
  situationId: string;
}

export interface NavigationTargets {
  research: (ResearchEntryTarget & { revision: number }) | null;
  communications: (CommunicationsSituationTarget & { revision: number }) | null;
}

export interface ViewSlices {
  project: ProjectViewState;
  projectDrafts: Record<string, ProjectDraft>;
  reviewNotes: Record<string, ReviewNotesState>;
  research: ResearchViewState;
  comms: Record<string, CommsAccountViewState>;
  navigation: NavigationTargets;
}

export type ViewSliceKey = keyof ViewSlices;

export const EMPTY_PROJECT_DRAFT: ProjectDraft = { task: "", criteria: [] };
export const EMPTY_REVIEW_NOTES: ReviewNotesState = { notes: [], evidence: [], reviewed: false };
export const EMPTY_COMMS_ACCOUNT: CommsAccountViewState = {
  situationId: null, workstreamId: null, actorId: null, tab: null, drafts: {}
};

const DEFAULTS: ViewSlices = {
  project: { detailProjectId: null, boardScrollTop: 0, detailScrollTop: 0 },
  projectDrafts: {},
  reviewNotes: {},
  research: { view: "grouped", query: "", section: null, detailEntryId: null, listScrollTop: 0 },
  comms: {},
  navigation: { research: null, communications: null }
};

type Updater<T> = T | ((current: T) => T);

const slices: Partial<ViewSlices> = {};
const listeners = new Map<ViewSliceKey, Set<() => void>>();

export function readViewSlice<K extends ViewSliceKey>(key: K): ViewSlices[K] {
  return (slices[key] ?? DEFAULTS[key]) as ViewSlices[K];
}

export function writeViewSlice<K extends ViewSliceKey>(key: K, update: Updater<ViewSlices[K]>): void {
  const current = readViewSlice(key);
  const next = typeof update === "function"
    ? (update as (value: ViewSlices[K]) => ViewSlices[K])(current)
    : update;
  if (Object.is(next, current)) return;
  slices[key] = next;
  listeners.get(key)?.forEach((listener) => listener());
}

export function subscribeViewSlice(key: ViewSliceKey, listener: () => void): () => void {
  let set = listeners.get(key);
  if (!set) listeners.set(key, (set = new Set()));
  set.add(listener);
  return () => { set!.delete(listener); };
}

/** For harnesses. Not called by the app: the store lives as long as the window. */
export function resetViewState(): void {
  for (const key of Object.keys(slices) as ViewSliceKey[]) {
    delete slices[key];
    listeners.get(key)?.forEach((listener) => listener());
  }
}

export function useViewSlice<K extends ViewSliceKey>(key: K): [ViewSlices[K], (update: Updater<ViewSlices[K]>) => void] {
  const subscribe = useCallback((listener: () => void) => subscribeViewSlice(key, listener), [key]);
  const value = useSyncExternalStore(subscribe, () => readViewSlice(key), () => readViewSlice(key));
  const set = useCallback((update: Updater<ViewSlices[K]>) => writeViewSlice(key, update), [key]);
  return [value, set];
}

/** The slices that hold one entry per stable id. */
export type RecordSliceKey = "projectDrafts" | "reviewNotes" | "comms";
type EntryOf<K extends RecordSliceKey> = ViewSlices[K][string];

/** Writes one keyed entry; `null` removes it, which is how a draft is discarded. */
export function writeViewEntry<K extends RecordSliceKey>(key: K, id: string, update: Updater<EntryOf<K>> | null, fallback: EntryOf<K>): void {
  writeViewSlice(key, (current) => {
    const record = current as Record<string, EntryOf<K>>;
    if (update === null) {
      if (!(id in record)) return current;
      const { [id]: _removed, ...rest } = record;
      return rest as ViewSlices[K];
    }
    const previous = record[id] ?? fallback;
    const next = typeof update === "function" ? (update as (value: EntryOf<K>) => EntryOf<K>)(previous) : update;
    return (Object.is(next, record[id]) ? current : { ...record, [id]: next }) as ViewSlices[K];
  });
}

/** One entry of a keyed slice, e.g. the draft for one project or the notes for one run. */
export function useViewEntry<K extends RecordSliceKey>(key: K, id: string, fallback: EntryOf<K>): [EntryOf<K>, (update: Updater<EntryOf<K>> | null) => void] {
  const [record] = useViewSlice(key);
  const value = (record as Record<string, EntryOf<K>>)[id] ?? fallback;
  const set = useCallback((update: Updater<EntryOf<K>> | null) => writeViewEntry(key, id, update, fallback), [key, id, fallback]);
  return [value, set];
}

/**
 * True when leaving Project mode would strand typed work for this project: an
 * unsent task or criteria, or review notes not yet acted on. App keeps the
 * project open in that case instead of clearing the filter.
 */
export function projectHasOpenWork(projectId: string | null): boolean {
  if (!projectId) return false;
  const draft = readViewSlice("projectDrafts")[projectId];
  if (draft && (draft.task.trim() || draft.criteria.some((line) => line.trim()))) return true;
  return Object.values(readViewSlice("reviewNotes")).some((review) =>
    review.projectId === projectId && (review.reviewed || review.notes.some((note) => note.trim()) || review.evidence.length > 0));
}
