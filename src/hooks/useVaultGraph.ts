import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { createPollingStore } from "./createPollingStore";
import { subscribeToInstrumentEvents } from "../services/instrumentEvents";
import { EMPTY_VAULT_GRAPH } from "../services/vaultGraph";
import type { VaultGraphPayload } from "../services/vaultGraph";

/**
 * The vault's link structure, for the instrument's inner bands.
 *
 * No poll `key`: the activity dots this replaced are gone, and a source that
 * reports to a registry nothing draws would be recording into the dark.
 *
 * Five minutes because the scan walks the vault. It is cheaper than it sounds —
 * the Rust side caches outbound links per file against mtime, so a scan that
 * finds no edits reads no file contents at all — but it is still a walk, and
 * link structure does not change on the minute.
 */
const POLL_INTERVAL_MS = 300_000;

const useStore = createPollingStore<VaultGraphPayload>({
  intervalMs: POLL_INTERVAL_MS,
  initial: EMPTY_VAULT_GRAPH,
  fetcher: () => invoke<VaultGraphPayload>("fetch_vault_graph")
});

export function useVaultGraph() {
  const { data, loading, error, refresh } = useStore();

  // An approved write adds a note, and a note with no inbound link lands on the
  // rim. Waiting five minutes to draw it would hide the one moment where the
  // rim is demonstrably telling the truth about something that just happened.
  useEffect(() => {
    return subscribeToInstrumentEvents((event) => {
      if (event === "vault-write") void refresh();
    });
  }, [refresh]);

  return { graph: data, loading, error, refresh };
}
