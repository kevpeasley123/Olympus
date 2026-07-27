import { invoke } from "@tauri-apps/api/core";
import { createPollingStore } from "./createPollingStore";

export type TaskSourceFolder = "Tasks" | "DailyBriefs" | "Projects";

export interface ActionQueueTask {
  id: string;
  text: string;
  sourceFile: string;
  sourceFolder: TaskSourceFolder;
  lineNumber: number;
  fileModifiedAt: string;
  completed: boolean;
}

const POLL_INTERVAL_MS = 30_000;

const useStore = createPollingStore<ActionQueueTask[]>({
  key: "tasks",
  intervalMs: POLL_INTERVAL_MS,
  initial: [],
  fetcher: () => invoke<ActionQueueTask[]>("fetch_action_queue")
});

/**
 * Shared across every consumer. `App` subscribes so the scan runs in all three
 * modes; `ProjectsPanel` subscribing as well reuses the same poll rather than
 * starting a second one.
 */
export function useActionQueue() {
  const { data, loading, error, refresh } = useStore();
  return { tasks: data, loading, error, refresh };
}
