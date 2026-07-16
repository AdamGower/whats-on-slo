// Scrape goslo.events — the main local live-music aggregator.
// We parse their /all page (cleaner structured HTML than their RSS digest).
// Most listings don't include a start time, so we use a noon-PT sentinel
// for starts_at; titles still group correctly under the right calendar day.

import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";
import { logRun } from "./_log-run.mjs";
import {
  firstPrunableDay,
  latestPacificDay,
  pruneMissing,
} from "./_prune-missing.mjs";
import { cleanDescriptionHtml } from "./_clean-html.mjs";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error(
    "Missing env vars. Need SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SECRET_KEY."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

const MONTHS = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Parse "Wed Apr 29 2026" → ISO string at noon Pacific (sentinel for time-unknown)
function parseGosloDate(dateStr) {
  const m = dateStr.trim().match(/^\w{3}\s+(\w{3})\s+(\d{1,2})\s+(\d{4})$/);
  if (!m) return null;
  const [, monAbbr, day, year] = m;
  const month = MONTHS[monAbbr];
  if (month === undefined) return null;
  // Construct as midnight UTC then shift via ISO. Easier: use Date.UTC on
  // 19:00 UTC ≈ noon PDT (Apr–Oct). Off by 1h during PST but fine for grouping.
  return new Date(Date.UTC(Number(year), month, Number(day), 19, 0, 0)).toISOString();
}

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

// Try to derive a community/city from the venue name.
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

function communityFromVenue(venue) {
  for (const [re, community] of VENUE_TO_COMMUNITY) {
    if (re.test(venue)) return community;
  }
  return "San Luis Obispo";
}

async function main() {
  console.log("Fetching https://goslo.events/all ...");
  const res = await fetch("https://goslo.events/all", {
    headers: { "User-Agent": "whats-on-slo/1.0 (+https://whatsonslo.com)" },
  });
  if (!res.ok) throw new Error(`goslo.events ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const rows = [];

  $(".date-group").each((_, group) => {
    const $group = $(group);
    const groupDate = $group.find(".date-title").first().text().trim();
    const groupStart = parseGosloDate(groupDate);
    if (!groupStart) return;

    $group.find(".event-container").each((_, ev) => {
      const $ev = $(ev);
      const $title = $ev.find(".event-title").first();
      const links = $title.find("a");
      if (links.length === 0) return;

      // First anchor = event link/title; last = venue
      const $titleLink = links.eq(0);
      const $venueLink = links.length > 1 ? links.eq(links.length - 1) : null;

      const title = $titleLink.text().trim();
      const eventUrl = $titleLink.attr("href");
      const venue = $venueLink ? $venueLink.text().trim() : "TBA";

      if (!title || !eventUrl) return;

      // If the event-title contains its own date range, prefer the start of that.
      let startsAt = groupStart;
      const $embedDate = $title.find(".date").first();
      if ($embedDate.length) {
        const m = $embedDate.text().trim().match(/^(\w{3}\s+\w{3}\s+\d{1,2}\s+\d{4})/);
        if (m) {
          const parsed = parseGosloDate(m[1]);
          if (parsed) startsAt = parsed;
        }
      }

      const detailsHtml = $ev.find(".event-details").first().html() || "";
      const description =
        cleanDescriptionHtml(detailsHtml) ||
        `Live event at ${venue}. Time TBA — see venue page for details.`;

      rows.push({
        id: `gs-${slugify(title)}-${slugify(groupDate)}`,
        title,
        starts_at: startsAt,
        ends_at: null,
        venue,
        community: communityFromVenue(venue),
        description,
        source: "goslo.events",
        source_url: eventUrl,
        category: guessCategory(title, venue),
      });
    });
  });

  // De-dupe within this scrape (same title at same venue same date can recur)
  const seen = new Set();
  const unique = rows.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  console.log(`Parsed ${rows.length} events (${unique.length} unique).`);

  if (unique.length === 0) {
    console.log("No events to write.");
    await logRun(supabase, "goslo.events", 0, "no-data");
    return;
  }

  console.log("Upserting into Supabase...");
  const { error } = await supabase
    .from("events")
    .upsert(unique, { onConflict: "id" });

  if (error) {
    console.error("Supabase upsert failed:", error);
    process.exit(1);
  }

  // Drop rows goslo no longer lists. /all is a single page with no paging and
  // no date range, so a successful parse is the source's whole calendar and
  // its furthest event is the edge of what we can vouch for. Note the id is
  // built from the title, so an upstream rename reads as a retraction — which
  // is right: the old row is stale either way.
  await pruneMissing(supabase, {
    idPrefix: "gs-",
    seenIds: new Set(unique.map((r) => r.id)),
    windowStartDay: firstPrunableDay(),
    windowEndDay: latestPacificDay(unique),
    label: "goslo.events",
    dryRun: process.env.PRUNE_DRY_RUN === "1",
  });

  await logRun(supabase, "goslo.events", unique.length, "success");
  console.log(`Done. ${unique.length} events upserted.`);
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
