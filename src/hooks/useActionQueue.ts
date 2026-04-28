import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

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

export function useActionQueue() {
  const [tasks, setTasks] = useState<ActionQueueTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await invoke<ActionQueueTask[]>("fetch_action_queue");
      setTasks(result);
      setError(null);
    } catch (e) {
      setError(String(e));
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

  return { tasks, loading, error, refresh };
}
