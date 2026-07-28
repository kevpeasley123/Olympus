import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { createPollingStore } from "./createPollingStore";
import { subscribeToInstrumentEvents } from "../services/instrumentEvents";

export interface VaultWriteEvent {
  path: string;
  operation: string;
  /** SQLite `CURRENT_TIMESTAMP` — UTC, `YYYY-MM-DD HH:MM:SS`, no zone marker. */
  writtenAt: string;
}

/**
 * Writes from the last 24 hours, for the day arc's tick marks.
 *
 * Five minutes is generous for a log that only changes when the operator
 * approves a write — and an approval triggers an immediate refresh anyway, so
 * the interval is a backstop rather than the mechanism.
 */
const POLL_INTERVAL_MS = 300_000;

const useStore = createPollingStore<VaultWriteEvent[]>({
  intervalMs: POLL_INTERVAL_MS,
  initial: [],
  fetcher: () => invoke<VaultWriteEvent[]>("fetch_recent_vault_writes")
});

export function useVaultWrites() {
  const { data, loading, error, refresh } = useStore();

  // An approved write lands immediately; waiting up to five minutes to draw its
  // tick would make the arc look broken at exactly the moment it should react.
  // This is a latency optimisation on top of the interval, not a replacement
  // for it: the operator edits the vault in Obsidian too, and those writes
  // never pass through the gate. Do not "simplify" this to event-driven only.
  useEffect(() => {
    return subscribeToInstrumentEvents((event) => {
      if (event === "vault-write") void refresh();
    });
  }, [refresh]);

  return { writes: data, loading, error, refresh };
}
