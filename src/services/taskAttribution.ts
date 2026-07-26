import type { ActionQueueTask } from "../hooks/useActionQueue";
import type { TrackedProject } from "../types";

/**
 * Attributes open tasks to projects by the note the checkbox lives under.
 *
 * `tasks.rs` records a vault-relative `source_file` and `project_notes.rs`
 * builds `note_path` the same way — both forward-slashed, both rooted at the
 * vault — so the join is plain string equality. Matching on project *names*
 * would silently mis-attribute the moment two notes shared a word.
 *
 * Lives here rather than inside the panel so the join can be checked against
 * real vault data without a browser or a Tauri runtime.
 */

export interface TaskAttribution {
  /** Keyed by `TrackedProject.id`. Projects with no tasks are absent. */
  perProject: Map<string, ActionQueueTask[]>;
  /** Everything that joined to nothing. Never dropped. */
  unattributed: ActionQueueTask[];
}

export function attributeTasks(
  projects: TrackedProject[],
  tasks: ActionQueueTask[]
): TaskAttribution {
  const byNote = new Map<string, ActionQueueTask[]>();
  for (const task of tasks) {
    const list = byNote.get(task.sourceFile);
    if (list) list.push(task);
    else byNote.set(task.sourceFile, [task]);
  }

  const claimed = new Set<string>();
  const perProject = new Map<string, ActionQueueTask[]>();
  for (const project of projects) {
    if (!project.notePath) continue;
    const matched = byNote.get(project.notePath);
    if (!matched) continue;
    perProject.set(project.id, matched);
    claimed.add(project.notePath);
  }

  // Filtered by source file rather than by set-difference on the tasks already
  // placed, so a note claimed by two projects cannot leak its tasks into the
  // unattributed bucket as well as onto a card.
  const unattributed = tasks.filter((task) => !claimed.has(task.sourceFile));
  return { perProject, unattributed };
}

/** Groups the leftovers by the note they came from, preserving first-seen order. */
export function groupBySourceFile(
  tasks: ActionQueueTask[]
): Array<[string, ActionQueueTask[]]> {
  const groups = new Map<string, ActionQueueTask[]>();
  for (const task of tasks) {
    const list = groups.get(task.sourceFile);
    if (list) list.push(task);
    else groups.set(task.sourceFile, [task]);
  }
  return [...groups.entries()];
}
