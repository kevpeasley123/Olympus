import { createPollingStore } from "./createPollingStore";
import { listDelegationRuns, type DelegationRun } from "../services/delegation";
import { isTauriRuntime } from "../services/launcher";

export const useDelegationRuns = createPollingStore<DelegationRun[]>({
  initial: [], intervalMs: 3000,
  fetcher: () => isTauriRuntime() ? listDelegationRuns() : Promise.resolve([])
});
