import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { createPollingStore, type PollingStore } from "./createPollingStore";
import { listDelegationRuns, type DelegationRun } from "../services/delegation";
import { isTauriRuntime } from "../services/launcher";

// Progress arrives as `delegation-run-updated`; the poll only settles runs whose monitor
// no longer exists, so it can be slow.
const useDelegationRunStore = createPollingStore<DelegationRun[]>({
  initial: [], intervalMs: 10_000,
  fetcher: () => isTauriRuntime() ? listDelegationRuns() : Promise.resolve([])
});

export function useDelegationRuns(): PollingStore<DelegationRun[]> {
  const store = useDelegationRunStore();
  const { refresh } = store;

  useEffect(() => {
    if (!isTauriRuntime()) return;
    // listen() resolves after mount; an unmount before then must still dispose it.
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void listen("delegation-run-updated", () => void refresh()).then(dispose => {
      if (cancelled) dispose();
      else unlisten = dispose;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [refresh]);

  return store;
}
