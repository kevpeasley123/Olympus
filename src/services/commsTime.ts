import { formatWhen, type TimeInput } from "./time";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * A saved-context date. Imported situation context records calendar dates
 * ("2026-09-13"); parsing those as UTC midnight would show a clock time nobody
 * recorded, and the previous day west of Greenwich. Full timestamps go through
 * `formatWhen`.
 */
export function contextDate(value: TimeInput): string {
  if (typeof value === "string") {
    const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (date) {
      const month = MONTHS[Number(date[2]) - 1];
      if (month) return `${month} ${Number(date[3])}, ${date[1]}`;
    }
  }
  return formatWhen(value, { withDate: true });
}
