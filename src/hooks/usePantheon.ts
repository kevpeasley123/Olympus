import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

export interface PantheonEntry {
  id: string;
  title: string;
  sourceFile: string;
  entryType: string;
  sourceType?: string;
  created?: string;
  sourceDate?: string;
  origin?: string;
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
