// Scrape Madonna Inn / Alex Madonna Expo Center events.
// The calendar page is built on Squarespace; each event has its own
// per-event iCal (.ics) URL. We fetch the calendar page, find every
// event's iCal URL, and parse each .ics for title, real start/end
// times, and location. Volume is small (~7 events) but the venue
// hosts category-defining one-offs nobody else covers (consignment
// sales, expos, special dinners).

import * as cheerio from "cheerio";
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
const UA = "whats-on-slo/1.0 (+https://whatsonslo.com)";

// RFC 5545: lines longer than 75 chars are folded with CRLF + (space|tab).
// Unfold by removing those continuations.
function unfoldIcal(text) {
  return text.replace(/\r?\n[ \t]/g, "");
}

// "20260606T210000Z" → ISO. Supports basic UTC form only.
function parseIcsDate(s) {
  if (!s) return null;
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m;
  return new Date(
    Date.UTC(+y, +mo - 1, +d, +h, +mi, +se)
  ).toISOString();
}

// Unescape iCal text fields. RFC 5545: backslash escapes for , ; \ and \n.
function unescapeIcalText(s) {
  if (!s) return "";
  return s
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function parseIcsEvent(text) {
  const lines = unfoldIcal(text).split(/\r?\n/);
  const event = {};
  let inEvent = false;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      continue;
    }
    if (line === "END:VEVENT") break;
    if (!inEvent) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).split(";")[0]; // strip TZID and other params
    event[key] = line.slice(idx + 1);
  }
  return event;
}

function guessCategory(title) {
  const t = title.toLowerCase();
  if (/\b(brunch|dinner|wine|tasting|food|cocktail)\b/.test(t))
    return "Food & Drink";
  if (/\b(expo|sale|consignment|fair|swap meet|market)\b/.test(t))
    return "Community";
  if (/\b(tour|concert|live|band)\b/.test(t)) return "Music";
  if (/\b(art|gem|craft|show)\b/.test(t)) return "Arts";
  if (/\b(family|kids)\b/.test(t)) return "Family";
  return "Community";
}

async function main() {
  console.log("Fetching Madonna Inn calendar page...");
  const calRes = await fetch("https://www.madonnainn.com/calendar", {
    headers: { "User-Agent": UA },
  });
  if (!calRes.ok) throw new Error(`Madonna Inn calendar ${calRes.status}`);
  const html = await calRes.text();
  const $ = cheerio.load(html);

  // Collect every per-event iCal path. Squarespace renders these as
  // <a href="/calendar/YYYY/M/D/slug?format=ical">…</a>.
  const paths = new Set();
  $('a[href*="?format=ical"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href && href.startsWith("/calendar/")) paths.add(href);
  });

  console.log(`Found ${paths.size} event iCal URLs.`);

  const rows = [];
  const now = new Date();

  for (const path of paths) {
    const icsUrl = `https://www.madonnainn.com${path}`;
    const pageUrl = icsUrl.replace("?format=ical", "");

    let icsText;
    try {
      const r = await fetch(icsUrl, { headers: { "User-Agent": UA } });
      if (!r.ok) {
        console.warn(`  ${r.status} for ${icsUrl}, skipping`);
        continue;
      }
      icsText = await r.text();
    } catch (err) {
      console.warn(`  fetch error for ${icsUrl}:`, err.message);
      continue;
    }

    const ev = parseIcsEvent(icsText);
    const startsAt = parseIcsDate(ev.DTSTART);
    const endsAt = parseIcsDate(ev.DTEND);
    const title = unescapeIcalText(ev.SUMMARY);

    if (!startsAt || !title) continue;
    if (new Date(startsAt) < now && (!endsAt || new Date(endsAt) < now)) {
      continue; // already over
    }

    const location = unescapeIcalText(ev.LOCATION);
    // "Madonna Inn, 100 Madonna Road, San Luis Obispo, CA, ..."
    const locParts = location.split(",").map((s) => s.trim());
    const venue = locParts[0] || "Madonna Inn";
    const community = locParts[2] || "San Luis Obispo";

    const slug = path.replace("?format=ical", "").split("/").pop();
    const dateForId = startsAt.slice(0, 10);
    const id = `mi-${slug}-${dateForId}`;

    rows.push({
      id,
      title,
      starts_at: startsAt,
      ends_at: endsAt,
      venue,
      community,
      description:
        unescapeIcalText(ev.DESCRIPTION) ||
        `Event at ${venue}. See the Madonna Inn calendar for details.`,
      source: "Madonna Inn",
      source_url: pageUrl,
      category: guessCategory(title),
    });
  }

  console.log(`Collected ${rows.length} upcoming events.`);
  if (rows.length === 0) {
    console.log("Nothing to upsert.");
    return;
  }

  console.log("Upserting into Supabase...");
  const { error } = await supabase
    .from("events")
    .upsert(rows, { onConflict: "id" });
  if (error) {
    console.error("Upsert failed:", error);
    process.exit(1);
  }
  console.log(`Done. ${rows.length} events upserted.`);
}

main().catch((err) => {
  console.error("Scraper failed:", err);
  process.exit(1);
});
