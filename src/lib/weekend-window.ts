import { addDays, dayKey, formatLongDate } from "./event-format.ts";
// Relative import with extension so the node test runner can load this file
// directly (it has no "@/" path mapping).

// "This weekend" is Friday through Sunday, Pacific time. Monday to Thursday
// it means the coming weekend; Friday to Sunday it means the current one,
// starting today so events already past drop off.
export function weekendWindow(now = new Date()): {
  friday: string;
  sunday: string;
  from: string; // first day shown (inclusive)
  to: string; // day after Sunday (exclusive)
} {
  const today = dayKey(now);
  const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  const daysToFriday = dow === 0 ? -2 : dow === 6 ? -1 : 5 - dow;
  const friday = addDays(today, daysToFriday);
  const sunday = addDays(friday, 2);
  return { friday, sunday, from: daysToFriday < 0 ? today : friday, to: addDays(sunday, 1) };
}

// "Friday, November 20 to Sunday, November 22"
export function weekendLabel(w: { friday: string; sunday: string }) {
  const f = formatLongDate(new Date(`${w.friday}T19:00:00Z`)).replace(/, \d{4}$/, "");
  const s = formatLongDate(new Date(`${w.sunday}T19:00:00Z`)).replace(/, \d{4}$/, "");
  return `${f} to ${s}`;
}
