// Scrape BigBigSLO (a CitySpark-powered local events portal embedded in
// bigbigslo.com). The portal script at portalv2.cityspark.com bakes the
// current Events array directly into a Vue SPA bundle as a JSON literal.
// We extract that array via balanced-bracket scanning + JSON.parse, then
// filter to SLO County and upsert with a `bbs-` ID prefix.
//
// BigBigSLO publishes 25–40 events at a time across SLO County and nearby
// Santa Barbara/Kern. We drop the non-SLO-County rows here (whitelist) so
// the deduper at read time doesn't have to think about geography.
//
// Zero-events alarm: an empty post-filter list almost always means either
// the bundle structure changed or the city whitelist drifted. Both are
// silent failures we want loud, so we exit non-zero in that case to fail
// the GitHub Actions run.

import { createClient } from "@supabase/supabase-js";

const PORTAL_URL =
  "https://portalv2.cityspark.com/PortalScripts/BigBigSLO";
const UA = "whats-on-slo/1.0 (+https://whatsonslo.com)";
const FALLBACK_LEARN_MORE = "https://www.bigbigslo.com/events";

// SLO County whitelist. Cities (incorporated) + the unincorporated
// communities that appear in event listings often enough to whitelist.
// Lowercased + stripped of punctuation for comparison.
const SLO_COUNTY_CITIES = new Set([
  // incorporated
  "san luis obispo",
  "paso robles",
  "el paso de robles",
  "atascadero",
  "morro bay",
  "pismo beach",
  "arroyo grande",
  "grover beach",
  // common unincorporated communities
  "avila beach",
  "cambria",
  "cayucos",
  "los osos",
  "baywood los osos",
  "nipomo",
  "oceano",
  "port san luis",
  "san miguel",
  "santa margarita",
  "shandon",
  "templeton",
  "san simeon",
  "creston",
  "garden farms",
  "pozo",
  "cholame",
]);

// Pure: pull the `"Events":[ ... ]` array out of the portal bundle by
// walking balanced brackets, respecting JSON string-escapes, then JSON.parse.
// Returns the parsed array or throws.
export function extractEventsArray(scriptText) {
  const marker = '"Events":[';
  const markerIdx = scriptText.indexOf(marker);
  if (markerIdx < 0) {
    throw new Error('extractEventsArray: marker "Events":[ not found');
  }
  const start = markerIdx + '"Events":'.length;
  let depth = 0;
  let inStr = false;
  let esc = false;
  let end = -1;
  for (let i = start; i < scriptText.length; i++) {
    const c = scriptText[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === "\\") {
      esc = true;
      continue;
    }
    if (inStr) {
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end < 0) {
    throw new Error("extractEventsArray: unbalanced brackets");
  }
  const slice = scriptText.slice(start, end);
  return JSON.parse(slice);
}

// Pure: SLO County whitelist check on the portal's "City, ST" string.
// Returns false on missing/non-CA/non-SLO-County values.
export function isSloCounty(cityState) {
  if (!cityState || typeof cityState !== "string") return false;
  const m = cityState.match(/^\s*(.+?)\s*,\s*([A-Z]{2})\s*$/);
  if (!m) return false;
  const [, city, state] = m;
  if (state !== "CA") return false;
  const norm = city.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
  return SLO_COUNTY_CITIES.has(norm);
}

function slugify(s) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Category heuristic. BigBigSLO is music-heavy with a long tail of theater,
// readings, and community events. We classify on the title only — the venue
// is unreliable here because BigBigSLO routinely falls back to a street
// address line (e.g. "2361 Theatre Dr"), which would falsely match "theatre".
export function categoryFromText(name) {
  const t = (name || "").toLowerCase();
  if (/\b(museum|gallery|exhibit|art walk|theatre|theater|musical|recital|symphony|opera|ballet|reading)\b/.test(t))
    return "Arts";
  if (/\b(farmers? market|wine|tasting|food fest|brewery|cooking)\b/.test(t))
    return "Food & Drink";
  if (/\b(family|kids|children|story\s?time|page to stage)\b/.test(t))
    return "Family";
  if (/\b(hike|run|race|paddle|surf|outdoor|trail)\b/.test(t)) return "Outdoors";
  if (/\b(trivia|karaoke|game night|bingo|class|workshop|meeting)\b/.test(t))
    return "Community";
  return "Music";
}

// Pure: turn the parsed Events array into upsert rows. Returns
// { rows, drops } so the caller can log / alarm on the drop reasons.
export function buildRows(events) {
  const rows = [];
  const drops = [];
  for (const e of events) {
    if (!e || typeof e !== "object") {
      drops.push({ pid: null, reason: "non-object" });
      continue;
    }
    if (!e.PId) {
      drops.push({ pid: null, reason: "no-pid" });
      continue;
    }
    if (!e.Name || !e.Name.trim()) {
      drops.push({ pid: e.PId, reason: "no-name" });
      continue;
    }
    if (!e.DateStart) {
      drops.push({ pid: e.PId, reason: "no-date" });
      continue;
    }
    if (!isSloCounty(e.CityState)) {
      drops.push({ pid: e.PId, reason: "not-slo-county", cityState: e.CityState });
      continue;
    }

    // Community = the city portion of "City, CA"
    const community = e.CityState.split(",")[0].trim();
    // Venue can be empty for some events (e.g. SLO Rep Page-to-Stage). Fall
    // back to the address line so the page still has a useful locator.
    const venue =
      (e.Venue && e.Venue.trim()) ||
      (e.Address && e.Address.split(",")[0].trim()) ||
      "TBA";

    // Prefer the event's PrimaryUrl. TicketUrl is fine too but tends to
    // be a my805tix/Ticketmaster subpage; the PrimaryUrl is the listing
    // page humans read first. Fall back to the BigBigSLO calendar root.
    const sourceUrl =
      (typeof e.PrimaryUrl === "string" && e.PrimaryUrl.trim()) ||
      (typeof e.TicketUrl === "string" && e.TicketUrl.trim()) ||
      FALLBACK_LEARN_MORE;

    const description =
      (typeof e.Description === "string" && e.Description.trim()) ||
      (typeof e.Short === "string" && e.Short.trim()) ||
      `${e.Name} at ${venue} in ${community}.`;

    const imageUrl =
      (typeof e.LargeImg === "string" && /^https?:/.test(e.LargeImg) && e.LargeImg) ||
      (typeof e.MediumImg === "string" && /^https?:/.test(e.MediumImg) && e.MediumImg) ||
      null;

    rows.push({
      id: `bbs-${e.PId}-${slugify(e.Name)}`,
      title: e.Name.trim(),
      starts_at: e.DateStart,
      ends_at: e.DateEnd || null,
      venue,
      community,
      description,
      source: "BigBigSLO",
      source_url: sourceUrl,
      category: categoryFromText(e.Name),
      image_url: imageUrl,
    });
  }
  return { rows, drops };
}

async function main() {
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

  console.log(`Fetching ${PORTAL_URL} ...`);
  const res = await fetch(PORTAL_URL, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    console.error(`BigBigSLO portal ${res.status}`);
    process.exit(1);
  }
  const text = await res.text();

  let events;
  try {
    events = extractEventsArray(text);
  } catch (err) {
    console.error("Parser failed — bundle structure may have changed:", err.message);
    process.exit(1);
  }
  if (!Array.isArray(events) || events.length === 0) {
    console.error(
      "Zero-events alarm: extracted Events array is empty or not an array. " +
        "Bundle structure or portal name may have changed."
    );
    process.exit(1);
  }
  console.log(`Extracted ${events.length} raw events from portal bundle.`);

  const { rows, drops } = buildRows(events);
  const dropCounts = drops.reduce((acc, d) => {
    acc[d.reason] = (acc[d.reason] || 0) + 1;
    return acc;
  }, {});
  console.log(
    `Parsed ${rows.length} SLO County rows; dropped ${drops.length}: ${JSON.stringify(dropCounts)}`
  );

  if (rows.length === 0) {
    console.error(
      "Zero-events alarm: 0 SLO County events after filter. " +
        `Got ${events.length} raw events; whitelist may need updating, or portal may have rotated to non-SLO content.`
    );
    process.exit(1);
  }

  const { error } = await supabase
    .from("events")
    .upsert(rows, { onConflict: "id" });
  if (error) {
    console.error("Supabase upsert failed:", error);
    process.exit(1);
  }
  console.log(`Done. ${rows.length} events upserted.`);
}

// Allow `node scripts/scrape-bigbigslo.mjs` execution but skip when imported
// from the test file.
const invokedDirectly =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.endsWith("scrape-bigbigslo.mjs");
if (invokedDirectly) {
  main().catch((err) => {
    console.error("Scraper failed:", err);
    process.exit(1);
  });
}
