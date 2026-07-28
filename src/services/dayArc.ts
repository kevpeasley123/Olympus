import type { QuietHours } from "../hooks/useOperatorProfile";

/**
 * Geometry for the day arc: a 24-hour ring, midnight at the top, clockwise.
 *
 * Everything here is pure so it can be checked without a browser — the only
 * place this project can verify anything at all without the desktop app.
 */

export type DayTickKind = "commit" | "write";

export interface DayTick {
  kind: DayTickKind;
  /** Fraction of the day, 0 at midnight, 1 at the next midnight. */
  fraction: number;
  label: string;
  detail: string;
}

/** Midnight at the top, clockwise: 0h is -90°, 6h is 0°, 12h is +90°. */
export function fractionToAngle(fraction: number): number {
  return fraction * 360 - 90;
}

export function pointOnRing(fraction: number, centre: number, radius: number) {
  const radians = (fractionToAngle(fraction) * Math.PI) / 180;
  return {
    x: centre + Math.cos(radians) * radius,
    y: centre + Math.sin(radians) * radius
  };
}

/** Local-time position within the day. Ticks and the now-marker share it. */
export function fractionOfDay(date: Date): number {
  return (
    (date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()) / 86_400
  );
}

/**
 * Quiet hours as one or two arcs.
 *
 * `22:00-07:00` wraps midnight, which is the common case and the one a single
 * arc gets wrong — it would shade the waking day instead. Returns two spans in
 * that case rather than one negative one.
 */
export function quietSpans(quiet: QuietHours | null): Array<{ from: number; to: number }> {
  if (!quiet) return [];

  const start = (quiet.start.hour * 60 + quiet.start.minute) / 1440;
  const end = (quiet.end.hour * 60 + quiet.end.minute) / 1440;

  if (start === end) return [];
  if (start < end) return [{ from: start, to: end }];
  return [
    { from: start, to: 1 },
    { from: 0, to: end }
  ];
}

/** An SVG arc path between two fractions of the day, on one radius. */
export function arcPath(
  from: number,
  to: number,
  centre: number,
  radius: number
): string {
  const a = pointOnRing(from, centre, radius);
  const b = pointOnRing(to, centre, radius);
  const largeArc = to - from > 0.5 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 ${largeArc} 1 ${b.x} ${b.y}`;
}

interface CommitLike {
  at: string;
  subject: string;
}

interface WriteLike {
  path: string;
  operation: string;
  writtenAt: string;
}

/** Same calendar day as `now`, in local time. */
function isToday(date: Date, now: Date): boolean {
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function timeLabel(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * Ticks for work that happened today.
 *
 * The window is *today*, not the last 24 hours: the ring shows one day, so an
 * event from yesterday evening would land on the same angle as this evening and
 * read as something that has not happened yet.
 */
export function buildTicks(
  commits: Array<CommitLike & { project?: string }>,
  writes: WriteLike[],
  now: Date
): DayTick[] {
  const ticks: DayTick[] = [];

  for (const commit of commits) {
    const at = new Date(commit.at);
    if (Number.isNaN(at.valueOf()) || !isToday(at, now)) continue;
    ticks.push({
      kind: "commit",
      fraction: fractionOfDay(at),
      label: timeLabel(at),
      detail: commit.project ? `${commit.project} — ${commit.subject}` : commit.subject
    });
  }

  for (const write of writes) {
    // SQLite `CURRENT_TIMESTAMP` is UTC without a zone marker; without the `Z`
    // it would be read as local and land hours off.
    const at = new Date(`${write.writtenAt.replace(" ", "T")}Z`);
    if (Number.isNaN(at.valueOf()) || !isToday(at, now)) continue;
    ticks.push({
      kind: "write",
      fraction: fractionOfDay(at),
      label: timeLabel(at),
      detail: `${write.operation} — ${write.path}`
    });
  }

  return ticks.sort((left, right) => left.fraction - right.fraction);
}
