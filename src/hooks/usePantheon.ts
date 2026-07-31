import { invoke } from "@tauri-apps/api/core";
import { createPollingStore } from "./createPollingStore";

/** Mirrors `STANCE_VALUES` in `commands/pantheon.rs`. */
export const PANTHEON_STANCES = ["endorsed", "provisional", "disputed", "unevaluated"] as const;
export type PantheonStance = (typeof PANTHEON_STANCES)[number];

/** Mirrors `ORIGIN_VALUES` in `commands/pantheon.rs`. */
export const PANTHEON_ORIGINS = ["collected", "olympus-found"] as const;
export type PantheonOrigin = (typeof PANTHEON_ORIGINS)[number];

export interface PantheonEntry {
  id: string;
  title: string;
  sourceFile: string;
  entryType: string;
  sourceType?: string;
  created?: string;
  sourceDate?: string;
  /** Who found the source. Absent on entries written before the schema change. */
  origin?: PantheonOrigin;
  /** What wrote the file — the value `origin` used to carry. */
  writtenBy?: string;
  /** Always present: an entry that declares nothing is `unevaluated`. */
  stance: PantheonStance;
  /** Absent means no purpose was ever stated, which is surfaced, not filled in. */
  whyKept?: string;
  project?: string;
  tags: string[];
  wordCount: number;
  fileModifiedAt: string;
  bodyPreview: string;
  body: string;
}

/**
 * Five minutes, not one.
 *
 * A research library changes when the operator adds something, not every
 * minute — and this scan now runs in every mode rather than only where the
 * library panel was mounted, so the old cadence would have been a straight
 * regression. The Rust side also skips any file whose mtime is unchanged, so a
 * scan that finds nothing new reads no file bodies at all.
 */
const POLL_INTERVAL_MS = 300_000;

const useStore = createPollingStore<PantheonEntry[]>({
  intervalMs: POLL_INTERVAL_MS,
  initial: [],
  fetcher: () => invoke<PantheonEntry[]>("fetch_pantheon_entries")
});

export function usePantheon() {
  const { data, loading, error, refresh } = useStore();
  return { entries: data, loading, error, refresh };
}
