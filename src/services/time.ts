/**
 * One way to say when something happened.
 *
 * Replaces the ad-hoc `toLocaleString()` calls that print raw ISO strings or
 * locale-dependent formats in ordinary views (review item D3). Names and the
 * 24-hour clock are spelled out here rather than taken from `Intl`, so the
 * output is identical on every machine and the harness can pin it.
 *
 *   formatWhen(t)                     "just now · 09:55", "12 min ago · 09:43",
 *                                     "2 h ago · 07:55", "Yesterday 14:10",
 *                                     "Fri Sep 25, 09:03", "Thu Sep 25 2025, 09:03"
 *   formatWhen(t, {relative:false})   "09:55", "Yesterday 14:10", "Fri Sep 25, 09:03"
 *   formatWhen(t, {withDate:true})    "Mon Sep 28, 09:55" — always the absolute date
 *   dayLabel(t)                       "Today", "Yesterday", "Fri Sep 25", "Thu Sep 25, 2025"
 *
 * Times ahead of `now` (a scheduled sync, an expiry) read "in 5 min · 10:00"
 * and "Tomorrow 09:00". An unparseable value reads "Unknown time" rather than
 * "Invalid Date": unknown stays explicit.
 */

export type TimeInput = string | number | Date | null | undefined;

export interface FormatWhenOptions {
  /** Prefix same-day times with "2 h ago" / "in 5 min". Default true. */
  relative?: boolean;
  /** Always show the absolute date, even for today and yesterday. Default false. */
  withDate?: boolean;
  /** Injected for tests; defaults to the current time. */
  now?: Date;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const UNKNOWN_TIME = "Unknown time";

export function toDate(value: TimeInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function clockTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Whole calendar days from `now` back to `date` in local time; negative is the future. */
function calendarDaysAgo(date: Date, now: Date): number {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  // Rounded, not floored: a daylight-saving day is 23 or 25 hours long.
  return Math.round((start(now) - start(date)) / (24 * HOUR));
}

function shortDate(date: Date, now: Date): string {
  const base = `${WEEKDAYS[date.getDay()]} ${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === now.getFullYear() ? base : `${base} ${date.getFullYear()}`;
}

function relativeSpan(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < 45_000) return "";
  const minutes = Math.round(abs / MINUTE);
  const span = minutes < 60 ? `${minutes} min` : `${Math.floor(abs / HOUR)} h`;
  return ms >= 0 ? `${span} ago` : `in ${span}`;
}

export function formatWhen(value: TimeInput, options: FormatWhenOptions = {}): string {
  const date = toDate(value);
  if (!date) return UNKNOWN_TIME;
  const now = options.now ?? new Date();
  const time = clockTime(date);
  if (options.withDate) return `${shortDate(date, now)}, ${time}`;

  const days = calendarDaysAgo(date, now);
  if (days === 0) {
    if (options.relative === false) return time;
    const span = relativeSpan(now.getTime() - date.getTime());
    return `${span || "just now"} · ${time}`;
  }
  if (days === 1) return `Yesterday ${time}`;
  if (days === -1) return `Tomorrow ${time}`;
  return `${shortDate(date, now)}, ${time}`;
}

/** Heading for a run of transcript messages from one calendar day. */
export function dayLabel(value: TimeInput, now: Date = new Date()): string {
  const date = toDate(value);
  if (!date) return UNKNOWN_TIME;
  const days = calendarDaysAgo(date, now);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days === -1) return "Tomorrow";
  const base = `${WEEKDAYS[date.getDay()]} ${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === now.getFullYear() ? base : `${base}, ${date.getFullYear()}`;
}

/** True when two values fall on the same local calendar day; false if either is unknown. */
export function isSameDay(a: TimeInput, b: TimeInput): boolean {
  const left = toDate(a);
  const right = toDate(b);
  return Boolean(left && right && calendarDaysAgo(left, right) === 0);
}
