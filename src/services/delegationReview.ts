import type { ReviewNotesState } from "../state/viewState";
import type { CheckEvidence, CheckOption } from "./delegation";

/**
 * The review form's rules, kept pure so the harness can pin them (review U3, U11).
 *
 * Notes are the operator's words and survive everything: checks, polls, mode
 * switches, a changed workspace. Evidence validity is separate. A check
 * selection or the "I reviewed" acknowledgement describes one workspace
 * fingerprint and one set of recorded approvals; when either changes, those
 * are cleared and the form says why. The backend revalidates all of it at
 * completion; this only keeps the form from offering what it would refuse.
 */

export const MIN_NOTE_CHARS = 20;
export const MAX_NOTE_CHARS = 2_000;

/** Unicode scalar count, as Rust's `chars().count()` measures it. */
export function noteLength(note: string): number {
  return [...note.trim()].length;
}

export function approvalsKey(approvals: string[]): string {
  return approvals.join("\n");
}

function fingerprint(hash: string | undefined): string {
  return hash ? hash.slice(0, 8) : "unknown";
}

/** A check a criterion may cite: it passed on exactly this workspace. */
export function checkSupportsWorkspace(check: CheckEvidence | undefined, hash: string): boolean {
  return Boolean(check && check.exitCode === 0 && check.workspaceHash && check.workspaceHash === hash);
}

export interface ReviewSnapshot {
  hash: string;
  approvals: string[];
  checks: CheckEvidence[];
  criteriaCount: number;
}

export interface Reconciled {
  next: ReviewNotesState;
  /** Why something the operator chose was cleared; null when nothing was. */
  invalidated: string | null;
}

/** Brings stored notes up to a fresh read of the run without erasing a note. */
export function reconcileReviewNotes(entry: ReviewNotesState, snapshot: ReviewSnapshot, projectId: string): Reconciled {
  const pad = (values: string[]) => Array.from({ length: Math.max(snapshot.criteriaCount, values.length) }, (_, i) => values[i] ?? "");
  const notes = pad(entry.notes);
  const key = approvalsKey(snapshot.approvals);
  const hashChanged = entry.workspaceHash !== undefined && entry.workspaceHash !== snapshot.hash;
  const approvalsChanged = entry.approvalsKey !== undefined && entry.approvalsKey !== key;
  const byId = new Map(snapshot.checks.map((check) => [check.id, check]));
  let clearedSelections = 0;
  const evidence = pad(entry.evidence).map((id) => {
    if (!id) return id;
    if (!approvalsChanged && checkSupportsWorkspace(byId.get(id), snapshot.hash)) return id;
    clearedSelections++;
    return "";
  });
  const clearedReview = entry.reviewed && (hashChanged || approvalsChanged);
  const reasons: string[] = [];
  if (hashChanged) reasons.push(`The workspace changed since you last read it (fingerprint ${fingerprint(entry.workspaceHash)} → ${fingerprint(snapshot.hash)}).`);
  if (approvalsChanged) reasons.push("The run's recorded approvals changed.");
  const cleared: string[] = [];
  if (clearedReview) cleared.push("the “I reviewed” confirmation");
  if (clearedSelections) cleared.push(`${clearedSelections} check ${clearedSelections === 1 ? "selection" : "selections"} that described the earlier state`);
  const invalidated = cleared.length
    ? `${reasons.join(" ") || "A selected check no longer matches this workspace."} Cleared ${cleared.join(" and ")}. Your notes are kept; re-read the diff before relying on them.`
    : null;
  return {
    next: {
      ...entry,
      notes,
      evidence,
      reviewed: clearedReview ? false : entry.reviewed,
      workspaceHash: snapshot.hash,
      approvalsKey: key,
      projectId
    },
    invalidated
  };
}

export interface ChecklistItem { met: boolean; text: string }

export interface ChecklistInput {
  criteria: string[];
  notes: string[];
  evidence: string[];
  checks: CheckEvidence[];
  options: CheckOption[];
  hash: string;
  reviewed: boolean;
  issues: string;
  /** A check id currently running. */
  running?: string | null;
}

export function checkLabel(name: string, options: CheckOption[]): string {
  return options.find((option) => option.id === name || option.label === name)?.label ?? name;
}

/**
 * Every condition `complete_delegation_review` enforces, stated as the operator
 * would act on it. Complete is enabled only when every item is met.
 */
export function completionChecklist(input: ChecklistInput): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  input.criteria.forEach((_, i) => {
    const note = input.notes[i] ?? "";
    const length = noteLength(note);
    const label = `Criterion ${i + 1}`;
    if (length < MIN_NOTE_CHARS) items.push({ met: false, text: `${label} needs a note (${length}/${MIN_NOTE_CHARS})` });
    else if ([...note].length > MAX_NOTE_CHARS) items.push({ met: false, text: `${label}'s note is too long (${[...note].length}/${MAX_NOTE_CHARS.toLocaleString("en-US")})` });
    else items.push({ met: true, text: `${label} has a note` });
    const selected = input.evidence[i];
    if (selected && !checkSupportsWorkspace(input.checks.find((check) => check.id === selected), input.hash)) {
      items.push({ met: false, text: `${label}: the selected check no longer matches this workspace` });
    }
  });

  const seen = new Set<string>();
  const problems: ChecklistItem[] = [];
  for (const check of input.checks) {
    if (seen.has(check.checkName)) continue;
    seen.add(check.checkName);
    const label = checkLabel(check.checkName, input.options);
    if (input.running && checkLabel(input.running, input.options) === label) problems.push({ met: false, text: `Wait for ${label} to finish` });
    else if (check.exitCode === null) problems.push({ met: false, text: `Run ${label} again — it did not finish` });
    else if (check.exitCode !== 0) problems.push({ met: false, text: `${label} failed (exit ${check.exitCode}) — fix it and run it again` });
    else if (check.workspaceHash !== input.hash) problems.push({ met: false, text: `Run the stale check again: ${label}` });
  }
  items.push(...(problems.length ? problems : [{ met: true, text: "No failed or stale checks" }]));

  items.push(input.reviewed
    ? { met: true, text: "Diff and evidence reviewed" }
    : { met: false, text: "Confirm you reviewed the diff" });
  items.push(input.issues.trim()
    ? { met: false, text: "Unresolved issues must be empty" }
    : { met: true, text: "No unresolved issues" });
  return items;
}
