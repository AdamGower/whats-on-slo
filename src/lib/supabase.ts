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
  };
}

// Source priority for deduplication: lowest score wins. Hand-curated rows
// (no source prefix) sit at the top, Ticketmaster wins ties for ticketed
// shows (it has the real ticket-purchase URL), Madonna Inn iCal is similar
// quality but loses the tie to TM, goslo.events is last because it gives us
// only a date, not a time.
const SOURCE_PRIORITY: Array<[string, number]> = [
  ["tm-", 1],
  ["mi-", 2],
  ["gs-", 3],
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

export async function fetchUpcomingEvents(limit = 300): Promise<Event[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("events")
    .select(
      "id,title,starts_at,ends_at,venue,community,description,source,source_url,category"
    )
    .or(`ends_at.gte.${nowIso},and(ends_at.is.null,starts_at.gte.${nowIso})`)
    .order("starts_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch events from Supabase", error);
    return [];
  }

  return dedupRows(data as EventRow[]).map(rowToEvent);
}
