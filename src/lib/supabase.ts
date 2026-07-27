import { createClient } from "@supabase/supabase-js";
import type { Event } from "@/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(url, publishableKey);

type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  venue: string;
  community: string;
  description: string;
  source: string;
  source_url: string;
  category: Event["category"];
  image_url: string | null;
  time_tba: boolean | null;
};

function rowToEvent(row: EventRow): Event {
  return {
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at ?? undefined,
    venue: row.venue,
    community: row.community,
    description: row.description,
    source: row.source,
    sourceUrl: row.source_url,
    category: row.category,
    imageUrl: row.image_url ?? undefined,
    timeTba: row.time_tba ?? false,
  };
}

// Source priority for deduplication: lowest score wins. Hand-curated rows
// (no source prefix) sit at the top, Ticketmaster wins ties for ticketed
// shows (it has the real ticket-purchase URL), Madonna Inn iCal is similar
// quality but loses the tie to TM, goslo.events is last because it gives us
// only a date, not a time. Rideshare Bike Month sits with the library tier:
// real start times but a generic fallback URL more often than not. BigBigSLO
// is an aggregator-of-aggregators (CitySpark): real start times but URLs
// often resolve to slochamber.org / bandsintown rather than the venue,
// so it beats goslo on time-of-day but loses to the venue-direct tier.
// RunSignup (rsu-) races carry the official organizer URL and real start
// times, so they sit in the venue-direct tier alongside Visit SLO.
const SOURCE_PRIORITY: Array<[string, number]> = [
  ["tm-", 1],
  ["vs-", 2],
  ["mi-", 2],
  ["rsu-", 2],
  ["rs-", 3],
  ["lib-", 3],
  ["bbs-", 4],
  ["gs-", 5],
];
function sourceScore(id: string): number {
  for (const [prefix, score] of SOURCE_PRIORITY) {
    if (id.startsWith(prefix)) return score;
  }
  return 0; // hand-curated rows have no prefix
}

// Build a cross-source dedup key that catches "same event indexed by two
// different scrapers." Title slug + Pacific calendar day + first word of venue
// is robust against minor naming differences ("SLO Brew Rock" vs "Slo Brew",
// "Fremont Theater" vs "Fremont") without falsely collapsing different events
// that happen to share a generic title (e.g. "Live music").
function dedupKey(row: EventRow): string {
  const titleSlug = row.title.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const venueFirstWord = row.venue
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")[0];
  const pacificDay = new Date(row.starts_at).toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  });
  return `${pacificDay}|${titleSlug}|${venueFirstWord}`;
}

function dedupRows(rows: EventRow[]): EventRow[] {
  const groups = new Map<string, EventRow[]>();
  for (const row of rows) {
    const k = dedupKey(row);
    const list = groups.get(k);
    if (list) list.push(row);
    else groups.set(k, [row]);
  }
  const winners: EventRow[] = [];
  for (const list of groups.values()) {
    if (list.length === 1) {
      winners.push(list[0]);
      continue;
    }
    list.sort((a, b) => sourceScore(a.id) - sourceScore(b.id));
    winners.push(list[0]);
  }
  // Re-sort by start time after dedup since we lost original order
  return winners.sort(
    (a, b) =>
      new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );
}

// When the SAME source posts the SAME title on the SAME day at multiple
// venues, collapse them into one row with a venue label that reflects the
// count. The library system does this routinely — a system-wide "Book
// Giveaway" gets posted at every branch, which read as duplicates on the
// page even though they're technically distinct events.
function collapseSameSourceMultiVenue(rows: EventRow[]): EventRow[] {
  const groups = new Map<string, EventRow[]>();
  for (const row of rows) {
    const sourcePrefix = /^([a-z]+)-/.exec(row.id)?.[1] ?? "curated";
    const titleSlug = row.title.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const day = new Date(row.starts_at).toLocaleDateString("en-CA", {
      timeZone: "America/Los_Angeles",
    });
    const k = `${sourcePrefix}|${day}|${titleSlug}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(row);
  }
  const out: EventRow[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }
    // Pick a representative (alphabetical by venue) and rewrite venue to
    // reflect the count. Library is the common case; "library branches"
    // reads naturally there. Other sources fall back to "venues".
    group.sort((a, b) => a.venue.localeCompare(b.venue));
    const representative = { ...group[0] };
    representative.venue = representative.id.startsWith("lib-")
      ? `${group.length} library branches`
      : `${group.length} venues`;
    out.push(representative);
  }
  return out.sort(
    (a, b) =>
      new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );
}

// Convert a Pacific calendar date ("YYYY-MM-DD") to the UTC instant of
// midnight Pacific on that date. Anchors Pacific midnight as if it were UTC,
// then shifts by the zone's offset at that instant, so it lands on the right
// absolute time whether the date falls in PST or PDT. This is the single place
// the Pacific-day cutoff is derived; every other cutoff (today, month bounds)
// goes through it.
function pacificMidnightUtcIso(pacificDate: string): string {
  const utcGuess = new Date(`${pacificDate}T00:00:00Z`);
  const laFormat = utcGuess.toLocaleString("sv-SE", {
    timeZone: "America/Los_Angeles",
  });
  const laDate = new Date(laFormat.replace(" ", "T") + "Z");
  const offsetMs = utcGuess.getTime() - laDate.getTime();
  return new Date(utcGuess.getTime() + offsetMs).toISOString();
}

// "Start of today, Pacific time" as a UTC ISO string. The default view's
// cutoff: events whose Pacific calendar day is already past drop off, even if
// an ends_at extends into the future. Rolls over on its own each midnight
// because it reads the wall clock on every call.
function startOfTodayPacificUtcIso(): string {
  const todayPacific = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  });
  return pacificMidnightUtcIso(todayPacific);
}

// UTC [start, end) bounds for a Pacific calendar month ("YYYY-MM"). Backs the
// on-demand past-month view. Both edges go through pacificMidnightUtcIso, so a
// month that straddles a DST change still gets the correct offset on each side.
function pacificMonthWindowUtcIso(month: string): { start: string; end: string } {
  const [year, mon] = month.split("-").map(Number);
  const nextYear = mon === 12 ? year + 1 : year;
  const nextMon = mon === 12 ? 1 : mon + 1;
  const nextStart = `${nextYear}-${String(nextMon).padStart(2, "0")}-01`;
  return {
    start: pacificMidnightUtcIso(`${month}-01`),
    end: pacificMidnightUtcIso(nextStart),
  };
}

// Per-source daily caps. Library is throttled hard because the system has
// hundreds of recurring programs (storytimes, etc.) that would otherwise
// dominate the page. Every other source is curated enough that its natural
// volume is fine — a high cap is just a safety net against future runaway
// scrapers, not a real squeeze.
const PER_SOURCE_DAILY_CAP: Record<string, number> = {
  lib: 3,
};
const DEFAULT_DAILY_CAP = 15;

function balancePerSourcePerDay(rows: EventRow[]): EventRow[] {
  const counts = new Map<string, number>();
  const result: EventRow[] = [];
  for (const r of rows) {
    const day = new Date(r.starts_at).toLocaleDateString("en-CA", {
      timeZone: "America/Los_Angeles",
    });
    const prefix = /^([a-z]+)-/.exec(r.id)?.[1] ?? "curated";
    const cap = PER_SOURCE_DAILY_CAP[prefix] ?? DEFAULT_DAILY_CAP;
    const key = `${day}|${prefix}`;
    const n = counts.get(key) ?? 0;
    if (n >= cap) continue;
    counts.set(key, n + 1);
    result.push(r);
  }
  return result;
}

const EVENT_COLUMNS =
  "id,title,starts_at,ends_at,venue,community,description,source,source_url,category,image_url,time_tba";

// The Data API caps any single response at 1000 rows, and it does so
// silently: ask for more and you still get 1000, with no error and no flag.
// The upcoming-events count passed that mark in July 2026, so a one-shot
// query would quietly drop the far end of the calendar. Page through instead.
const PAGE_SIZE = 1000;
const MAX_EVENTS = 10_000; // backstop so a bad cursor cannot loop forever

// Page through events in the half-open range [gte, lt) ordered by start time.
// `lt` is optional: the upcoming view leaves the far edge open, a month view
// bounds it. The Data API caps any single response at 1000 rows and does so
// silently, so we page rather than one-shot.
async function fetchEventRows(gte: string, lt?: string): Promise<EventRow[]> {
  const rows: EventRow[] = [];
  for (let from = 0; from < MAX_EVENTS; from += PAGE_SIZE) {
    let query = supabase
      .from("events")
      .select(EVENT_COLUMNS)
      .gte("starts_at", gte);
    if (lt) query = query.lt("starts_at", lt);
    const { data, error } = await query
      .order("starts_at", { ascending: true })
      // Tie-break on the primary key. Rows sharing a starts_at have no
      // inherent order, so a tie straddling a page boundary could repeat some
      // rows on one page and skip them on the next.
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      // Keep whatever we already have: a partial calendar beats an empty one,
      // and the log surfaces the failure.
      console.error("Failed to fetch events from Supabase", error);
      return rows;
    }
    rows.push(...(data as EventRow[]));
    if (data.length < PAGE_SIZE) return rows;
  }
  console.warn(
    `Hit the ${MAX_EVENTS}-event ceiling; later events were not fetched.`
  );
  return rows;
}

// Shared post-processing: collapse same-source multi-venue dupes, dedup across
// sources, cap per-source-per-day, map to the UI shape. Applied identically to
// the upcoming view and any single-month view, so a past month renders exactly
// the way today's calendar does.
function assembleEvents(rows: EventRow[]): Event[] {
  const sameSourceCollapsed = collapseSameSourceMultiVenue(rows);
  const deduped = dedupRows(sameSourceCollapsed);
  const balanced = balancePerSourcePerDay(deduped);
  return balanced.map(rowToEvent);
}

export async function fetchUpcomingEvents(): Promise<Event[]> {
  // Events whose Pacific calendar day is today or later. Drops yesterday's
  // events even if their ends_at is in the future — the "current and future
  // dates only" default view.
  const rows = await fetchEventRows(startOfTodayPacificUtcIso());
  return assembleEvents(rows);
}

// Fetch a single Pacific calendar month ("YYYY-MM") in full, including days
// already past. Backs the direct-URL past-month view; the month rail never
// links here because it only lists upcoming months.
export async function fetchEventsForMonth(month: string): Promise<Event[]> {
  const { start, end } = pacificMonthWindowUtcIso(month);
  const rows = await fetchEventRows(start, end);
  return assembleEvents(rows);
}

// Distinct Pacific months that have at least one event, past and future, for
// the sitemap. Selects only starts_at (cheap) and buckets by Pacific month, so
// search engines can reach archived months the default view hides.
export async function fetchAllEventMonths(): Promise<string[]> {
  const months = new Set<string>();
  for (let from = 0; from < MAX_EVENTS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("events")
      .select("starts_at")
      .order("starts_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("Failed to fetch event months from Supabase", error);
      break;
    }
    for (const row of data as { starts_at: string }[]) {
      const key = new Date(row.starts_at)
        .toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })
        .slice(0, 7);
      months.add(key);
    }
    if (data.length < PAGE_SIZE) break;
  }
  return Array.from(months).sort();
}
