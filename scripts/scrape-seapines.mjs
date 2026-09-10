// Ingest the Sea Pines Golf Resort "Calendar of Events" RSS feed.
//
// Sea Pines is a Los Osos resort whose calendar is dominated by live-music
// series (Concerts on the Green, Indoor Concert Series, Sunday Music on the
// Patio). Everything it lists happens at the resort, so the community is
// fixed to Los Osos and the venue to the resort name.
//
// Notes on the design (mirrors scrape-rideshare-bikemonth.mjs):
//
// * Conditional GET. We persist ETag / Last-Modified in scraper_state and
//   send If-None-Match / If-Modified-Since each run, so an unchanged feed
//   short-circuits with a 304 and no parsing work.
//
// * Dates live in prose, not fields. The feed carries no <pubDate> per item
//   and no structured event date — only "Starting on MM/DD/YYYY [and ending
//   on MM/DD/YYYY]" inside the description. We parse that, and because the
//   feed never gives a clock time we anchor each event at a default hour
//   (Pacific). Past/recurring stubs (e.g. a market "Starting on 03/26/2018")
//   fall outside the lookahead window and drop out naturally.
//
// * One row per item. The per-row id is `sp-{slug}-{YYYY-MM-DD}` from the
//   item link's final path segment, so re-runs idempotently upsert the same
//   rows.

import crypto from "node:crypto";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";
import { logRun } from "./_log-run.mjs";
import {
  firstPrunableDay,
  latestPacificDay,
  pruneMissing,
} from "./_prune-missing.mjs";
import { cleanDescriptionHtml, cleanText } from "./_clean-html.mjs";

// ------------------------------------------------------------------ config

const RSS_URL = "https://www.seapinesgolfresort.com/calendar/rss";
const STATE_KEY = "seapines";
const UA = "whats-on-slo/1.0 (+https://whatsonslo.com)";
const LOOKAHEAD_DAYS = 120;
const SOURCE_LABEL = "Sea Pines Golf Resort";
const SOURCE_ATTRIBUTION_LINE = "Source: Sea Pines Golf Resort";
const COMMUNITY = "Los Osos";
const VENUE = "Sea Pines Golf Resort";
const FALLBACK_LEARN_MORE = "https://www.seapinesgolfresort.com/calendar";
const DESCRIPTION_MAX_CHARS = 280;
// The feed omits clock times, so every event is anchored at this hour in
// Pacific time.
const FALLBACK_START_HOUR = 14;

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

// Feed titles often carry a "Title | tagline" suffix, e.g. "MiniNova Live
// in Los Osos, CA | Latin Rock & Soul Jazz". Keep only the part before the
// first pipe so the card title stays tight (mirrors scrape-runsignup.mjs).
export function cleanTitle(name) {
  let title = (name || "").trim();
  const pipe = title.indexOf("|");
  if (pipe !== -1) title = title.slice(0, pipe).trim();
  return title;
}

// Each item's description opens with a bold "series" label, e.g.
// "<b>Concerts on the Green</b><br /> …". Pulled from the raw (pre-clean)
// description so we still have the markup to anchor on; used to classify.
export function extractSeriesLabel(rawDescription) {
  const m = (rawDescription || "").match(/<b>(.*?)<\/b>/i);
  return m ? m[1].trim() : "";
}

const DATE_PHRASE_RE =
  /Starting on (\d{1,2}\/\d{1,2}\/\d{4})(?:\s+and ending on (\d{1,2}\/\d{1,2}\/\d{4}))?/i;

function parseSlashDate(str) {
  const m = (str || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return { y: Number(m[3]), mo: Number(m[1]), d: Number(m[2]) };
}

// Pull start (and optional end) date from the cleaned description prose, or
// null if there's no "Starting on …" phrase at all.
export function parseEventDates(cleanedDescription) {
  const m = (cleanedDescription || "").match(DATE_PHRASE_RE);
  if (!m) return null;
  const start = parseSlashDate(m[1]);
  if (!start) return null;
  const end = m[2] ? parseSlashDate(m[2]) : null;
  return { start, end };
}

// Drop the trailing "Starting on … [and ending on …]" sentence: the date is
// captured in starts_at and would just be noise on the card.
export function stripDatePhrase(cleanedDescription) {
  return (cleanedDescription || "").replace(DATE_PHRASE_RE, "").trim();
}

// The feed is a music calendar; default to Music and special-case the
// occasional non-concert listing.
export function guessCategory(seriesLabel, title) {
  const text = `${seriesLabel} ${title}`;
  if (/farmers?'?\s*market|market\b/i.test(text)) return "Food & Drink";
  return "Music";
}

export function extractSlug(url) {
  if (!url) return "";
  const noQuery = url.split(/[?#]/)[0].replace(/\/+$/, "");
  return noQuery.split("/").pop() || "";
}

// ---------------------------------------------------------- id + dates

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Convert a Pacific wall-clock instant to a UTC ISO string, DST-safe. Treat
// the parts as if UTC, ask what that instant looks like in Los Angeles, and
// shift by the difference. Mirrors the trick in scrape-runsignup.mjs.
export function pacificPartsToUtcIso({ y, mo, d, hh, mm }) {
  const asUtc = new Date(Date.UTC(y, mo - 1, d, hh ?? 0, mm ?? 0));
  const laStr = asUtc.toLocaleString("sv-SE", {
    timeZone: "America/Los_Angeles",
  });
  const laAsUtc = new Date(laStr.replace(" ", "T") + "Z");
  const offsetMs = asUtc.getTime() - laAsUtc.getTime();
  return new Date(asUtc.getTime() + offsetMs).toISOString();
}

// ---------------------------------------------------------- RSS parsing

// Pull the <item> entries out of the RSS XML. cheerio in xmlMode keeps
// <link> as an ordinary element (HTML mode treats it as a void tag and
// hoists its text) and returns CDATA bodies verbatim from .text().
export function parseRssItems(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];
  $("item").each((_, el) => {
    const $el = $(el);
    items.push({
      title: $el.find("title").first().text().trim(),
      description: $el.find("description").first().text(),
      link: $el.find("link").first().text().trim(),
      guid: $el.find("guid").first().text().trim(),
      image: $el.find("enclosure").first().attr("url") || null,
    });
  });
  return items;
}

// ---------------------------------------------------------- row builder

// Pure: turns parsed RSS items into upsert rows. `now` is injected so tests
// fix a deterministic window. Exported for tests.
export function buildRows(items, { now = new Date() } = {}) {
  const windowStartMs = now.getTime() - 24 * 60 * 60 * 1000;
  const windowEndMs = now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000;

  const rows = [];
  const drops = [];
  const seenIds = new Set();

  for (const item of items) {
    const title = cleanTitle(cleanText(item.title));
    if (!title) {
      drops.push({ reason: "no-title", title: item.title || "" });
      continue;
    }

    const seriesLabel = extractSeriesLabel(item.description || "");
    const cleaned = cleanDescriptionHtml(item.description || "");

    const dates = parseEventDates(cleaned);
    if (!dates) {
      drops.push({ reason: "no-date", title });
      continue;
    }

    const startsAt = pacificPartsToUtcIso({
      ...dates.start,
      hh: FALLBACK_START_HOUR,
      mm: 0,
    });
    const startMs = new Date(startsAt).getTime();
    if (startMs < windowStartMs || startMs > windowEndMs) {
      drops.push({ reason: "out-of-window", title });
      continue;
    }

    let endsAt = null;
    if (dates.end) {
      const sameDay =
        dates.end.y === dates.start.y &&
        dates.end.mo === dates.start.mo &&
        dates.end.d === dates.start.d;
      if (!sameDay) {
        endsAt = pacificPartsToUtcIso({
          ...dates.end,
          hh: FALLBACK_START_HOUR,
          mm: 0,
        });
      }
    }

    const blurb = stripDatePhrase(cleaned);
    const truncated = truncateDescription(blurb);
    const finalDescription =
      (truncated ? truncated + "\n\n" : "") + SOURCE_ATTRIBUTION_LINE;

    const slug =
      extractSlug(item.link || item.guid) ||
      crypto.createHash("sha1").update(item.guid || title).digest("hex").slice(0, 12);
    const dayKey = `${dates.start.y}-${pad2(dates.start.mo)}-${pad2(dates.start.d)}`;
    const id = `sp-${slug}-${dayKey}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    rows.push({
      id,
      title,
      starts_at: startsAt,
      ends_at: endsAt,
      venue: VENUE,
      community: COMMUNITY,
      description: finalDescription,
      source: SOURCE_LABEL,
      source_url: item.link || FALLBACK_LEARN_MORE,
      category: guessCategory(seriesLabel, title),
      image_url: item.image || null,
      // The feed never carries a clock time, so starts_at is anchored at the
      // fallback hour. Flag it for "Time TBA" display and time enrichment.
      time_tba: true,
    });
  }

  return { rows, drops };
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

async function fetchRss(state) {
  const headers = { "User-Agent": UA, Accept: "application/rss+xml, application/xml" };
  if (state.etag) headers["If-None-Match"] = state.etag;
  if (state.last_modified) headers["If-Modified-Since"] = state.last_modified;
  const r = await fetch(RSS_URL, { headers });
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

  console.log("Loading scraper state...");
  const state = await loadState(supabase);
  console.log(
    `  prior etag: ${state.etag ? "yes" : "no"}, prior last-modified: ${state.last_modified ? "yes" : "no"}`
  );

  console.log("Fetching RSS feed...");
  const res = await fetchRss(state);
  console.log(`  HTTP ${res.status}`);

  if (res.status === 304) {
    console.log("Not modified since last run. Exiting cleanly.");
    await logRun(supabase, SOURCE_LABEL, 0, "not-modified");
    return;
  }
  if (res.status !== 200) {
    throw new Error(`Unexpected HTTP ${res.status}`);
  }

  const items = parseRssItems(res.text);
  console.log(`Parsed ${items.length} RSS items.`);

  const { rows, drops } = buildRows(items);
  for (const d of drops) {
    console.log(`  DROP [${d.reason}] "${d.title}"`);
  }
  console.log(
    `Result: ${rows.length} rows ready. Dropped ${drops.length}.`
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

  // Drop rows the feed no longer carries. We only reach here on a real 200 —
  // a 304 returns above without parsing, and pruning on it would delete the
  // whole calendar on the strength of "nothing changed". The RSS is a single
  // unpaginated document, so what we parsed is the feed in full; buildRows
  // drops items past the lookahead, which is why the horizon is the furthest
  // row we kept rather than the lookahead itself.
  await pruneMissing(supabase, {
    idPrefix: "sp-",
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

// Only run main when invoked directly. The test imports this module for its
// pure exports and must not trigger network/DB calls on import.
const invokedDirectly =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.endsWith("scrape-seapines.mjs");
if (invokedDirectly) {
  main().catch((err) => {
    console.error("Scraper failed:", err);
    process.exit(1);
  });
}
