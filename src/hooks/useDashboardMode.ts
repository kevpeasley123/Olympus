import { useCallback, useEffect, useState } from "react";

/**
 * The three surfaces the dashboard presents. This replaced `focusMode` rather
 * than sitting beside it: Project mode subsumes what focus mode did, and
 * keeping both would have made a 2x3 state matrix out of two booleans nobody
 * could reason about.
 */
export type DashboardMode = "command" | "project" | "research";

export const DASHBOARD_MODES: DashboardMode[] = ["command", "project", "research"];

export const MODE_LABELS: Record<DashboardMode, string> = {
  command: "Command",
  project: "Project",
  research: "Research"
};

const MODE_KEY = "olympus.mode";
const LEGACY_FOCUS_KEY = "olympus.focusMode";

function isDashboardMode(value: unknown): value is DashboardMode {
  return typeof value === "string" && (DASHBOARD_MODES as string[]).includes(value);
}

/**
 * Reads the stored mode, migrating the boolean it replaced.
 *
 * `olympus.focusMode: "true"` becomes Project — that is what focus mode was.
 * Anything else, including a value neither key ever held, lands on Command:
 * an unreadable preference should open the surface that shows the most, not
 * the one that hides the most.
 */
export function readStoredMode(storage: Pick<Storage, "getItem">): DashboardMode {
  const stored = storage.getItem(MODE_KEY);
  if (isDashboardMode(stored)) {
    return stored;
  }

  return storage.getItem(LEGACY_FOCUS_KEY) === "true" ? "project" : "command";
}

export function useDashboardMode() {
  const [mode, setMode] = useState<DashboardMode>(() => {
    if (typeof window === "undefined") return "command";
    return readStoredMode(window.localStorage);
  });

  useEffect(() => {
    window.localStorage.setItem(MODE_KEY, mode);
    // Dropped once, not left behind. A stale key that looks like live config is
    // the two-sources-of-truth bug this project has already paid for twice.
    window.localStorage.removeItem(LEGACY_FOCUS_KEY);
  }, [mode]);

  const cycleMode = useCallback(() => {
    setMode((current) => {
      const index = DASHBOARD_MODES.indexOf(current);
      return DASHBOARD_MODES[(index + 1) % DASHBOARD_MODES.length];
    });
  }, []);

  return { mode, setMode, cycleMode };
}
