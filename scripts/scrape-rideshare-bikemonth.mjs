// Ingest the SLO Regional Rideshare "Bike Month" public Google Calendar
// (an ICS feed). All entries are ingested as Community-category events on
// the main feed; there is no separate Bike Month page or filter.
//
// Notes on the design:
//
// * Conditional GET. We persist ETag / Last-Modified in the scraper_state
//   table and send If-None-Match / If-Modified-Since on each run, so a 304
//   response short-circuits with no parsing work. This makes the scraper
//   effectively free during the eleven months of the year when SLOCOG
//   doesn't touch the calendar.
//
// * Recurring events. node-ical parses VEVENTs into objects with an
//   `rrule` property when they recur. We expand each recurring event into
//   concrete instances inside a 90-day lookahead window and emit one row
//   per instance. The per-row id is `rs-{sha1(uid)[:12]}-{YYYY-MM-DD}` so
//   re-runs idempotently upsert the same rows.
//
// * Filter. SLOCOG mixes broad-community group rides with employer-only
//   breakfasts, school events, and registration-required workshops. We
//   drop the latter via a small allowlist of patterns and log every drop
//   so the rules can be tuned from real production output.

import crypto from "node:crypto";
import ical from "node-ical";
import { createClient } from "@supabase/supabase-js";
import { logRun } from "./_log-run.mjs";
import {
  firstPrunableDay,
  latestPacificDay,
  pruneMissing,
} from "./_prune-missing.mjs";
import { cleanDescriptionHtml, cleanText } from "./_clean-html.mjs";

// ------------------------------------------------------------------ config

const ICS_URL =
  "https://calendar.google.com/calendar/ical/9858449d917164fda5ddba0842449f283c1f25084a75c3a1c4d25a6906f7eee4%40group.calendar.google.com/public/basic.ics";
const STATE_KEY = "rideshare-bikemonth";
// SLOCOG only populates this calendar for the annual "Bike Month" in May;
// the other eleven months it holds nothing but past events, which would
// otherwise surface as a no-data alert every cycle. Treat it as seasonal:
// outside these months the scraper skips entirely and logs `out-of-season`.
// Months are 1-indexed (5 = May), evaluated in Pacific time.
const ACTIVE_MONTHS = [5];
const UA = "whats-on-slo/1.0 (+https://whatsonslo.com)";
const LOOKAHEAD_DAYS = 90;
const FALLBACK_LEARN_MORE = "https://rideshare.org/bike-month-calendar/";
const SOURCE_LABEL = "rideshare.org";
const SOURCE_ATTRIBUTION_LINE = "Source: SLO Regional Rideshare";
const DEFAULT_COMMUNITY = "San Luis Obispo County";
const DESCRIPTION_MAX_CHARS = 280;

// ----------------------------------------------------------- exclusion rules

// Matched against `${title} ${description}`. Drops the event entirely.
export const TITLE_DESC_EXCLUDES = [
  { re: /\bto\s+work\b/i, name: "to-work" },
  { re: /\bto\s+school\b/i, name: "to-school" },
  { re: /\b(staff|employee)\b/i, name: "staff-or-employee" },
  { re: /\bworkshop\b/i, name: "workshop" },
  { re: /\btune[- ]?up\b/i, name: "tune-up" },
  // Spec gave /\bregister(ed|ing)?\s+(only|required)\b/, but real
  // calendars almost always say "Registration required" — widened to
  // any word starting "registr" so registration / register / registered
  // / registering all match.
  { re: /\bregistr\w*\s+(only|required)\b/i, name: "register-required" },
];

// Matched against the LOCATION field. Drops the event entirely.
export const LOCATION_EXCLUDES = [
  { re: /wallace group/i, name: "wallace-group" },
  { re: /\bElementary\b/, name: "elementary-school" },
  { re: /\bMiddle School\b/, name: "middle-school" },
  { re: /\bHigh School\b/, name: "high-school" },
  { re: /\bK-12\b/, name: "k-12-school" },
];

export function shouldExclude(title, description, location) {
  const text = `${title || ""} ${description || ""}`;
  for (const { re, name } of TITLE_DESC_EXCLUDES) {
    if (re.test(text)) return name;
  }
  if (location) {
    for (const { re, name } of LOCATION_EXCLUDES) {
      if (re.test(location)) return name;
    }
  }
  return null;
}

// ---------------------------------------------------------- text utilities

export function truncateDescription(text, maxChars = DESCRIPTION_MAX_CHARS) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  // Prefer a sentence boundary inside the back third of the cap so we
  // don't dangle mid-clause.
  const slice = text.slice(0, maxChars);
  const lastPunct = Math.max(
    slice.lastIndexOf("."),
    slice.lastIndexOf("!"),
    slice.lastIndexOf("?")
  );
  if (lastPunct >= maxChars * 0.6) return slice.slice(0, lastPunct + 1);
  return slice.replace(/\s+\S*$/, "") + "…";
}

function extractFirstUrl(text) {
  if (!text) return null;
  const m = text.match(/https?:\/\/[^\s<>"')]+/);
  return m ? m[0] : null;
}

// Google Calendar LOCATION strings vary. Common shapes:
//   "Mission Plaza, San Luis Obispo, CA 93401, USA"
//   "Avila Beach Promenade, Avila Beach, CA"
//   "Mission Plaza"
//   "San Luis Obispo, CA"
// We pick the first segment as the venue name and the second-to-last
// non-state segment as the city. Best effort — a wrong guess just shows
// less precise text on the card; nothing breaks downstream.
export function parseLocation(loc) {
  if (!loc || !loc.trim()) {
    return { venue: "TBA", community: DEFAULT_COMMUNITY };
  }
  const parts = loc.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 1) {
    return { venue: parts[0], community: DEFAULT_COMMUNITY };
  }
  const last = parts[parts.length - 1];
  // "USA" or "CA 93401" tail — strip and look at the previous segment.
  const isCountryOrStateZip =
    /^USA$/i.test(last) || /^[A-Z]{2}\b/.test(last) || /\d{5}/.test(last);
  let cityIdx;
  if (isCountryOrStateZip) {
    cityIdx = parts.length >= 3 ? parts.length - 2 : -1;
    // If parts[cityIdx] is itself a state/zip ("CA 93401"), step back one more.
    if (cityIdx >= 0 && /^[A-Z]{2}\b/.test(parts[cityIdx])) cityIdx -= 1;
  } else {
    cityIdx = parts.length - 1;
  }
  const venue = parts[0];
  const community =
    cityIdx > 0 && cityIdx < parts.length
      ? parts[cityIdx].replace(/\s+CA\b.*$/, "").trim()
      : DEFAULT_COMMUNITY;
  return { venue, community };
}

export function pickLearnMore(ev) {
  if (ev.url) return { url: ev.url, level: "vevent-url" };
  const fromDesc = extractFirstUrl(ev.description || "");
  if (fromDesc) return { url: fromDesc, level: "description-url" };
  return { url: FALLBACK_LEARN_MORE, level: "fallback" };
}

// ---------------------------------------------------------- id + dates

function dateToPacificDayKey(date) {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

// True when `now` falls in one of the source's active months. Evaluated in
// Pacific time because a late-April or early-June UTC instant can land in a
// different calendar month locally.
export function isInSeason(now = new Date()) {
  const month = Number(
    now.toLocaleDateString("en-US", {
      timeZone: "America/Los_Angeles",
      month: "numeric",
    })
  );
  return ACTIVE_MONTHS.includes(month);
}

function uidHash(uid) {
  return crypto.createHash("sha1").update(uid).digest("hex").slice(0, 12);
}

export function expandOccurrences(ev, windowStart, windowEnd) {
  if (!ev.start) return [];
  if (!ev.rrule) {
    const start = ev.start instanceof Date ? ev.start : new Date(ev.start);
    if (start < windowStart || start > windowEnd) return [];
    return [{ start, end: ev.end ? new Date(ev.end) : null }];
  }
  const dates = ev.rrule.between(windowStart, windowEnd, true);
  // Honor EXDATE list if present.
  const exdates = new Set(
    Object.keys(ev.exdate || {}).map((k) => new Date(k).toISOString())
  );
  const baseStart = ev.start instanceof Date ? ev.start : new Date(ev.start);
  const baseEnd = ev.end ? (ev.end instanceof Date ? ev.end : new Date(ev.end)) : null;
  const durationMs = baseEnd ? baseEnd.getTime() - baseStart.getTime() : 0;
  return dates
    .filter((d) => !exdates.has(d.toISOString()))
    .map((start) => ({
      start,
      end: durationMs > 0 ? new Date(start.getTime() + durationMs) : null,
    }));
}

// ---------------------------------------------------------- row builder

// Pure: turns a parsed-ICS object (output of `ical.parseICS`) into the
// upsert rows. Exported for tests.
//
// `now` is injected so tests can fix a deterministic window.
export function buildRows(parsed, { now = new Date() } = {}) {
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const windowEnd = new Date(
    now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000
  );

  const rows = [];
  const drops = [];
  const learnMoreLevels = { "vevent-url": 0, "description-url": 0, fallback: 0 };
  const seenIds = new Set();

  for (const ev of Object.values(parsed)) {
    if (!ev || ev.type !== "VEVENT") continue;

    const title = cleanText(ev.summary);
    const description = cleanDescriptionHtml(ev.description || "");
    const location = cleanText(ev.location);

    const dropReason = shouldExclude(title, description, location);
    if (dropReason) {
      drops.push({ reason: dropReason, title, location });
      continue;
    }
    if (!ev.uid || !title) continue;

    const occurrences = expandOccurrences(ev, windowStart, windowEnd);
    if (occurrences.length === 0) continue;

    const { venue, community } = parseLocation(location);
    const learnMore = pickLearnMore(ev);
    learnMoreLevels[learnMore.level]++;

    const truncated = truncateDescription(description);
    const finalDescription =
      (truncated ? truncated + "\n\n" : "") + SOURCE_ATTRIBUTION_LINE;

    const uidH = uidHash(ev.uid);
    for (const { start, end } of occurrences) {
      const id = `rs-${uidH}-${dateToPacificDayKey(start)}`;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      rows.push({
        id,
        title,
        starts_at: start.toISOString(),
        ends_at: end ? end.toISOString() : null,
        venue,
        community,
        description: finalDescription,
        source: SOURCE_LABEL,
        source_url: learnMore.url,
        category: "Community",
      });
    }
  }

  return { rows, drops, learnMoreLevels };
}

// ---------------------------------------------------------- IO (main only)

async function loadState(supabase) {
  const { data, error } = await supabase
    .from("scraper_state")
    .select("etag,last_modified")
    .eq("key", STATE_KEY)
    .maybeSingle();
  if (error) {
    console.warn(`scraper_state lookup failed (will fetch fresh):`, error.message);
    return { etag: null, last_modified: null };
  }
  return data ?? { etag: null, last_modified: null };
}

async function saveState(supabase, etag, lastModified) {
  const { error } = await supabase.from("scraper_state").upsert(
    {
      key: STATE_KEY,
      etag: etag ?? null,
      last_modified: lastModified ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );
  if (error) console.warn(`scraper_state save failed:`, error.message);
}

async function fetchIcs(state) {
  const headers = { "User-Agent": UA, Accept: "text/calendar" };
  if (state.etag) headers["If-None-Match"] = state.etag;
  if (state.last_modified) headers["If-Modified-Since"] = state.last_modified;
  const r = await fetch(ICS_URL, { headers });
  return {
    status: r.status,
    text: r.status === 304 ? null : await r.text(),
    etag: r.headers.get("etag"),
    lastModified: r.headers.get("last-modified"),
  };
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

  if (!isInSeason()) {
    console.log(
      "rideshare.org is a seasonal (May-only) source and is currently out of season. Skipping fetch."
    );
    await logRun(supabase, SOURCE_LABEL, 0, "out-of-season");
    return;
  }

  console.log("Loading scraper state...");
  const state = await loadState(supabase);
  console.log(
    `  prior etag: ${state.etag ? "yes" : "no"}, prior last-modified: ${state.last_modified ? "yes" : "no"}`
  );

  console.log("Fetching ICS feed...");
  const res = await fetchIcs(state);
  console.log(`  HTTP ${res.status}`);

  if (res.status === 304) {
    console.log("Not modified since last run. Exiting cleanly.");
    await logRun(supabase, SOURCE_LABEL, 0, "not-modified");
    return;
  }
  if (res.status !== 200) {
    throw new Error(`Unexpected HTTP ${res.status}`);
  }

  const parsed = ical.parseICS(res.text);
  const veventCount = Object.values(parsed).filter(
    (e) => e && e.type === "VEVENT"
  ).length;
  console.log(`Parsed ${veventCount} VEVENT entries.`);

  const { rows, drops, learnMoreLevels } = buildRows(parsed);

  for (const d of drops) {
    console.log(`  DROP [${d.reason}] "${d.title}" @ "${d.location}"`);
  }
  console.log(
    `Result: ${rows.length} rows ready. Dropped ${drops.length} by filter.`
  );
  console.log(
    `Learn-more sources: vevent-url=${learnMoreLevels["vevent-url"]}, description-url=${learnMoreLevels["description-url"]}, fallback=${learnMoreLevels.fallback}`
  );

  if (rows.length > 0) {
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("events")
        .upsert(chunk, { onConflict: "id" });
      if (error) {
        console.error("Upsert failed:", error);
        process.exit(1);
      }
    }
    console.log(`Upserted ${rows.length} events.`);
    await logRun(supabase, SOURCE_LABEL, rows.length, "success");
  } else {
    await logRun(supabase, SOURCE_LABEL, 0, "no-data");
  }

  // Drop rows the feed no longer carries. Both early returns above matter
  // here: out of season we never fetch, and a 304 means "unchanged", not
  // "empty" — pruning on either would delete the whole May calendar on no
  // evidence. Events dropped by the SLO/bike-month filters stay unseen and so
  // get pruned, which is intended; if a filter later proves too aggressive the
  // next in-season run re-adds them from the feed.
  await pruneMissing(supabase, {
    idPrefix: "rs-",
    seenIds: new Set(rows.map((r) => r.id)),
    windowStartDay: firstPrunableDay(),
    windowEndDay: latestPacificDay(rows),
    label: SOURCE_LABEL,
    dryRun: process.env.PRUNE_DRY_RUN === "1",
  });

  // Persist new validators only after a successful processing run, so a
  // mid-run failure doesn't poison the cache and skip the next attempt.
  if (res.etag || res.lastModified) {
    await saveState(supabase, res.etag, res.lastModified);
    console.log("Saved new ETag/Last-Modified to scraper_state.");
  }
}

// Only run main when invoked directly. The test imports this module for
// its pure exports and must not trigger network/DB calls on import.
const invokedDirectly =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.endsWith("scrape-rideshare-bikemonth.mjs");
if (invokedDirectly) {
  main().catch((err) => {
    console.error("Scraper failed:", err);
    process.exit(1);
  });
}
