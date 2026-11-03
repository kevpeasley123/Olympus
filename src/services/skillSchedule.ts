import { useEffect } from "react";
import { isTauriRuntime } from "./launcher";
import { loadReviewHistory } from "./projectReviews";
import { projectChangeReview } from "./executableSkills";
const SCHEDULE = "olympus.projectReview.daily";
export function scheduledProject() { return localStorage.getItem(SCHEDULE) ?? ""; }
export function scheduleReview(project: string) { localStorage.setItem(SCHEDULE, project); }
export function useProjectReviewScheduler() {
  useEffect(() => {
    if (!isTauriRuntime()) return;
    let busy = false;
    const tick = async () => {
      const project = scheduledProject();
      if (!project || busy) return;
      busy = true;
      try { await projectChangeReview.run(project,"daily"); } catch (error) { console.warn("Scheduled project review unavailable", error); }
      finally { busy = false; }
    };
    void loadReviewHistory().then(tick).catch(error => console.warn("Review history unavailable", error));
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);
}
