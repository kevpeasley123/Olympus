import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { createPollingStore } from "./createPollingStore";
import {
  emitInstrumentEvent,
  subscribeToInstrumentEvents
} from "../services/instrumentEvents";
import {
  addedConnectedNoteIds,
  EMPTY_VAULT_GRAPH
} from "../services/vaultGraph";
import type { VaultGraphPayload } from "../services/vaultGraph";

/**
 * The vault's link structure, for the instrument's inner bands.
 *
 * No poll `key`: the activity dots this replaced are gone, and a source that
 * reports to a registry nothing draws would be recording into the dark.
 *
 * Five minutes because the scan walks and rereads the vault. That cost preserves
 * the stronger guarantee: every result is derived from the links that exist now,
 * without an accumulated graph or a filesystem timestamp shortcut.
 */
const POLL_INTERVAL_MS = 300_000;
let hasGraphSnapshot = false;

const useStore = createPollingStore<VaultGraphPayload>({
  intervalMs: POLL_INTERVAL_MS,
  initial: EMPTY_VAULT_GRAPH,
  fetcher: () => invoke<VaultGraphPayload>("fetch_vault_graph"),
  onData: (next, previous) => {
    if (hasGraphSnapshot && addedConnectedNoteIds(previous, next).length > 0) {
      emitInstrumentEvent("graph-node");
    }
    hasGraphSnapshot = true;
  }
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
