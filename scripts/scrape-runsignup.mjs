// Ingest races near San Luis Obispo from RunSignup's public REST API.
//
// RunSignup exposes an unauthenticated race-search endpoint that takes a
// US zipcode + radius — the same geo model the Ticketmaster scraper uses.
// Passing `events=T` embeds each race's individual events (Half, 5K, …)
// with real start/end clock times and an IANA timezone, so a single
// paginated request yields everything we need; no per-race detail fetch.
//
// Notes on the design:
//
// * One row per race, not per event. A race typically has several events
//   (Half Marathon + 5K) that start together. We collapse them: starts_at
//   is the earliest event start, ends_at the latest event end. This keeps
//   one card per race-day rather than N near-identical cards.
//
// * Times are local. The API returns "MM/DD/YYYY HH:MM" wall-clock strings
//   in the race's own timezone (America/Los_Angeles for everything in our
//   radius). We convert to UTC with a DST-safe offset correction.
//
// * Category is fixed to Outdoors — RunSignup is races only.

import { createClient } from "@supabase/supabase-js";
import { logRun } from "./_log-run.mjs";
import {
  firstPrunableDay,
  latestPacificDay,
  pruneMissing,
} from "./_prune-missing.mjs";
import { cleanDescriptionHtml } from "./_clean-html.mjs";

// ------------------------------------------------------------------ config

const API_URL = "https://runsignup.com/Rest/races";
const ZIPCODE = "93401"; // San Luis Obispo city center
const RADIUS_MILES = 25;
const LOOKAHEAD_DAYS = 365;
const PAGE_SIZE = 1000; // API max; SLO radius returns a handful
const MAX_PAGES = 5;
const UA = "whats-on-slo/1.0 (+https://whatsonslo.com)";
const SOURCE_LABEL = "RunSignup";
const DEFAULT_COMMUNITY = "San Luis Obispo County";
const DESCRIPTION_MAX_CHARS = 280;
// A race with no event-level start_time falls back to its date at this hour
// (Pacific). Most races start in the morning; 7am is the modal start.
const FALLBACK_START_HOUR = 7;

// ---------------------------------------------------------- text utilities

export function truncateDescription(text, maxChars = DESCRIPTION_MAX_CHARS) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastPunct = Math.max(
    slice.lastIndexOf("."),
    slice.lastIndexOf("!"),
    slice.lastIndexOf("?")
  );
  if (lastPunct >= maxChars * 0.6) return slice.slice(0, lastPunct + 1);
  return slice.replace(/\s+\S*$/, "") + "…";
}

// RunSignup race names are routinely prefixed with the edition year, e.g.
// "2026 - City to the Sea Half Marathon & 5K". Strip a leading 4-digit year
// plus separator so the card title reads cleanly.
export function cleanTitle(name) {
  // Year must be 19xx/20xx at a word boundary so we never bite into a
  // longer leading number (e.g. "10000 Steps"). Consume any trailing
  // separators/whitespace ("2026 - " and "2026 " both collapse away).
  let title = (name || "").replace(/^\s*(?:19|20)\d{2}\b[\s:–—-]*/, "").trim();
  // RunSignup names sometimes carry a "Race Name | tagline" suffix. Keep
  // only the part before the first pipe so the card title stays tight.
  const pipe = title.indexOf("|");
  if (pipe !== -1) title = title.slice(0, pipe).trim();
  return title;
}

// ---------------------------------------------------------- date handling

// Parse "MM/DD/YYYY HH:MM" or "MM/DD/YYYY" into numeric parts, or null.
export function parseRsuDate(str) {
  if (!str) return null;
  const m = str
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  return {
    y: Number(m[3]),
    mo: Number(m[1]),
    d: Number(m[2]),
    hh: m[4] != null ? Number(m[4]) : null,
    mm: m[5] != null ? Number(m[5]) : null,
  };
}

// Convert a Pacific wall-clock instant to a UTC ISO string, DST-safe. We
// treat the parts as if they were UTC, ask what that instant looks like in
// Los Angeles, and shift by the difference. Mirrors the offset trick in
// src/lib/supabase.ts.
export function pacificPartsToUtcIso({ y, mo, d, hh, mm }) {
  const asUtc = new Date(Date.UTC(y, mo - 1, d, hh ?? 0, mm ?? 0));
  const laStr = asUtc.toLocaleString("sv-SE", {
    timeZone: "America/Los_Angeles",
  });
  const laAsUtc = new Date(laStr.replace(" ", "T") + "Z");
  const offsetMs = asUtc.getTime() - laAsUtc.getTime();
  return new Date(asUtc.getTime() + offsetMs).toISOString();
}

function todayPacificIsoDate(now) {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

function addDaysIsoDate(now, days) {
  const d = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

// ---------------------------------------------------------- row builder

// Pure: turns a parsed API response ({ races: [{ race }, …] }) into upsert
// rows. `now` is injected so tests fix a deterministic window. Exported for
// tests.
export function buildRows(parsed, { now = new Date() } = {}) {
  const windowStartMs = now.getTime() - 24 * 60 * 60 * 1000;
  const windowEndMs = now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000;

  const rows = [];
  const drops = [];
  const races = Array.isArray(parsed?.races) ? parsed.races : [];

  for (const wrapper of races) {
    const race = wrapper?.race ?? wrapper;
    if (!race || race.race_id == null) continue;

    if (race.is_private_race === "T") {
      drops.push({ reason: "private", name: race.name });
      continue;
    }
    if (race.is_draft_race === "T") {
      drops.push({ reason: "draft", name: race.name });
      continue;
    }

    // Collect parseable event start/end instants. Events with no clock time
    // contribute only a date.
    const events = Array.isArray(race.events) ? race.events : [];
    const starts = [];
    const ends = [];
    for (const ev of events) {
      const sp = parseRsuDate(ev.start_time);
      if (sp) starts.push(pacificPartsToUtcIso(sp));
      const ep = parseRsuDate(ev.end_time);
      if (ep) ends.push(pacificPartsToUtcIso(ep));
    }

    let startsAt;
    let endsAt = null;
    if (starts.length) {
      starts.sort();
      startsAt = starts[0];
      if (ends.length) {
        ends.sort();
        endsAt = ends[ends.length - 1];
      }
    } else {
      // Fall back to the race's next_date at a default morning hour.
      const np = parseRsuDate(race.next_date);
      if (!np) {
        drops.push({ reason: "no-date", name: race.name });
        continue;
      }
      startsAt = pacificPartsToUtcIso({ ...np, hh: FALLBACK_START_HOUR, mm: 0 });
      const ep = parseRsuDate(race.next_end_date);
      if (ep && (ep.hh != null || ep.d !== np.d)) {
        endsAt = pacificPartsToUtcIso({
          ...ep,
          hh: ep.hh ?? FALLBACK_START_HOUR,
          mm: ep.mm ?? 0,
        });
      }
    }

    const startMs = new Date(startsAt).getTime();
    if (startMs < windowStartMs || startMs > windowEndMs) {
      drops.push({ reason: "out-of-window", name: race.name });
      continue;
    }

    const title = cleanTitle(race.name);
    if (!title) {
      drops.push({ reason: "no-title", name: race.name });
      continue;
    }

    const addr = race.address || {};
    const venue =
      (addr.street && addr.street.trim()) ||
      (addr.city && addr.city.trim()) ||
      "TBA";
    const community = (addr.city && addr.city.trim()) || DEFAULT_COMMUNITY;

    const description = truncateDescription(
      cleanDescriptionHtml(race.description || "")
    );
    const sourceUrl =
      race.url || race.external_race_url || "https://runsignup.com/Races";

    rows.push({
      id: `rsu-${race.race_id}`,
      title,
      starts_at: startsAt,
      ends_at: endsAt,
      venue,
      community,
      description,
      source: SOURCE_LABEL,
      source_url: sourceUrl,
      category: "Outdoors",
      image_url: race.logo_url || null,
    });
  }

  return { rows, drops };
}

// ---------------------------------------------------------- IO (main only)

async function fetchPage(page, startDate, endDate) {
  const url = new URL(API_URL);
  url.searchParams.set("format", "json");
  url.searchParams.set("zipcode", ZIPCODE);
  url.searchParams.set("radius", RADIUS_MILES.toString());
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("events", "T");
  url.searchParams.set("results_per_page", PAGE_SIZE.toString());
  url.searchParams.set("page", page.toString());

  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`RunSignup API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
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

  const now = new Date();
  const startDate = todayPacificIsoDate(now);
  const endDate = addDaysIsoDate(now, LOOKAHEAD_DAYS);
  console.log(
    `Fetching RunSignup races near ${ZIPCODE} (${RADIUS_MILES} mi), ${startDate} → ${endDate}...`
  );

  const allRaces = [];
  let truncated = false;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await fetchPage(page, startDate, endDate);
    const races = Array.isArray(data.races) ? data.races : [];
    allRaces.push(...races);
    console.log(`  Page ${page}: ${races.length} races`);
    if (races.length < PAGE_SIZE) break;
    // A full page on the last allowed iteration means there is probably more
    // behind the cap. Short of that we ran out of races, not out of pages.
    if (page === MAX_PAGES) {
      truncated = true;
      console.warn(
        `Stopped at the ${MAX_PAGES}-page cap with a full page — more races ` +
          `likely exist. Raise MAX_PAGES.`
      );
    }
  }

  const { rows, drops } = buildRows({ races: allRaces }, { now });
  for (const d of drops) {
    console.log(`  DROP [${d.reason}] "${d.name}"`);
  }
  console.log(`Result: ${rows.length} rows ready. Dropped ${drops.length}.`);

  if (rows.length === 0) {
    await logRun(supabase, SOURCE_LABEL, 0, "no-data");
    console.log("No races to write.");
    return;
  }

  const { error } = await supabase
    .from("events")
    .upsert(rows, { onConflict: "id" });
  if (error) {
    console.error("Upsert failed:", error);
    process.exit(1);
  }
  // Drop races RunSignup no longer lists. buildRows also drops races for its
  // own reasons (out of window, missing data); those rows should not be on the
  // site either, so letting the prune take them is correct.
  await pruneMissing(supabase, {
    idPrefix: "rsu-",
    seenIds: new Set(rows.map((r) => r.id)),
    windowStartDay: firstPrunableDay(now),
    windowEndDay: latestPacificDay(rows),
    covered: !truncated,
    label: SOURCE_LABEL,
    dryRun: process.env.PRUNE_DRY_RUN === "1",
  });

  await logRun(supabase, SOURCE_LABEL, rows.length, "success");
  console.log(`Upserted ${rows.length} races.`);
}

// Only run main when invoked directly, so the test can import pure exports
// without triggering network/DB calls.
const invokedDirectly =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.endsWith("scrape-runsignup.mjs");
if (invokedDirectly) {
  main().catch((err) => {
    console.error("Scraper failed:", err);
    process.exit(1);
  });
}
