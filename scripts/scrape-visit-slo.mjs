// Scrape Visit San Luis Obispo (visitslo.com) — the city tourism bureau.
// They run WordPress + The Events Calendar plugin, which exposes a clean
// REST API at /wp-json/tribe/events/v1/events. We paginate through all
// upcoming events in the next 90 days; the per-day display cap handles
// the overall volume on the page.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error(
    "Missing env vars. Need SUPABASE_URL and SUPABASE_SECRET_KEY."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

const BASE = "https://visitslo.com/wp-json/tribe/events/v1/events";
const UA = "whats-on-slo/1.0 (+https://whatsonslo.com)";
const DAYS_AHEAD = 90;
const PER_PAGE = 50; // API caps at 50 even when more is requested
const MAX_PAGES = 12;

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

function decodeHtmlEntities(s) {
  if (!s) return "";
  return s
    .replace(/&#0?39;/g, "'")
    .replace(/&#8216;|&#8217;/g, "’")
    .replace(/&#8220;|&#8221;/g, "”")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");
}

function stripHtml(s) {
  if (!s) return "";
  return decodeHtmlEntities(
    s
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
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
  const today = new Date();
  const end = new Date(today.getTime() + DAYS_AHEAD * 24 * 60 * 60 * 1000);
  console.log(
    `Fetching Visit SLO events from ${toIsoDateOnly(today)} through ${toIsoDateOnly(end)} ...`
  );

  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await fetchPage(page, toIsoDateOnly(today), toIsoDateOnly(end));
    const events = data.events ?? [];
    all.push(...events);
    console.log(
      `  Page ${page}/${Math.min(data.total_pages ?? page, MAX_PAGES)}: ${events.length} events (total ${data.total ?? "?"})`
    );
    if (events.length === 0) break;
    if (page >= (data.total_pages ?? page)) break;
  }

  console.log(`Fetched ${all.length} raw events. Mapping...`);

  const rows = [];
  const seen = new Set();
  for (const e of all) {
    const startsAt = laWallTimeToUtcIso(e.start_date);
    const endsAt = laWallTimeToUtcIso(e.end_date);
    const title = decodeHtmlEntities(e.title || "").trim();
    if (!startsAt || !title) continue;

    const venueName =
      decodeHtmlEntities(e.venue?.venue || "").trim() || "TBA";
    const city = decodeHtmlEntities(e.venue?.city || "").trim();
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
        stripHtml(e.description) ||
        `Listed on Visit SLO. See source for full details.`,
      source: "Visit SLO",
      source_url: e.url,
      category: categorize(e.categories || [], title),
      image_url: imageUrl,
    });
  }

  console.log(`Mapped ${rows.length} unique events.`);
  if (rows.length === 0) return;

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

  console.log(`Done. ${rows.length} events upserted.`);
}

main().catch((err) => {
  console.error("Scraper failed:", err);
  process.exit(1);
});
