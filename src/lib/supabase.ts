import { createClient } from "@supabase/supabase-js";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { Event } from "@/types";
import { baseEventSlug, slugDate, slugify } from "@/lib/slug";
import { normalizeCommunity } from "@/lib/towns";
import {
  collapseSameSourceMultiVenue,
  dedupRows,
  sourceScore,
  type EventRow,
} from "@/lib/dedup";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export const supabase = createClient(url, publishableKey);

function rowToEvent(row: EventRow): Omit<Event, "slug"> {
  return {
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at ?? undefined,
    venue: row.venue,
    // Cleaned for display (typos, trailing commas); the row is untouched.
    community: normalizeCommunity(row.community),
    description: row.description,
    source: row.source,
    sourceUrl: row.source_url,
    category: row.category as Event["category"],
    imageUrl: row.image_url ?? undefined,
    timeTba: row.time_tba ?? false,
  };
}

// Hand-curated rows (published from /submit by hand) carry no source prefix.
// Only for those is `source` the organizing body rather than a listing site.
export function isHandCurated(id: string): boolean {
  return sourceScore(id) === 0;
}

// Convert a Pacific calendar date ("YYYY-MM-DD") to the UTC instant of
// midnight Pacific on that date. Anchors Pacific midnight as if it were UTC,
// then shifts by the zone's offset at that instant, so it lands on the right
// absolute time whether the date falls in PST or PDT. This is the single place
// the Pacific-day cutoff is derived; every other cutoff (today, month bounds)
// goes through it.
export function pacificMidnightUtcIso(pacificDate: string): string {
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

// Page through events in the half-open range [gte, lt) straight from the
// database, ordered by start time. Always throws on error so a failed or
// partial read is never written into the cache below. Only the week loader
// and the bounds query call this; pages go through fetchEventRows.
async function queryEventRows(gte: string, lt: string): Promise<EventRow[]> {
  const rows: EventRow[] = [];
  for (let from = 0; from < MAX_EVENTS; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("events")
      .select(EVENT_COLUMNS)
      .gte("starts_at", gte)
      .lt("starts_at", lt)
      .order("starts_at", { ascending: true })
      // Tie-break on the primary key. Rows sharing a starts_at have no
      // inherent order, so a tie straddling a page boundary could repeat some
      // rows on one page and skip them on the next.
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Supabase events fetch failed: ${error.message}`);
    rows.push(...(data as EventRow[]));
    if (data.length < PAGE_SIZE) return rows;
  }
  console.warn(`Hit the ${MAX_EVENTS}-event ceiling; later events were not fetched.`);
  return rows;
}

// --- Shared data cache -----------------------------------------------------
//
// Page-level ISR caches each page's HTML, but every page that renders (a
// first visit, or a background refresh) used to query Supabase for its own
// slice of events. With every event page in the sitemap, crawlers render
// thousands of pages a day, each pulling up to three weeks of events, and the
// free plan's 5 GB egress went in November 2026.
//
// Now the database is read in Pacific-week chunks held in Vercel's Data Cache
// and shared by every page. A week is fetched from Supabase at most once per
// LIVE_WEEK_TTL while it is current or upcoming, and once per PAST_WEEK_TTL
// after it has ended. Week-sized chunks keep each entry well under the Data
// Cache's 2 MB per-item limit.
//
// The deployment id is part of every key, so a redeploy starts from fresh
// data: that remains the way to show a hand-curated row immediately.
const LIVE_WEEK_TTL = 3 * 3600; // scrapes run every 6 hours
const PAST_WEEK_TTL = 7 * 86400;
const DEPLOY_KEY =
  process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local";

function addDaysIso(day: string, n: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

// Monday ("YYYY-MM-DD") of the Pacific week containing a Pacific date.
function weekStartOf(day: string): string {
  const dow = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDaysIso(day, -((dow + 6) % 7));
}

function loadWeek(weekStart: string): Promise<EventRow[]> {
  return queryEventRows(
    pacificMidnightUtcIso(weekStart),
    pacificMidnightUtcIso(addDaysIso(weekStart, 7))
  );
}

const cachedLiveWeek = unstable_cache(loadWeek, ["event-week-live", DEPLOY_KEY], {
  revalidate: LIVE_WEEK_TTL,
  tags: ["events"],
});
const cachedPastWeek = unstable_cache(loadWeek, ["event-week-past", DEPLOY_KEY], {
  revalidate: PAST_WEEK_TTL,
  tags: ["events"],
});

// Pacific date of the earliest and latest event, so open-ended ranges know
// which weeks to read. Two one-row queries, cached on the live schedule.
const cachedEventBounds = unstable_cache(
  async (): Promise<{ first: string; last: string } | null> => {
    const edge = async (ascending: boolean) => {
      const { data, error } = await supabase
        .from("events")
        .select("starts_at")
        .order("starts_at", { ascending })
        .limit(1);
      if (error) throw new Error(`Supabase bounds fetch failed: ${error.message}`);
      return (data as { starts_at: string }[])[0]?.starts_at ?? null;
    };
    const [first, last] = await Promise.all([edge(true), edge(false)]);
    if (!first || !last) return null;
    return { first: pacificDayOf(first), last: pacificDayOf(last) };
  },
  ["event-bounds", DEPLOY_KEY],
  { revalidate: LIVE_WEEK_TTL, tags: ["events"] }
);

// Events in the half-open range [gte, lt) ordered by start time, assembled
// from cached weeks. `lt` is optional: the upcoming view leaves the far edge
// open, a month view bounds it. Same contract as the old direct query.
async function fetchEventRows(
  gte: string,
  lt?: string,
  strict = false
): Promise<EventRow[]> {
  const rows: EventRow[] = [];
  try {
    const bounds = await cachedEventBounds();
    if (!bounds) return rows;
    let fromDay = pacificDayOf(gte);
    if (fromDay < bounds.first) fromDay = bounds.first;
    // lt is exclusive; the day before it is the last day we need.
    let toDay = lt ? pacificDayOf(new Date(Date.parse(lt) - 1).toISOString()) : bounds.last;
    if (toDay > bounds.last) toDay = bounds.last;
    if (toDay < fromDay) return rows;

    const thisWeek = weekStartOf(pacificDayOf(new Date().toISOString()));
    const weeks: string[] = [];
    for (let w = weekStartOf(fromDay); w <= toDay; w = addDaysIso(w, 7)) weeks.push(w);

    const chunks = await Promise.all(
      weeks.map((w) => (w < thisWeek ? cachedPastWeek(w) : cachedLiveWeek(w)))
    );
    const gteMs = Date.parse(gte);
    const ltMs = lt ? Date.parse(lt) : Infinity;
    for (const chunk of chunks) {
      for (const r of chunk) {
        const t = Date.parse(r.starts_at);
        if (t >= gteMs && t < ltMs) rows.push(r);
      }
    }
    return rows;
  } catch (err) {
    // Strict callers (event, weekend, town pages) throw instead: a failed
    // background refresh then keeps the last good cached page, where an
    // empty result would cache a 404 or an empty list for hours.
    if (strict) throw err;
    // A partial calendar beats an empty one, and the log surfaces it.
    console.error("Failed to fetch events from Supabase", err);
    return rows;
  }
}

// Shared post-processing: collapse same-source multi-venue dupes, dedup across
// sources, cap per-source-per-day, map to the UI shape. Applied identically to
// the upcoming view and any single-month view, so a past month renders exactly
// the way today's calendar does.
function assembleEvents(rows: EventRow[]): Event[] {
  const sameSourceCollapsed = collapseSameSourceMultiVenue(rows);
  const deduped = dedupRows(sameSourceCollapsed);
  const balanced = balancePerSourcePerDay(deduped);
  return assignSlugs(balanced.map(rowToEvent));
}

function pacificDayOf(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  });
}

// Give every event its /events/[slug] URL: title + Pacific date. Two events
// can share a title on one day (the same show listed at two venues); the
// highest-priority source keeps the plain slug and the rest add their venue.
// Every input to this is per-day (dedup, collapse and the daily cap all key on
// the Pacific day), so an event gets the same slug whichever date range it
// was fetched in: the homepage, a month view or a single-day lookup.
function assignSlugs(events: Omit<Event, "slug">[]): Event[] {
  const groups = new Map<string, Omit<Event, "slug">[]>();
  for (const ev of events) {
    const base = baseEventSlug(ev.title, pacificDayOf(ev.startsAt));
    const list = groups.get(base);
    if (list) list.push(ev);
    else groups.set(base, [ev]);
  }
  const slugById = new Map<string, string>();
  const taken = new Set<string>(groups.keys());
  for (const [base, list] of groups) {
    list.sort(
      (a, b) => sourceScore(a.id) - sourceScore(b.id) || a.id.localeCompare(b.id)
    );
    slugById.set(list[0].id, base);
    for (const ev of list.slice(1)) {
      const day = pacificDayOf(ev.startsAt);
      const stem = `${slugify(ev.title) || "event"}-${slugify(ev.venue, 40) || "venue"}`;
      let slug = `${stem}-${day}`;
      for (let n = 2; taken.has(slug); n++) slug = `${stem}-${n}-${day}`;
      taken.add(slug);
      slugById.set(ev.id, slug);
    }
  }
  return events.map((ev) => ({ ...ev, slug: slugById.get(ev.id)! }));
}

export async function fetchUpcomingEvents(): Promise<Event[]> {
  // Events whose Pacific calendar day is today or later. Drops yesterday's
  // events even if their ends_at is in the future — the "current and future
  // dates only" default view.
  const rows = await fetchEventRows(startOfTodayPacificUtcIso());
  return assembleEvents(rows);
}

// Events whose Pacific calendar day falls in [fromDay, toDay), both
// "YYYY-MM-DD". Backs the weekend, town, related-events and embed views.
export async function fetchEventsBetweenDays(
  fromDay: string,
  toDay: string
): Promise<Event[]> {
  const rows = await fetchEventRows(
    pacificMidnightUtcIso(fromDay),
    pacificMidnightUtcIso(toDay),
    true
  );
  return assembleEvents(rows);
}

function nextDay(day: string): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
}

// One event by its /events/[slug] URL. The slug ends in the Pacific date, so
// only that day is fetched, then put through the same pipeline as every list
// so the slug matches the one the listing linked to. Wrapped in cache() so
// generateMetadata and the page share one fetch per request.
export const fetchEventBySlug = cache(
  async (slug: string): Promise<Event | null> => {
    const day = slugDate(slug);
    if (!day) return null;
    const events = await fetchEventsBetweenDays(day, nextDay(day));
    return events.find((ev) => ev.slug === slug) ?? null;
  }
);

// Fetch a single Pacific calendar month ("YYYY-MM") in full, including days
// already past. Backs the direct-URL past-month view; the month rail never
// links here because it only lists upcoming months.
export async function fetchEventsForMonth(month: string): Promise<Event[]> {
  const { start, end } = pacificMonthWindowUtcIso(month);
  const rows = await fetchEventRows(start, end);
  return assembleEvents(rows);
}

// Every event ever listed, past and future, through the same pipeline as the
// pages so the slugs match. Backs the sitemap: past event pages stay live and
// keep their search value. Strict, so a failed refresh keeps the last sitemap
// rather than publishing an empty one.
export async function fetchAllEvents(): Promise<Event[]> {
  const rows = await fetchEventRows("1970-01-01T00:00:00Z", undefined, true);
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
