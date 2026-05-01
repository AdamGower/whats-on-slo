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
  };
}

// Source priority for deduplication: lowest score wins. Hand-curated rows
// (no source prefix) sit at the top, Ticketmaster wins ties for ticketed
// shows (it has the real ticket-purchase URL), Madonna Inn iCal is similar
// quality but loses the tie to TM, goslo.events is last because it gives us
// only a date, not a time.
const SOURCE_PRIORITY: Array<[string, number]> = [
  ["tm-", 1],
  ["vs-", 2],
  ["mi-", 2],
  ["lib-", 3],
  ["gs-", 4],
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

// Compute "start of today, Pacific time" as a UTC ISO string. Used to filter
// out events whose Pacific calendar day is already in the past — even if
// their ends_at extends into the future. (A multi-day event that started
// last week would otherwise still appear under last week's date header.)
function startOfTodayPacificUtcIso(): string {
  const todayPacific = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  });
  // Try Pacific midnight as if it were UTC, then shift by the Pacific
  // offset for that instant (handles DST automatically).
  const utcGuess = new Date(`${todayPacific}T00:00:00Z`);
  const laFormat = utcGuess.toLocaleString("sv-SE", {
    timeZone: "America/Los_Angeles",
  });
  const laDate = new Date(laFormat.replace(" ", "T") + "Z");
  const offsetMs = utcGuess.getTime() - laDate.getTime();
  return new Date(utcGuess.getTime() + offsetMs).toISOString();
}

// Prevent any single source from dominating a day. The library system has
// hundreds of recurring storytimes/programs; without a cap, the page would
// be entirely "Storytime at X Branch" for the next month and concerts would
// vanish. 3 per source per day still surfaces real library highlights while
// leaving room for everything else.
function balancePerSourcePerDay(
  rows: EventRow[],
  perSourcePerDay: number
): EventRow[] {
  const counts = new Map<string, number>();
  const result: EventRow[] = [];
  for (const r of rows) {
    const day = new Date(r.starts_at).toLocaleDateString("en-CA", {
      timeZone: "America/Los_Angeles",
    });
    const prefix = /^([a-z]+)-/.exec(r.id)?.[1] ?? "curated";
    const key = `${day}|${prefix}`;
    const n = counts.get(key) ?? 0;
    if (n >= perSourcePerDay) continue;
    counts.set(key, n + 1);
    result.push(r);
  }
  return result;
}

export async function fetchUpcomingEvents(): Promise<Event[]> {
  const startOfToday = startOfTodayPacificUtcIso();
  const { data, error } = await supabase
    .from("events")
    .select(
      "id,title,starts_at,ends_at,venue,community,description,source,source_url,category,image_url"
    )
    // Show only events whose Pacific calendar date is today or later.
    // Drops yesterday's events even if their ends_at is in the future —
    // matches the "current and future dates only" UX intent.
    .gte("starts_at", startOfToday)
    .order("starts_at", { ascending: true })
    .limit(2000);

  if (error) {
    console.error("Failed to fetch events from Supabase", error);
    return [];
  }

  const sameSourceCollapsed = collapseSameSourceMultiVenue(data as EventRow[]);
  const deduped = dedupRows(sameSourceCollapsed);
  const balanced = balancePerSourcePerDay(deduped, 3);
  return balanced.map(rowToEvent);
}
