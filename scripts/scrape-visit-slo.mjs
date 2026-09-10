// Scrape Visit San Luis Obispo (visitslo.com) — the city tourism bureau.
// They run WordPress + The Events Calendar plugin, which exposes a clean
// REST API at /wp-json/tribe/events/v1/events. We paginate through all
// upcoming events in the next 90 days; the per-day display cap handles
// the overall volume on the page.

import { createClient } from "@supabase/supabase-js";
import { logRun } from "./_log-run.mjs";
import { cleanDescriptionHtml, cleanText } from "./_clean-html.mjs";
import {
  dayBefore,
  firstPrunableDay,
  pruneMissing,
} from "./_prune-missing.mjs";

const BASE = "https://visitslo.com/wp-json/tribe/events/v1/events";
const UA = "whats-on-slo/1.0 (+https://whatsonslo.com)";
const DAYS_AHEAD = 90;
const PER_PAGE = 50; // API caps at 50 even when more is requested
// Headroom, not a budget: a 90-day window ran to 15 pages in July 2026, and
// stopping early silently drops the tail of the window (the events furthest
// out), which also blinds the unbounded-series check below.
const MAX_PAGES = 40;

function toIsoDateOnly(d) {
  return d.toISOString().slice(0, 10);
}

// Visit SLO returns naive timestamps in their stated timezone. Convert
// "YYYY-MM-DD HH:MM:SS" assumed America/Los_Angeles into a UTC ISO string,
// using Intl-based offset detection so DST is correct year-round.
function laWallTimeToUtcIso(dateStr) {
  if (!dateStr) return null;
  const utc = new Date(dateStr.replace(" ", "T") + "Z");
  if (isNaN(utc.getTime())) return null;
  const laString = utc.toLocaleString("sv-SE", {
    timeZone: "America/Los_Angeles",
  });
  const la = new Date(laString.replace(" ", "T") + "Z");
  const offsetMs = utc.getTime() - la.getTime();
  return new Date(utc.getTime() + offsetMs).toISOString();
}

const COMMUNITY_OVERRIDE = [
  [/morro bay/i, "Morro Bay"],
  [/los osos/i, "Los Osos"],
  [/cayucos/i, "Cayucos"],
  [/cambria/i, "Cambria"],
  [/atascadero/i, "Atascadero"],
  [/templeton/i, "Templeton"],
  [/santa margarita/i, "Santa Margarita"],
  [/paso/i, "Paso Robles"],
  [/nipomo/i, "Nipomo"],
  [/oceano/i, "Oceano"],
  [/arroyo grande/i, "Arroyo Grande"],
  [/grover beach/i, "Grover Beach"],
  [/pismo/i, "Pismo Beach"],
  [/avila/i, "Avila Beach"],
  [/shell beach/i, "Shell Beach"],
];

function communityFromCity(city) {
  if (!city) return "San Luis Obispo";
  for (const [re, label] of COMMUNITY_OVERRIDE) {
    if (re.test(city)) return label;
  }
  return city;
}

function categorize(categories, title) {
  const text = (
    categories.map((c) => c.name).join(" ") +
    " " +
    title
  ).toLowerCase();
  if (/\b(music|concert|band|live\s)/.test(text)) return "Music";
  if (/\b(food|drink|wine|beer|brew|tasting|culinary)/.test(text))
    return "Food & Drink";
  if (/\b(art|gallery|exhibit|theater|theatre|cultur|film|festival)/.test(text))
    return "Arts";
  if (/\b(family|kid|child)/.test(text)) return "Family";
  if (/\b(outdoor|park|hike|surf|beach|garden|nature)/.test(text))
    return "Outdoors";
  return "Community";
}

// ------------------------------------------- unbounded-series suppression

// Visit SLO sometimes publishes a one-off event as a "repeat daily for a
// year" series by mistake: ~365 occurrences, one per day, each with its own
// id. Ingested straight, a single event lands on every date of the calendar.
// The 2026 Cal Poly Commencement Weekend did this, and as of July 2026 five
// more live listings do (a paella dinner, a dance show, three SLO Rep shows).
//
// Run length alone cannot identify them: Circus Vargas legitimately runs 22
// consecutive days — longer than one of the broken listings. The reliable
// tell is that a year-long series always outruns our own query horizon,
// while a real run ends inside it. So we flag a slug whose occurrences cover
// nearly every day, for at least MIN_SERIES_DAYS, and still have not stopped
// by the last day we asked for.
const MIN_SERIES_DAYS = 14;
const MIN_SERIES_DENSITY = 0.9;
const EDGE_TOLERANCE_DAYS = 2; // our horizon is a UTC date; days are Pacific

export function pacificDay(iso) {
  return new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  });
}

export function slugFromUrl(url) {
  return /\/events\/([^/?#]+)/.exec(url || "")?.[1] ?? null;
}

function daysBetween(fromDay, toDay) {
  return Math.round(
    (Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) /
      86_400_000
  );
}

// Returns one entry per series that looks unbounded. Deliberately reports
// rather than repairs: we cannot recover the real dates here. The first
// occurrence we can see is not necessarily the real one — a series that began
// before today is truncated by our window, so its first visible day is merely
// "today" — and a description sometimes names a run the dates do not (The
// Designated Mourner reads "August 7-8" while its series claims 367 days).
// Guessing a date would invent data, so the caller drops the series and logs
// it for a human to curate.
export function findUnboundedSeries(
  rows,
  {
    windowEndDay,
    minDays = MIN_SERIES_DAYS,
    minDensity = MIN_SERIES_DENSITY,
    edgeToleranceDays = EDGE_TOLERANCE_DAYS,
  } = {}
) {
  const bySlug = new Map();
  for (const row of rows) {
    const slug = slugFromUrl(row.source_url);
    if (!slug) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push(row);
  }

  const found = [];
  for (const [slug, group] of bySlug) {
    const days = [...new Set(group.map((r) => pacificDay(r.starts_at)))].sort();
    if (days.length < minDays) continue;

    const span = daysBetween(days[0], days[days.length - 1]) + 1;
    if (days.length / span < minDensity) continue;

    // A real run stops inside our horizon; a year-long series does not.
    if (daysBetween(days[days.length - 1], windowEndDay) > edgeToleranceDays)
      continue;

    found.push({
      slug,
      title: group[0].title,
      occurrences: group.length,
      days: days.length,
      first: days[0],
      last: days[days.length - 1],
    });
  }
  return found;
}

async function fetchPage(page, today, end) {
  const params = new URLSearchParams({
    per_page: String(PER_PAGE),
    page: String(page),
    start_date: today,
    end_date: end,
  });
  const url = `${BASE}?${params}`;
  const r = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`Visit SLO API ${r.status} on page ${page}`);
  return r.json();
}

async function main() {
  const SUPABASE_URL =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
    console.error("Missing env vars. Need SUPABASE_URL and SUPABASE_SECRET_KEY.");
    process.exit(1);
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

  const today = new Date();
  const end = new Date(today.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000);
  console.log(
    `Fetching Visit SLO events from ${toIsoDateOnly(today)} through ${toIsoDateOnly(end)} ...`
  );

  const all = [];
  let totalPages = 1;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await fetchPage(page, toIsoDateOnly(today), toIsoDateOnly(end));
    const events = data.events ?? [];
    totalPages = data.total_pages ?? page;
    all.push(...events);
    console.log(
      `  Page ${page}/${Math.min(totalPages, MAX_PAGES)}: ${events.length} events (total ${data.total ?? "?"})`
    );
    if (events.length === 0) break;
    if (page >= totalPages) break;
  }

  const truncated = totalPages > MAX_PAGES;
  if (truncated) {
    console.warn(
      `Only fetched ${MAX_PAGES} of ${totalPages} pages — the far end of the ` +
        `window is missing. Raise MAX_PAGES.`
    );
  }

  console.log(`Fetched ${all.length} raw events. Mapping...`);

  let rows = [];
  const seen = new Set();
  for (const e of all) {
    const startsAt = laWallTimeToUtcIso(e.start_date);
    const endsAt = laWallTimeToUtcIso(e.end_date);
    const title = cleanText(e.title);
    if (!startsAt || !title) continue;

    const venueName =
      cleanText(e.venue?.venue) || "TBA";
    const city = cleanText(e.venue?.city);
    const community = communityFromCity(city);

    // Visit SLO assigns a unique numeric id per occurrence (recurring events
    // re-use the slug with a date suffix). Keep one row per occurrence.
    const id = `vs-${e.id}`;
    if (seen.has(id)) continue;
    seen.add(id);

    // Visit SLO returns a sizes object with multiple variants. Prefer
    // medium_large (~768w), then medium, then the original.
    const img = e.image || {};
    const imageUrl =
      img.sizes?.medium_large?.url ||
      img.sizes?.medium?.url ||
      img.url ||
      null;

    rows.push({
      id,
      title,
      starts_at: startsAt,
      ends_at: endsAt,
      venue: venueName,
      community,
      description:
        cleanDescriptionHtml(e.description) ||
        `Listed on Visit SLO. See source for full details.`,
      source: "Visit SLO",
      source_url: e.url,
      category: categorize(e.categories || [], title),
      image_url: imageUrl,
    });
  }

  console.log(`Mapped ${rows.length} unique events.`);

  // Compare against the data we actually have. If the page cap cut the window
  // short, every series stops at the truncation point rather than the horizon
  // we asked for, and measuring against the horizon would silently pass
  // everything.
  const windowEndDay = truncated
    ? rows.reduce((latest, r) => {
        const d = pacificDay(r.starts_at);
        return d > latest ? d : latest;
      }, "")
    : toIsoDateOnly(end);
  const unbounded = findUnboundedSeries(rows, { windowEndDay });
  if (unbounded.length > 0) {
    const skipped = new Set(unbounded.map((s) => s.slug));
    const before = rows.length;
    rows = rows.filter((r) => !skipped.has(slugFromUrl(r.source_url)));
    console.warn(
      `Suppressed ${before - rows.length} occurrences from ${unbounded.length} ` +
        `unbounded series (still running at our ${windowEndDay} horizon). ` +
        `These look like "repeat daily" mistakes upstream; real dates need ` +
        `curating by hand:`
    );
    for (const s of unbounded) {
      console.warn(
        `  - "${s.title}" (${s.slug}): ${s.occurrences} occurrences across ` +
          `${s.days} days, ${s.first}..${s.last}`
      );
    }
  }

  console.log(`Mapped ${rows.length} events after series filtering.`);
  if (rows.length === 0) {
    await logRun(supabase, "Visit SLO", 0, "no-data");
    return;
  }

  // Upsert in chunks to avoid request-size limits.
  const CHUNK = 200;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("events")
      .upsert(chunk, { onConflict: "id" });
    if (error) {
      console.error("Upsert failed:", error);
      process.exit(1);
    }
    upserted += chunk.length;
    console.log(`  Upserted ${upserted}/${rows.length}`);
  }

  // Drop rows Visit SLO has retracted. We can only vouch for the stretch we
  // actually read: when the page cap cut the run short, the last day we saw is
  // only partly covered, so stop a day before it. Suppressed series are
  // deliberately absent from `rows`, which is what clears their old rows out.
  await pruneMissing(supabase, {
    idPrefix: "vs-",
    seenIds: new Set(rows.map((r) => r.id)),
    windowStartDay: firstPrunableDay(),
    windowEndDay: truncated ? dayBefore(windowEndDay) : toIsoDateOnly(end),
    label: "Visit SLO",
    dryRun: process.env.PRUNE_DRY_RUN === "1",
  });

  await logRun(supabase, "Visit SLO", rows.length, "success");
  console.log(`Done. ${rows.length} events upserted.`);
}

// Only hit the network and the database when run as a script; importing this
// module (from the tests) must stay side-effect free.
const invokedDirectly =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.endsWith("scrape-visit-slo.mjs");

if (invokedDirectly) {
  main().catch((err) => {
    console.error("Scraper failed:", err);
    process.exit(1);
  });
}
