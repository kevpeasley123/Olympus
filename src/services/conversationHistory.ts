import type { ConversationMessage } from "../types";
import { dayLabel, formatWhen, isSameDay, toDate } from "./time";

/**
 * The opening briefing's persisted marker. Every briefing ever stored carries
 * this id prefix, so older rows are recognised without a schema change; new
 * ones also set `kind: "briefing"` in memory.
 */
export const BRIEFING_ID_PREFIX = "conversation-briefing-";

export function isBriefing(message: Pick<ConversationMessage, "id" | "kind">): boolean {
  return message.kind === "briefing" || message.id.startsWith(BRIEFING_ID_PREFIX);
}

/**
 * The history the model is sent.
 *
 * A briefing is appended on every launch, so without this the model history
 * fills with near-identical launch summaries. Only the most recent one stays,
 * which keeps "what did you mean by that?" answerable; older ones drop out.
 * The transcript itself keeps all of them.
 */
export function modelHistory(history: ConversationMessage[]): ConversationMessage[] {
  let latest = -1;
  history.forEach((message, index) => { if (isBriefing(message)) latest = index; });
  if (latest < 0) return history;
  return history.filter((message, index) => index === latest || !isBriefing(message));
}

/** Labelled so the model reads it as composed by the app, not as its own earlier answer. */
export function briefingTurnContent(message: ConversationMessage): string {
  return `[Opening briefing composed by Olympus from project state when the app opened; no model wrote it.]\n${message.content}`;
}

/**
 * The time line for a message imported from browser `localStorage`, or null
 * for any other message. Its only stored date is the import moment, so that
 * is named as such; the original `HH:MM`, when the browser kept one, is
 * shown beside it without a date, because the date was never recorded.
 */
export function importedTimeLabel(
  message: Pick<ConversationMessage, "importedAt" | "timestamp">,
  now: Date = new Date()
): string | null {
  if (!message.importedAt) return null;
  const original = /^\d{1,2}:\d{2}$/.test(message.timestamp.trim()) ? `original time ${message.timestamp.trim()}` : "original time unknown";
  return `Imported ${formatWhen(message.importedAt, { now })} · ${original}`;
}

/** When the message happened: its ISO `at`, when it has one. */
export function messageDate(message: Pick<ConversationMessage, "at">): Date | null {
  return toDate(message.at);
}

/**
 * The day heading to draw above each message, or null. A heading opens the
 * first dated message and every change of calendar day after it; undated
 * legacy rows neither get one nor break a run.
 */
export function daySeparators(times: (string | undefined)[], now: Date = new Date()): (string | null)[] {
  let previous: Date | null = null;
  return times.map((at) => {
    const date = toDate(at);
    if (!date) return null;
    const label = previous && isSameDay(previous, date) ? null : dayLabel(date, now);
    previous = date;
    return label;
  });
}
