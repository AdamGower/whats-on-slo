import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !TICKETMASTER_API_KEY) {
  console.error(
    "Missing env vars. Need SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL), SUPABASE_SECRET_KEY, TICKETMASTER_API_KEY."
  );
  process.exit(1);
}

const SLO_LATLONG = "35.2828,-120.6596";
const RADIUS_MILES = 25;
const PAGE_SIZE = 100;
const MAX_PAGES = 5;

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

const SEGMENT_TO_CATEGORY = {
  Music: "Music",
  "Arts & Theatre": "Arts",
  Film: "Arts",
  Family: "Family",
  Sports: "Community",
  Miscellaneous: "Community",
};

function mapEvent(e) {
  const venue = e._embedded?.venues?.[0];
  const segment = e.classifications?.[0]?.segment?.name;
  const category = SEGMENT_TO_CATEGORY[segment] || "Community";

  const description =
    e.info?.trim() ||
    e.pleaseNote?.trim() ||
    `Live ${segment?.toLowerCase() || "event"} at ${
      venue?.name || "a local venue"
    }.`;

  // Use Ticketmaster's event URL as the source link. For events TM actually
  // sells (the majority), this lands on the event-specific ticket page — what
  // the user wants. For the minority of events TM only indexes (e.g. shows
  // ticketed via Eventbrite or Prekindle), this URL 404s. We can't tell from
  // the API alone which is which; the alternative — falling back to the venue
  // homepage — is generic for ALL events, including the working majority. Net
  // user experience is better with TM URL primary.
  const sourceUrl = e.url;
  const source = "Ticketmaster";

  return {
    id: `tm-${e.id}`,
    title: e.name,
    starts_at: e.dates?.start?.dateTime ?? null,
    ends_at: null,
    venue: venue?.name || "TBA",
    community: venue?.city?.name || "San Luis Obispo Area",
    description,
    source,
    source_url: sourceUrl,
    category,
  };
}

async function fetchPage(page) {
  const url = new URL(
    "https://app.ticketmaster.com/discovery/v2/events.json"
  );
  url.searchParams.set("latlong", SLO_LATLONG);
  url.searchParams.set("radius", RADIUS_MILES.toString());
  url.searchParams.set("unit", "miles");
  url.searchParams.set("size", PAGE_SIZE.toString());
  url.searchParams.set("page", page.toString());
  url.searchParams.set("apikey", TICKETMASTER_API_KEY);

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ticketmaster API ${res.status}: ${body}`);
  }
  return res.json();
}

async function main() {
  console.log(
    `Fetching Ticketmaster events near ${SLO_LATLONG} (${RADIUS_MILES} mi radius)...`
  );

  const allEvents = [];
  let page = 0;
  let totalPages = 1;

  while (page < totalPages && page < MAX_PAGES) {
    const data = await fetchPage(page);
    const events = data._embedded?.events ?? [];
    allEvents.push(...events);
    totalPages = data.page?.totalPages ?? 1;
    console.log(
      `  Page ${page + 1}/${Math.min(totalPages, MAX_PAGES)}: ${events.length} events`
    );
    page++;
  }

  console.log(`Fetched ${allEvents.length} raw events. Mapping...`);

  const rows = allEvents
    .map(mapEvent)
    .filter((r) => r.starts_at && r.title && r.id);

  if (rows.length === 0) {
    console.log("No valid events to write.");
    return;
  }

  console.log(`Upserting ${rows.length} events into Supabase...`);

  const { error } = await supabase
    .from("events")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    console.error("Supabase upsert failed:", error);
    process.exit(1);
  }

  console.log(`Done. ${rows.length} events upserted.`);
}

main().catch((err) => {
  console.error("Scraper failed:", err);
  process.exit(1);
});
