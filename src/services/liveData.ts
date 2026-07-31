import { invoke } from "@tauri-apps/api/core";
import type { TrackedProject } from "../types";

export interface ProjectsScanResult {
  projects: TrackedProject[];
  /** Problems with the notes folder itself, belonging to no single project. */
  warnings: string[];
}

export async function fetchProjects(
  rootPath: string,
  sinceSession: string | null
): Promise<ProjectsScanResult> {
  return invoke<ProjectsScanResult>("scan_tracked_projects", {
    request: { rootPath, sinceSession }
  });
}
