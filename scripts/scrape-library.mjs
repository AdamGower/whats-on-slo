// Scrape SLO County Public Library events.
// The librarycalendar.com SaaS platform exposes a public JSON feed at
// /events/feed/json — clean, structured, no auth needed. Family
// programming, story times, art exhibits, tech classes — content
// systematically missed by tourism-oriented sources.

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

// Library JSON returns naive timestamps in their listed timezone (always
// America/Los_Angeles for SLO). Convert "YYYY-MM-DD HH:MM:SS" assumed
// Pacific into a UTC ISO string. Uses Intl to handle DST correctly.
function laWallTimeToUtcIso(dateStr) {
  if (!dateStr) return null;
  const isoCandidate = dateStr.replace(" ", "T") + "Z";
  const utc = new Date(isoCandidate);
  if (isNaN(utc.getTime())) return null;
  // Format that UTC instant as Pacific wall-clock to discover the offset.
  const laString = utc.toLocaleString("sv-SE", {
    timeZone: "America/Los_Angeles",
  });
  const la = new Date(laString.replace(" ", "T") + "Z");
  const offsetMs = utc.getTime() - la.getTime();
  return new Date(utc.getTime() + offsetMs).toISOString();
}

function stripHtml(s) {
  if (!s) return "";
  return s
    .replace(/<[^>]*>/g, " ") // replace tags with a space so "</p><p>" doesn't smash sentences together
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ") // collapse the multiple spaces this can introduce
    .trim();
}

function firstValue(obj) {
  if (!obj || typeof obj !== "object") return null;
  const vals = Object.values(obj);
  return vals.length ? vals[0] : null;
}

const BRANCH_TO_COMMUNITY = [
  [/morro bay/i, "Morro Bay"],
  [/los osos/i, "Los Osos"],
  [/cayucos/i, "Cayucos"],
  [/cambria/i, "Cambria"],
  [/atascadero/i, "Atascadero"],
  [/templeton/i, "Templeton"],
  [/santa margarita/i, "Santa Margarita"],
  [/paso/i, "Paso Robles"],
  [/shandon/i, "Shandon"],
  [/creston/i, "Creston"],
  [/nipomo/i, "Nipomo"],
  [/oceano/i, "Oceano"],
  [/arroyo grande/i, "Arroyo Grande"],
  [/grover beach/i, "Grover Beach"],
  [/pismo/i, "Pismo Beach"],
  [/avila/i, "Avila Beach"],
  [/san miguel/i, "San Miguel"],
  [/simmler/i, "Simmler"],
  [/san luis obispo/i, "San Luis Obispo"],
];

function communityFromBranch(branchName) {
  if (!branchName) return "San Luis Obispo";
  for (const [re, c] of BRANCH_TO_COMMUNITY) if (re.test(branchName)) return c;
  return "San Luis Obispo";
}

function categorize(programTypeName, ageGroupName, title) {
  const text = `${programTypeName || ""} ${ageGroupName || ""} ${title}`.toLowerCase();
  if (/\b(art|gallery|exhibit|culture|music|concert|theater|theatre)\b/.test(text))
    return /\b(music|concert|band)\b/.test(text) ? "Music" : "Arts";
  if (/\b(kid|child|baby|toddler|preschool|teen|tween|family|story\s?time)\b/.test(text))
    return "Family";
  if (/\b(garden|nature|hike|outdoor|park|bird)\b/.test(text)) return "Outdoors";
  if (/\b(food|cook|wine|baking|cuisine)\b/.test(text)) return "Food & Drink";
  return "Community";
}

async function main() {
  console.log(
    "Fetching https://sanluisobispo.librarycalendar.com/events/feed/json ..."
  );
  const res = await fetch(
    "https://sanluisobispo.librarycalendar.com/events/feed/json",
    {
      headers: {
        "User-Agent": "whats-on-slo/1.0 (+https://whatsonslo.com)",
        Accept: "application/json",
      },
    }
  );
  if (!res.ok) throw new Error(`Library JSON ${res.status}`);
  const events = await res.json();
  console.log(`Feed returned ${events.length} events.`);

  const now = new Date();
  const rows = [];

  for (const e of events) {
    if (!e.public || !e.published) continue;

    const startsAt = laWallTimeToUtcIso(e.start_date);
    const endsAt = laWallTimeToUtcIso(e.end_date);
    if (!startsAt || !e.title) continue;

    // Skip events that already ended
    const ended = endsAt ? new Date(endsAt) : new Date(startsAt);
    if (ended < now) continue;

    const branchName = firstValue(e.branch) || "Library";
    const programTypeName = firstValue(e.program_type);
    const ageGroupName = firstValue(e.age_group);

    // Library JSON returns image as a plain URL string when present, null otherwise.
    const imageUrl = typeof e.image === "string" ? e.image : null;

    rows.push({
      id: `lib-${e.id}`,
      title: e.title.trim(),
      starts_at: startsAt,
      ends_at: endsAt,
      venue: branchName,
      community: communityFromBranch(branchName),
      description:
        stripHtml(e.description) ||
        `Library program at ${branchName}. Free, open to the public.`,
      source: "SLO County Library",
      source_url: e.url,
      category: categorize(programTypeName, ageGroupName, e.title),
      image_url: imageUrl,
    });
  }

  console.log(`Filtered to ${rows.length} upcoming events.`);
  if (rows.length === 0) return;

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
