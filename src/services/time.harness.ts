import { dayLabel, formatWhen, isSameDay, UNKNOWN_TIME } from "./time";

/**
 * Pins `formatWhen` and `dayLabel`. Every input is built in local time, so the
 * checks hold in any time zone. Run with `node scripts/test-time.mjs`.
 */
export function runTimeHarness() {
  let passed = 0;
  const check = (actual: string | boolean, expected: string | boolean, message: string) => {
    if (actual !== expected) throw Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    passed++;
  };
  // Monday 28 September 2026, 11:55 local.
  const now = new Date(2026, 8, 28, 11, 55);
  const at = (day: number, hour: number, minute: number, month = 8, year = 2026) => new Date(year, month, day, hour, minute);

  check(formatWhen(at(28, 11, 55), { now }), "just now · 11:55", "Under 45 seconds is just now");
  check(formatWhen(at(28, 11, 43), { now }), "12 min ago · 11:43", "Minutes today");
  check(formatWhen(at(28, 9, 55), { now }), "2 h ago · 09:55", "Hours today");
  check(formatWhen(at(28, 0, 5), { now }), "11 h ago · 00:05", "Early this morning is still today");
  check(formatWhen(at(27, 14, 10), { now }), "Yesterday 14:10", "Yesterday");
  check(formatWhen(at(27, 23, 59), { now }), "Yesterday 23:59", "Late yesterday is yesterday, not hours ago");
  check(formatWhen(at(25, 9, 3), { now }), "Fri Sep 25, 09:03", "Earlier this year");
  check(formatWhen(at(25, 9, 3, 8, 2025), { now }), "Thu Sep 25 2025, 09:03", "Another year names it");
  check(formatWhen(at(28, 9, 55), { now, relative: false }), "09:55", "Relative off leaves the clock");
  check(formatWhen(at(28, 9, 55), { now, withDate: true }), "Mon Sep 28, 09:55", "withDate forces the date");
  check(formatWhen(at(27, 14, 10), { now, withDate: true }), "Sun Sep 27, 14:10", "withDate overrides Yesterday");
  check(formatWhen(at(28, 12, 0), { now }), "in 5 min · 12:00", "Later today");
  check(formatWhen(at(29, 9, 0), { now }), "Tomorrow 09:00", "Tomorrow");
  check(formatWhen(at(28, 9, 55).toISOString(), { now }), "2 h ago · 09:55", "ISO strings");
  check(formatWhen(at(28, 9, 55).getTime(), { now }), "2 h ago · 09:55", "Epoch milliseconds");
  check(formatWhen("not a date", { now }), UNKNOWN_TIME, "Unparseable input stays explicit");
  check(formatWhen(null, { now }), UNKNOWN_TIME, "Missing input stays explicit");

  check(dayLabel(at(28, 1, 0), now), "Today", "Day label today");
  check(dayLabel(at(27, 23, 0), now), "Yesterday", "Day label yesterday");
  check(dayLabel(at(25, 9, 3), now), "Fri Sep 25", "Day label this year");
  check(dayLabel(at(31, 9, 3, 11, 2025), now), "Wed Dec 31, 2025", "Day label another year");
  check(dayLabel("", now), UNKNOWN_TIME, "Day label unknown");

  check(isSameDay(at(28, 0, 1), at(28, 23, 59)), true, "Same day");
  check(isSameDay(at(27, 23, 59), at(28, 0, 0)), false, "Midnight separates days");
  check(isSameDay(undefined, at(28, 1, 0)), false, "Unknown is never the same day");

  return { passed };
}
