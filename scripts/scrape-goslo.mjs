// Scrape goslo.events — the main local live-music aggregator.
//
// goslo's November 2026 redesign removed the server-rendered /all page we used
// to parse. The new /calendar page is an empty shell that its script fills from
// /events.json, so we read that JSON directly: one request, the whole calendar,
// with structured dates, venues and towns instead of scraped markup.
//
// Each item's `date` is a naive Pacific wall-clock time ("2026-11-13T19:30").
// Items with no known time arrive at T00:00; those get a noon-Pacific sentinel
// and time_tba=true so the UI shows "Time TBA" and enrich-event-times.mjs can
// look for the real time on the event page.

import { createScraperClient } from "./_supabase.mjs";
import { logRun } from "./_log-run.mjs";
import { fetchWithRetry } from "./_fetch-retry.mjs";
import {
  firstPrunableDay,
  latestPacificDay,
  pruneMissing,
} from "./_prune-missing.mjs";
import { cleanText } from "./_clean-html.mjs";

const FEED_URL = "https://goslo.events/events.json";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// "2026-11-13T19:30" → { y, mo, d, hh, mm }, or null if it isn't that shape.
export function parseWallClock(s) {
  const m = String(s ?? "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [y, mo, d, hh, mm] = m.slice(1).map(Number);
  return { y, mo, d, hh, mm };
}

// Convert Pacific wall-clock parts to a UTC ISO string, DST-safe. (Same trick
// the other scrapers use: treat the parts as UTC, see what that instant reads
// as in Los Angeles, and shift by the difference.)
export function pacificPartsToUtcIso({ y, mo, d, hh, mm }) {
  const asUtc = new Date(Date.UTC(y, mo - 1, d, hh, mm));
  const laStr = asUtc.toLocaleString("sv-SE", {
    timeZone: "America/Los_Angeles",
  });
  const laAsUtc = new Date(laStr.replace(" ", "T") + "Z");
  return new Date(asUtc.getTime() + (asUtc.getTime() - laAsUtc.getTime())).toISOString();
}

// The LOCAL calendar day as "Wed Dec 09 2026" — the date format goslo still
// uses in its RSS digest, and the one the old /all page's headings fed into
// our ids, so upserts update existing gs- rows rather than duplicating them.
export function dayLabel({ y, mo, d }) {
  const weekday = WEEKDAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  return `${weekday} ${MONTHS[mo - 1]} ${String(d).padStart(2, "0")} ${y}`;
}

// goslo's own categories → our taxonomy.
const CATEGORY_MAP = {
  music: "Music",
  "food-drink": "Food & Drink",
  art: "Arts",
  arts: "Arts",
  theater: "Arts",
  film: "Arts",
  comedy: "Arts",
  lecture: "Arts",
  "kids-family": "Family",
  family: "Family",
  "sports-outdoors": "Outdoors",
  community: "Community",
  "festival-market": "Community",
  "social-games": "Community",
  class: "Community",
};

function guessCategory(title, venue) {
  const t = `${title} ${venue}`.toLowerCase();
  if (/\b(trivia|karaoke|game night|bingo)\b/.test(t)) return "Community";
  if (/\b(museum|gallery|exhibit|sculpture|art walk)\b/.test(t)) return "Arts";
  if (/\b(farmers? market|wine|tasting|food fest|brewery tour)\b/.test(t))
    return "Food & Drink";
  if (/\b(family|kids|children|story\s?time)\b/.test(t)) return "Family";
  if (/\b(hike|run|race|paddle|surf|outdoor)\b/.test(t)) return "Outdoors";
  return "Music"; // goslo is primarily a music aggregator
}

// goslo's venue.town values that match our community names exactly.
const KNOWN_COMMUNITIES = new Set([
  "San Luis Obispo", "Morro Bay", "Los Osos", "Cayucos", "Cambria",
  "Avila Beach", "Pismo Beach", "Grover Beach", "Arroyo Grande", "Atascadero",
  "Templeton", "Paso Robles", "Santa Margarita", "Nipomo", "Oceano",
  "Shell Beach",
]);

// Fallback when goslo gives no town: derive one from the venue name.
const VENUE_TO_COMMUNITY = [
  [/morro bay|the siren/i, "Morro Bay"],
  [/los osos/i, "Los Osos"],
  [/cayucos/i, "Cayucos"],
  [/cambria/i, "Cambria"],
  [/avila/i, "Avila Beach"],
  [/pismo/i, "Pismo Beach"],
  [/grover/i, "Grover Beach"],
  [/arroyo grande/i, "Arroyo Grande"],
  [/atascadero/i, "Atascadero"],
  [/templeton/i, "Templeton"],
  [/paso/i, "Paso Robles"],
];

function communityFor(venue) {
  const town = cleanText(venue?.town);
  if (KNOWN_COMMUNITIES.has(town)) return town;
  const name = venue?.name ?? "";
  for (const [re, community] of VENUE_TO_COMMUNITY) {
    if (re.test(name)) return community;
  }
  return "San Luis Obispo";
}

// Map events.json items to events rows. Pure, for tests.
//
// Recurring items ("every Wednesday", happy hours, weekly classes) are
// skipped: the feed gives only a first date and a free-text schedule, which
// would become one misleading row. Items goslo marks "promotion" are paid or
// sponsored placements rather than events, so they are skipped too.
// Multi-day one-offs keep one row at their start, as before.
export function buildRows(items) {
  const rows = [];
  const seen = new Set();
  for (const item of Array.isArray(items) ? items : []) {
    if (item?.recurring) continue;
    if (item?.category === "promotion") continue;

    const title = cleanText(item?.title);
    const start = parseWallClock(item?.date);
    const venueName = cleanText(item?.venue?.name) || "TBA";
    const sourceUrl = item?.detailsLink || item?.venue?.url;
    if (!title || !start || !sourceUrl) continue;

    const timeTba = start.hh === 0 && start.mm === 0;
    const startsAt = pacificPartsToUtcIso(
      timeTba ? { ...start, hh: 12, mm: 0 } : start
    );
    const end = parseWallClock(item?.dateEnd);
    const endsAt =
      end && !(end.hh === 0 && end.mm === 0) ? pacificPartsToUtcIso(end) : null;

    const id = `gs-${slugify(title)}-${slugify(dayLabel(start))}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const description =
      cleanText(item?.details) ||
      `Live event at ${venueName}. Time TBA — see venue page for details.`;

    rows.push({
      id,
      title,
      starts_at: startsAt,
      ends_at: endsAt,
      venue: venueName,
      community: communityFor(item?.venue),
      description,
      source: "goslo.events",
      source_url: sourceUrl,
      category:
        CATEGORY_MAP[item?.category] ?? guessCategory(title, venueName),
      time_tba: timeTba,
    });
  }
  return rows;
}

async function main() {
  const supabase = createScraperClient();

  console.log(`Fetching ${FEED_URL} ...`);
  const res = await fetchWithRetry(FEED_URL, {
    headers: { "User-Agent": "whats-on-slo/1.0 (+https://whatsonslo.com)" },
  });
  if (!res.ok) throw new Error(`goslo.events ${res.status}`);
  const items = await res.json();
  if (!Array.isArray(items)) {
    throw new Error("goslo.events events.json is not an array; feed format changed");
  }

  const rows = buildRows(items);
  console.log(`Parsed ${items.length} feed items → ${rows.length} events.`);

  if (rows.length === 0) {
    console.log("No events to write.");
    await logRun(supabase, "goslo.events", 0, "no-data");
    return;
  }

  console.log("Upserting into Supabase...");
  const { error } = await supabase
    .from("events")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    console.error("Supabase upsert failed:", error);
    process.exit(1);
  }

  // Drop rows goslo no longer lists. events.json is the source's whole
  // calendar, so its furthest event is the edge of what we can vouch for. The
  // id is built from the title, so an upstream rename reads as a retraction —
  // which is right: the old row is stale either way.
  await pruneMissing(supabase, {
    idPrefix: "gs-",
    seenIds: new Set(rows.map((r) => r.id)),
    windowStartDay: firstPrunableDay(),
    windowEndDay: latestPacificDay(rows),
    label: "goslo.events",
    dryRun: process.env.PRUNE_DRY_RUN === "1",
  });

  await logRun(supabase, "goslo.events", rows.length, "success");
  console.log(`Done. ${rows.length} events upserted.`);
}

// Only run main when invoked directly so peers can import this module's
// internals (e.g. for tests) without triggering a real scrape.
const invokedDirectly =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.endsWith("scrape-goslo.mjs");
if (invokedDirectly) {
  main().catch((err) => {
    console.error("Scraper failed:", err);
    process.exit(1);
  });
}
