import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

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

const POLL_INTERVAL_MS = 60_000;

export function usePantheon() {
  const [entries, setEntries] = useState<PantheonEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await invoke<PantheonEntry[]>("fetch_pantheon_entries");
      setEntries(result);
      setError(null);
    } catch (e) {
      setError(String(e));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return { entries, loading, error, refresh };
}
