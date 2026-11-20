import type { Event } from "@/types";

// Shared date/time/text helpers for every page that renders events. Lifted out
// of EventsView so the event, weekend, town and embed pages format identically.

export const TIMEZONE = "America/Los_Angeles";
export const DESCRIPTION_WORD_LIMIT = 50;

export const CATEGORIES: Event["category"][] = [
  "Music",
  "Food & Drink",
  "Arts",
  "Community",
  "Family",
  "Outdoors",
];

export function eventDate(iso: string) {
  return new Date(iso);
}

// "2026-04-30": the Pacific calendar day of a Date
export function dayKey(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

// "2026-04": the Pacific calendar month of a Date
export function monthKey(d: Date) {
  return dayKey(d).slice(0, 7);
}

// "00:00" style Pacific wall-clock time of a Date
function pacificClock(d: Date) {
  return d
    .toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: TIMEZONE,
    })
    .slice(0, 5);
}

// Shift a "YYYY-MM-DD" day key by n days (pure calendar arithmetic).
export function addDays(day: string, n: number) {
  return new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

// How an event's start time should be presented.
//
//   "timed"  — starts_at is a real clock time.
//   "allday" — the source marked it all-day. Feeds encode that as a midnight
//              Pacific start plus an end at 23:59 (Visit SLO) or at midnight
//              (the library, start == end or end on a later day).
//   "tba"    — no real time: either flagged time_tba by a scraper (sentinel
//              hour), or a bare midnight start with nothing marking it
//              all-day. BigBigSLO and goslo concerts arrive that way, and
//              calling a concert "All day" would be wrong.
export type TimeKind = "timed" | "allday" | "tba";

export function timeKind(ev: Pick<Event, "startsAt" | "endsAt" | "timeTba">): TimeKind {
  if (ev.timeTba) return "tba";
  const start = eventDate(ev.startsAt);
  if (pacificClock(start) !== "00:00") return "timed";
  if (!ev.endsAt) return "tba";
  const end = eventDate(ev.endsAt);
  const endClock = pacificClock(end);
  if (dayKey(end) > dayKey(start)) return "allday";
  if (endClock === "00:00" || endClock >= "23:59") return "allday";
  return "tba";
}

// Last Pacific calendar day an all-day event covers. A midnight end means the
// event finished at the end of the previous day.
export function allDayLastDay(ev: Pick<Event, "startsAt" | "endsAt">): string {
  const startDay = dayKey(eventDate(ev.startsAt));
  if (!ev.endsAt) return startDay;
  const end = eventDate(ev.endsAt);
  let last = dayKey(end);
  if (pacificClock(end) === "00:00") last = addDays(last, -1);
  return last < startDay ? startDay : last;
}

export function formatMonthLabel(monthKey: string) {
  // Noon Pacific on the first of the month, for safe formatting
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1, 19, 0, 0));
  return d.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: TIMEZONE,
  });
}

export function formatMonthShort(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1, 19, 0, 0));
  const month = d.toLocaleDateString("en-US", {
    month: "short",
    timeZone: TIMEZONE,
  });
  const yr = String(y).slice(-2);
  return `${month} ’${yr}`;
}

export function formatDayLabel(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: TIMEZONE,
  });
}

// "Saturday, November 22, 2026"
export function formatLongDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: TIMEZONE,
  });
}

// Compact per-card date stamp, e.g. "Fri, May 1"
export function formatCompactDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: TIMEZONE,
  });
}

// "May 17" for a "YYYY-MM-DD" day key
export function formatShortDay(day: string) {
  return new Date(`${day}T19:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: TIMEZONE,
  });
}

export function formatTime(d: Date) {
  return d
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: TIMEZONE,
    })
    .replace(":00 ", " ");
}

export function formatTimeRange(start: Date, end?: Date) {
  const s = formatTime(start);
  if (!end) return s;
  if (dayKey(end) !== dayKey(start)) {
    return `${s} → ${end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: TIMEZONE,
    })}`;
  }
  return `${s} – ${formatTime(end)}`;
}

// The time line shown on every event card and event page.
export function formatEventTime(ev: Pick<Event, "startsAt" | "endsAt" | "timeTba">) {
  const kind = timeKind(ev);
  if (kind === "tba") return "Time TBA";
  if (kind === "allday") {
    const startDay = dayKey(eventDate(ev.startsAt));
    const last = allDayLastDay(ev);
    return last === startDay ? "All day" : `All day, through ${formatShortDay(last)}`;
  }
  return formatTimeRange(
    eventDate(ev.startsAt),
    ev.endsAt ? eventDate(ev.endsAt) : undefined
  );
}

// Library staff write bilingual English-then-Spanish descriptions joined into
// one paragraph. Cut at the first ¡ or ¿ — those characters are unique to
// Spanish and never appear in English, so this is a safe, deterministic
// language boundary.
export function stripBilingualSpanish(text: string) {
  if (!text) return text;
  const idx = text.search(/[¡¿]/);
  return idx === -1 ? text : text.slice(0, idx).trim();
}

// HTML stripping in scrapers can leave sentences smashed together when
// paragraph tags are removed: "End.Next sentence" or "(format)Next". Insert
// a space between sentence-ending punctuation and the next capitalized word.
export function fixPunctuationSpacing(text: string) {
  if (!text) return text;
  return text.replace(/([.!?)])([A-Z])/g, "$1 $2");
}

// A scraper may end its description with a final "Source: ..." line that
// should render below the body in muted italic styling rather than be
// truncated as part of the body text. This is a lightweight convention —
// any source can opt in by appending "\n\nSource: ..." to the description.
export function splitSourceAttribution(text: string): {
  body: string;
  source: string | null;
} {
  if (!text) return { body: "", source: null };
  const m = text.match(/\n\s*(Source:\s*[^\n]+?)\s*$/);
  if (!m) return { body: text, source: null };
  return { body: text.slice(0, m.index!).trimEnd(), source: m[1] };
}

// The description as shown on a full event page: same cleanup as the card,
// no truncation.
export function cleanDescription(text: string) {
  if (!text) return "";
  return fixPunctuationSpacing(stripBilingualSpanish(text)).trim();
}

// Truncate at a word boundary near maxWords. Adds an ellipsis when truncated.
export function truncateWords(text: string, maxWords: number) {
  if (!text) return "";
  const cleaned = cleanDescription(text);
  const words = cleaned.split(/\s+/);
  if (words.length <= maxWords) return cleaned;
  // Try to break on the nearest sentence-ending punctuation in the last few
  // words of the cap so we don't dangle mid-clause.
  const slice = words.slice(0, maxWords);
  for (let i = slice.length - 1; i >= Math.max(0, slice.length - 8); i--) {
    if (/[.!?]$/.test(slice[i])) return slice.slice(0, i + 1).join(" ");
  }
  return slice.join(" ") + "…";
}

export function groupByDay(events: Event[]) {
  const map = new Map<string, Event[]>();
  for (const ev of events) {
    const key = dayKey(eventDate(ev.startsAt));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}
