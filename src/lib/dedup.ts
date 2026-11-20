// Cross-source duplicate handling for event rows. Pure functions with no
// "@/" imports, so the node test runner can load this file directly.

export type EventRow = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  venue: string;
  community: string;
  description: string;
  source: string;
  source_url: string;
  category: string;
  image_url: string | null;
  time_tba: boolean | null;
};

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
export function sourceScore(id: string): number {
  for (const [prefix, score] of SOURCE_PRIORITY) {
    if (id.startsWith(prefix)) return score;
  }
  return 0; // hand-curated rows have no prefix
}

function sourcePrefix(id: string) {
  return /^([a-z]+)-/.exec(id)?.[1] ?? "curated";
}

function titleSlug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function pacificDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

function byStart(a: EventRow, b: EventRow) {
  return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
}

// Build a cross-source dedup key that catches "same event indexed by two
// different scrapers." Title slug + Pacific calendar day + first word of venue
// is robust against minor naming differences ("SLO Brew Rock" vs "Slo Brew",
// "Fremont Theater" vs "Fremont") without falsely collapsing different events
// that happen to share a generic title (e.g. "Live music").
function dedupKey(row: EventRow): string {
  const venueFirstWord = row.venue
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")[0];
  return `${pacificDay(row.starts_at)}|${titleSlug(row.title)}|${venueFirstWord}`;
}

// Placeholder copy some sources write when they have no real description:
// Ticketmaster's "Live music at X." (once "Live undefined at X."), goslo's
// "Live event at X. Time TBA", BigBigSLO's "The event is held on <date> at X
// in Town, CA." What is left after removing those is the real description.
export function substantiveText(description: string) {
  return (description ?? "")
    .replace(/The event is held on [^.]*?, CA\.\s*/g, "")
    .replace(/^Live [a-z ]+ at [^.]+\.\s*(Time TBA[^.]*\.)?/i, "")
    .trim();
}

export function isWeakDescription(description: string) {
  return substantiveText(description).length < 40;
}

// The winning row keeps its source, link and time, but when its description
// is placeholder copy or its end time is missing (or equal to its start), it
// borrows them from a duplicate that has better ones.
function enrich(winner: EventRow, group: EventRow[]): EventRow {
  const out = { ...winner };
  if (isWeakDescription(out.description)) {
    const better = group
      .filter((r) => r !== winner && !isWeakDescription(r.description))
      .sort((a, b) => b.description.length - a.description.length)[0];
    if (better) out.description = better.description;
  }
  const start = new Date(out.starts_at).getTime();
  const hasEnd = out.ends_at && new Date(out.ends_at).getTime() > start;
  if (!hasEnd) {
    const end = group.find(
      (r) =>
        r !== winner &&
        new Date(r.starts_at).getTime() === start &&
        r.ends_at &&
        new Date(r.ends_at).getTime() > start,
    )?.ends_at;
    if (end) out.ends_at = end;
  }
  if (!out.image_url) {
    out.image_url = group.find((r) => r.image_url)?.image_url ?? null;
  }
  return out;
}

export function dedupRows(rows: EventRow[]): EventRow[] {
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
    list.sort((a, b) => sourceScore(a.id) - sourceScore(b.id) || byStart(a, b));
    // The best source wins. Its other rows in the group at different start
    // times are separate showings (a matinee and an evening show), so they
    // stay; other sources' copies of those showings are dropped.
    const best = sourcePrefix(list[0].id);
    const seen = new Set<string>();
    for (const row of list) {
      if (sourcePrefix(row.id) !== best || seen.has(row.starts_at)) continue;
      seen.add(row.starts_at);
      const sameShowing = list.filter(
        (r) => r === row || sourcePrefix(r.id) !== best,
      );
      winners.push(enrich(row, sameShowing));
    }
  }
  return mergeSameStartAcrossSources(winners).sort(byStart);
}

// A second pass for duplicates whose venue names differ too much for the
// first-word key ("Harold Miossi Hall – Performing Arts Center" vs
// "Performing Arts Center San Luis Obispo"): the same title starting at the
// same minute in the same town, listed by different sources, is one event.
function mergeSameStartAcrossSources(rows: EventRow[]): EventRow[] {
  const groups = new Map<string, EventRow[]>();
  for (const row of rows) {
    const k = `${new Date(row.starts_at).getTime()}|${titleSlug(row.title)}|${row.community
      .toLowerCase()
      .replace(/[^a-z]+/g, "")}`;
    const list = groups.get(k);
    if (list) list.push(row);
    else groups.set(k, [row]);
  }
  const out: EventRow[] = [];
  for (const list of groups.values()) {
    const sources = new Set(list.map((r) => sourcePrefix(r.id)));
    if (list.length === 1 || sources.size !== list.length) {
      out.push(...list);
      continue;
    }
    list.sort((a, b) => sourceScore(a.id) - sourceScore(b.id));
    out.push(enrich(list[0], list));
  }
  return out;
}

// When the SAME source posts the SAME title on the SAME day at multiple
// venues, collapse them into one row with a venue label that reflects the
// count. The library system does this routinely — a system-wide "Book
// Giveaway" gets posted at every branch, which read as duplicates on the
// page even though they're technically distinct events. Rows at one venue
// are separate showings (matinee and evening) and are left alone.
export function collapseSameSourceMultiVenue(rows: EventRow[]): EventRow[] {
  const groups = new Map<string, EventRow[]>();
  for (const row of rows) {
    const k = `${sourcePrefix(row.id)}|${pacificDay(row.starts_at)}|${titleSlug(row.title)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(row);
  }
  const out: EventRow[] = [];
  for (const group of groups.values()) {
    const venues = new Set(group.map((r) => r.venue.trim().toLowerCase()));
    if (group.length === 1 || venues.size === 1) {
      out.push(...group);
      continue;
    }
    // Pick a representative (alphabetical by venue) and rewrite venue to
    // reflect the count. Library is the common case; "library branches"
    // reads naturally there. Other sources fall back to "venues".
    group.sort((a, b) => a.venue.localeCompare(b.venue));
    const representative = { ...group[0] };
    representative.venue = representative.id.startsWith("lib-")
      ? `${venues.size} library branches`
      : `${venues.size} venues`;
    out.push(representative);
  }
  return out.sort(byStart);
}
