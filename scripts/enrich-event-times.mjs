// Recover real start times for events the feeds gave us only a date for.
//
// Several sources (goslo.events, Sea Pines, RunSignup races without event-level
// times) anchor starts_at at a per-source sentinel hour and set time_tba=true.
// Those render as "Time TBA" on the site. This pass visits each such event's
// source_url and tries to extract the real start time, in priority order:
//
//   1. JSON-LD  — schema.org Event objects with a startDate (most reliable).
//   2. OpenGraph / meta — <meta property="event:start_time"> or itemprop
//      startDate (Facebook-event and microdata conventions).
//   3. Visible text — "8:00 PM", "Doors @ 6:30", "7pm" patterns in the page.
//
// When a time is found we rewrite starts_at to the real instant and clear
// time_tba; otherwise the event keeps showing "Time TBA". Results are cached
// per source_url in event_time_cache so we don't re-fetch unchanged pages on
// every run.
//
// The extraction functions are pure (HTML in, result out) and exported for
// tests. main() is the only part that touches the network or the database, and
// runs only when the script is invoked directly.

import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";
import { logRun } from "./_log-run.mjs";

// ------------------------------------------------------------------ config

const UA = "whats-on-slo/1.0 (+https://whatsonslo.com)";
const SOURCE_LABEL = "enrich-event-times";
// Skip re-fetching a URL whose extraction we cached within this many days.
const CACHE_FRESH_DAYS = 14;
// Polite limits: how many event pages we fetch per run, and how many at once.
const MAX_FETCHES = Number(process.env.ENRICH_MAX_FETCHES || 200);
const FETCH_CONCURRENCY = 6;
const FETCH_TIMEOUT_MS = 12_000;

// ---------------------------------------------------------- Pacific helpers

// Convert a Pacific wall-clock instant to a UTC ISO string, DST-safe. (Same
// trick the scrapers use: treat the parts as UTC, ask what that instant reads
// as in Los Angeles, and shift by the difference.)
export function pacificPartsToUtcIso({ y, mo, d, hh, mm }) {
  const asUtc = new Date(Date.UTC(y, mo - 1, d, hh ?? 0, mm ?? 0));
  const laStr = asUtc.toLocaleString("sv-SE", {
    timeZone: "America/Los_Angeles",
  });
  const laAsUtc = new Date(laStr.replace(" ", "T") + "Z");
  const offsetMs = asUtc.getTime() - laAsUtc.getTime();
  return new Date(asUtc.getTime() + offsetMs).toISOString();
}

// The Pacific calendar Y/M/D of an instant. Used both to derive the event's
// known day from its sentinel starts_at and to validate that a structured-data
// time we found belongs to the same day (guards against grabbing a different
// event's time off a listing page).
export function pacificDateParts(date) {
  const [y, mo, d] = date
    .toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })
    .split("-")
    .map(Number);
  return { y, mo, d };
}

// Pull the wall-clock parts out of an ISO-8601 datetime string WITHOUT honoring
// its timezone offset. We deliberately ignore the offset: this is an all-SLO
// aggregator, and some event platforms (notably Squarespace) emit their server's
// Eastern offset on a Pacific venue's event, so "18:00-0400" really means 6 PM
// at the venue, not 3 PM Pacific. The printed wall clock is the reliable signal;
// we re-anchor it to Pacific below. Returns null if there's no time component.
export function parseIsoWallClock(s) {
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m) return null;
  return {
    y: Number(m[1]),
    mo: Number(m[2]),
    d: Number(m[3]),
    hh: Number(m[4]),
    mm: Number(m[5]),
  };
}

// A structured startDate is usable only if its wall-clock day matches the
// event's known day (guards against grabbing a different event's time off a
// page that lists several).
function structuredToIso(startDate, knownDay) {
  const parts = parseIsoWallClock(startDate);
  if (!parts) return null;
  if (
    knownDay &&
    (parts.y !== knownDay.y || parts.mo !== knownDay.mo || parts.d !== knownDay.d)
  ) {
    return null;
  }
  return pacificPartsToUtcIso(parts);
}

// Render a UTC ISO instant as a readable Pacific date+time (for dry-run output).
function fmtPacific(iso) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------- JSON-LD

// Recursively flatten every object node so we can scan arrays, @graph wrappers,
// and nested sub-events uniformly.
function collectObjects(node, out = []) {
  if (Array.isArray(node)) {
    for (const n of node) collectObjects(n, out);
  } else if (node && typeof node === "object") {
    out.push(node);
    for (const k of Object.keys(node)) collectObjects(node[k], out);
  }
  return out;
}

function isEventTyped(obj) {
  const t = obj["@type"];
  if (!t) return false;
  return Array.isArray(t)
    ? t.some((x) => /event/i.test(String(x)))
    : /event/i.test(String(t));
}

// Look for a schema.org Event startDate that includes a clock time. Returns
// { method, iso } or null. A date-only startDate ("2026-06-14") has no time to
// recover, so we skip it.
export function extractFromJsonLd(html, knownDay) {
  const blocks = [
    ...html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    ),
  ].map((m) => m[1]);

  const objects = [];
  for (const raw of blocks) {
    let data;
    try {
      data = JSON.parse(raw.trim());
    } catch {
      continue; // malformed block — skip, try the next
    }
    collectObjects(data, objects);
  }

  // Prefer objects explicitly typed as an Event; fall back to anything that
  // carries a startDate.
  const withStart = objects.filter((o) => typeof o.startDate === "string");
  withStart.sort((a, b) => Number(isEventTyped(b)) - Number(isEventTyped(a)));

  for (const obj of withStart) {
    const iso = structuredToIso(obj.startDate, knownDay);
    if (iso) return { method: "json-ld", iso };
  }
  return null;
}

// ---------------------------------------------------------- meta tags

const META_PATTERNS = [
  /<meta[^>]+(?:property|name)=["']event:start_time["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']event:start_time["']/i,
  /<meta[^>]+itemprop=["']startDate["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']startDate["']/i,
];

// OpenGraph / microdata event start time. Returns { method, iso } or null.
export function extractFromMeta(html, knownDay) {
  for (const re of META_PATTERNS) {
    const m = html.match(re);
    if (!m) continue;
    const iso = structuredToIso(m[1], knownDay);
    if (iso) return { method: "opengraph", iso };
  }
  return null;
}

// ---------------------------------------------------------- visible text

// Strip markup to the human-visible text so our time regexes don't trip over
// attributes, scripts, or styles.
export function htmlToVisibleText(html) {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const body = $("body").text();
  const text = (body || $.root().text() || "").replace(/\s+/g, " ").trim();
  return text;
}

function to24Hour(hourStr, ampm) {
  let h = Number(hourStr);
  if (ampm) {
    const pm = /p/i.test(ampm);
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
  } else if (h >= 1 && h <= 11) {
    // No meridiem given. In this evening-heavy events dataset (live music,
    // shows), an unqualified 1–11 o'clock is overwhelmingly PM.
    h += 12;
  }
  return h;
}

// A clock time: hour, optional :minutes, optional am/pm (with or without dots).
const TIME_CORE = "(\\d{1,2})(?::(\\d{2}))?\\s*(a\\.?m\\.?|p\\.?m\\.?)?";
// Connectors allowed between a start/show label and the time: punctuation and
// a small whitelist of linking words. Deliberately NOT "anything", so a label
// followed by an unrelated number ("show featuring 5 bands at 8pm") can't latch
// onto the wrong digit — the filler stops at "featuring" and the match fails
// there, leaving the real "8pm" to be found by the am/pm fallback.
const LABEL_FILLER =
  "(?:[\\s:@.\\u2013\\u2014-]|\\b(?:at|is|open|opens|around|approx|the|time)\\b)*?";
// A time that follows a start/show label, e.g. "show 8pm", "starts at 7:30",
// "doors @ 6:30", "doors open at 6:30".
const LABELLED_RE = new RegExp(
  "(showtime|show time|show|starts?|start time|begins?|doors?)\\b" +
    LABEL_FILLER +
    TIME_CORE,
  "i"
);
// Any explicit am/pm time anywhere in the text (meridiem required here, so we
// don't latch onto bare numbers like prices or addresses).
const STRICT_AMPM_RE = /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i;

function buildTime(hourStr, minStr, ampm) {
  const hh = to24Hour(hourStr, ampm);
  const mm = minStr ? Number(minStr) : 0;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm };
}

// Find a start time in free text. Returns { method, hh, mm } (Pacific
// wall-clock) or null. Prefers a show/start-labelled time, then a doors time,
// then any unambiguous am/pm time.
export function extractFromText(text) {
  if (!text) return null;

  // 1. Labelled time. Run the regex globally and prefer show/start labels over
  //    doors (doors is earlier than the actual start, but still better than
  //    nothing if it's all the page gives).
  const labelled = [
    ...text.matchAll(
      new RegExp(LABELLED_RE.source, "gi")
    ),
  ];
  let doorsHit = null;
  for (const m of labelled) {
    const label = m[1].toLowerCase();
    const t = buildTime(m[2], m[3], m[4]);
    if (!t) continue;
    if (/door/.test(label)) {
      doorsHit = doorsHit || t;
    } else {
      return { method: "text", ...t };
    }
  }
  if (doorsHit) return { method: "text", ...doorsHit };

  // 2. First explicit am/pm time anywhere.
  const m = text.match(STRICT_AMPM_RE);
  if (m) {
    const t = buildTime(m[1], m[2], m[3]);
    if (t) return { method: "text", ...t };
  }
  return null;
}

// ---------------------------------------------------------- orchestration

// Run the full priority chain against a page. `knownDay` is the event's Pacific
// calendar day (from its sentinel starts_at). Returns { method, iso } or null.
export function extractStartTime(html, { knownDay } = {}) {
  return (
    extractFromJsonLd(html, knownDay) ||
    extractFromMeta(html, knownDay) ||
    extractFromTextToIso(html, knownDay)
  );
}

function extractFromTextToIso(html, knownDay) {
  const t = extractFromText(htmlToVisibleText(html));
  if (!t) return null;
  // Text gives only a time-of-day; anchor it to the event's known day.
  if (!knownDay) return null;
  const iso = pacificPartsToUtcIso({ ...knownDay, hh: t.hh, mm: t.mm });
  return { method: "text", iso };
}

// Pure: given an event row (with starts_at + source_url) and the fetched HTML,
// compute the enrichment result. Exported for tests.
export function resolveEventTime(event, html) {
  const knownDay = pacificDateParts(new Date(event.starts_at));
  const res = extractStartTime(html, { knownDay });
  if (!res || !res.iso) return { found: false, method: null, startsAt: null };
  return { found: true, method: res.method, startsAt: res.iso };
}

// ---------------------------------------------------------- IO (main only)

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// Run async `worker` over `items` with bounded concurrency.
async function pool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, run)
  );
  return results;
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) return { ok: false, status: res.status, html: null };
    const html = await res.text();
    return { ok: true, status: res.status, html };
  } catch (err) {
    return { ok: false, status: 0, html: null, error: err };
  } finally {
    clearTimeout(timer);
  }
}

async function loadCache(supabase, urls) {
  const map = new Map();
  for (const part of chunk(urls, 200)) {
    const { data, error } = await supabase
      .from("event_time_cache")
      .select("source_url,starts_at,time_found,checked_at")
      .in("source_url", part);
    if (error) {
      console.warn(`event_time_cache lookup failed: ${error.message}`);
      continue;
    }
    for (const row of data) map.set(row.source_url, row);
  }
  return map;
}

function isFresh(cacheRow, now) {
  if (!cacheRow?.checked_at) return false;
  const ageMs = now.getTime() - new Date(cacheRow.checked_at).getTime();
  return ageMs < CACHE_FRESH_DAYS * 24 * 60 * 60 * 1000;
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

  // --dry-run (-n): fetch and extract exactly as normal, but write nothing —
  // no event updates, no cache rows, no log row. Used to preview changes.
  const dryRun =
    process.argv.includes("--dry-run") || process.argv.includes("-n");
  if (dryRun) {
    console.log("=== DRY RUN — no database writes will be made ===");
  }

  // Only upcoming events still flagged Time-TBA are worth enriching.
  const sinceIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  console.log("Loading Time-TBA events...");
  const { data: events, error } = await supabase
    .from("events")
    .select("id,starts_at,source_url")
    .eq("time_tba", true)
    .gte("starts_at", sinceIso)
    .order("starts_at", { ascending: true })
    .limit(2000);
  if (error) {
    console.error("Failed to load events:", error);
    process.exit(1);
  }
  console.log(`  ${events.length} Time-TBA events in window.`);
  if (events.length === 0) {
    if (!dryRun) await logRun(supabase, SOURCE_LABEL, 0, "no-data");
    return;
  }

  // Dedup by source_url: many events can share a page, and the cache + fetch
  // are keyed by URL.
  const urls = [...new Set(events.map((e) => e.source_url).filter(Boolean))];
  const cache = await loadCache(supabase, urls);

  // Decide per URL: use a fresh cache entry, or queue a fetch (up to the cap).
  const toFetch = [];
  const resultByUrl = new Map();
  for (const url of urls) {
    const cached = cache.get(url);
    if (isFresh(cached, now)) {
      resultByUrl.set(url, {
        found: cached.time_found,
        startsAt: cached.starts_at,
        fromCache: true,
      });
    } else {
      toFetch.push(url);
    }
  }

  const fetchUrls = toFetch.slice(0, MAX_FETCHES);
  const skipped = toFetch.length - fetchUrls.length;
  console.log(
    `  ${resultByUrl.size} fresh from cache, ${fetchUrls.length} to fetch` +
      (skipped > 0 ? `, ${skipped} deferred (MAX_FETCHES=${MAX_FETCHES})` : "")
  );

  // One representative event per URL gives us the known day for text anchoring.
  const eventByUrl = new Map();
  for (const e of events) {
    if (!eventByUrl.has(e.source_url)) eventByUrl.set(e.source_url, e);
  }

  const cacheUpserts = [];
  await pool(fetchUrls, FETCH_CONCURRENCY, async (url) => {
    const r = await fetchHtml(url);
    if (!r.ok) {
      // Transient/error: don't poison the cache; we'll retry next run.
      console.log(`  FETCH-FAIL [${r.status || "ERR"}] ${url}`);
      resultByUrl.set(url, { found: false, startsAt: null, skipped: true });
      return;
    }
    const result = resolveEventTime(eventByUrl.get(url), r.html);
    resultByUrl.set(url, { found: result.found, startsAt: result.startsAt });
    cacheUpserts.push({
      source_url: url,
      starts_at: result.startsAt,
      time_found: result.found,
      method: result.method,
      checked_at: new Date().toISOString(),
    });
    console.log(
      `  ${result.found ? `FOUND [${result.method}] ${result.startsAt}` : "none"} — ${url}`
    );
  });

  // Persist cache rows for everything we actually fetched.
  if (cacheUpserts.length && !dryRun) {
    for (const part of chunk(cacheUpserts, 200)) {
      const { error: cErr } = await supabase
        .from("event_time_cache")
        .upsert(part, { onConflict: "source_url" });
      if (cErr) console.warn(`event_time_cache upsert failed: ${cErr.message}`);
    }
  }

  // Apply found times to every event sharing a resolved URL.
  const updates = [];
  for (const e of events) {
    const r = resultByUrl.get(e.source_url);
    if (r && r.found && r.startsAt) {
      updates.push({ id: e.id, from: e.starts_at, starts_at: r.startsAt });
    }
  }

  if (dryRun) {
    console.log(
      `\n=== DRY RUN: would update ${updates.length} of ${events.length} events ===`
    );
    for (const u of updates) {
      console.log(
        `  ${u.id}\n    ${fmtPacific(u.from)} (TBA sentinel)  ->  ${fmtPacific(u.starts_at)}`
      );
    }
    const unchanged = events.length - updates.length;
    console.log(
      `\n  ${unchanged} event(s) would stay "Time TBA" (no time found on the page).`
    );
    console.log("=== DRY RUN complete — nothing was written. ===");
    return;
  }

  console.log(`Applying real start times to ${updates.length} events...`);
  await pool(updates, FETCH_CONCURRENCY, async (u) => {
    const { error: uErr } = await supabase
      .from("events")
      .update({ starts_at: u.starts_at, time_tba: false })
      .eq("id", u.id);
    if (uErr) console.warn(`event update failed for ${u.id}: ${uErr.message}`);
  });

  console.log(`Done. ${updates.length} events updated with real start times.`);
  await logRun(
    supabase,
    SOURCE_LABEL,
    updates.length,
    updates.length > 0 ? "success" : "no-data"
  );
}

// Only run main when invoked directly so the test can import the pure exports
// without triggering network or DB calls.
const invokedDirectly =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.endsWith("enrich-event-times.mjs");
if (invokedDirectly) {
  main().catch((err) => {
    console.error("Enrichment failed:", err);
    process.exit(1);
  });
}
