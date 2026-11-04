import { recordSourceAccess } from "./sourceActivity";
import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface ProjectReview {
  id: number; project: string; source: string; revision: string | null; previous: string | null;
  outcome: "baseline" | "changed" | "unchanged" | "unavailable"; detail: string; observedAt: string;
}

const listeners = new Set<() => void>();
let reviews: readonly ProjectReview[] = [];
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
function merge(records: readonly ProjectReview[]) {
  const merged = new Map(reviews.map(r => [r.id, r]));
  for (const record of records) merged.set(record.id, record);
  reviews = Array.from(merged.values()).sort((a,b) => b.id-a.id).slice(0,50);
  listeners.forEach(fn => fn());
}
export const useReviewHistory = () => useSyncExternalStore(subscribe, () => reviews);
export async function loadReviewHistory() { merge(await invoke<ProjectReview[]>("project_review_history")); }
export async function runReview(project: string, scheduled = false) {
  const record = await invoke<ProjectReview>("run_project_review", {project, scheduled});
  if (!reviews.some(r => r.id === record.id)) {
    recordSourceAccess("Project Change Review", record.project + " · Git HEAD", !!record.revision, "Review #" + record.id);
  }
  merge([record]);
  return record;
}
