// Tests for scrape-seapines.mjs.
// Run with: `node --test scripts/scrape-seapines.test.mjs`

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildRows,
  cleanTitle,
  parseRssItems,
  parseEventDates,
  stripDatePhrase,
  extractSeriesLabel,
  extractSlug,
  guessCategory,
  pacificPartsToUtcIso,
  truncateDescription,
} from "./scrape-seapines.mjs";

// A "now" early enough that the fixture's summer events fall inside the
// 120-day lookahead window, but late enough that the 2018 stub does not.
const FIXED_NOW = new Date("2026-06-01T12:00:00Z");

// Synthetic RSS — minimal, hand-written to exercise each path: a single-day
// concert with an image, a multi-day event, a stale recurring market with no
// end date, an item with no parseable date, and an entity-escaped title with
// no image. (We never commit raw scraped feeds as fixtures.)
const FIXTURE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Calendar of Events</title>
    <item>
      <title>Stellar</title>
      <description><![CDATA[<b>Sunday Music on the Patio</b><br /> Central Coast favorite playing classic hits.<br /> Starting on 06/14/2026 and ending on 06/14/2026]]></description>
      <link>https://www.seapinesgolfresort.com/calendar/stellar</link>
      <guid>https://www.seapinesgolfresort.com/calendar/stellar</guid>
      <enclosure type="image" length="123" url="https://img.example/stellar.jpg"/>
    </item>
    <item>
      <title>Soul Kool Festival</title>
      <description><![CDATA[<b>Concerts on the Green</b><br /> Winner from last season!<br /> Starting on 07/11/2026 and ending on 07/18/2026]]></description>
      <link>https://www.seapinesgolfresort.com/calendar/soul-kool</link>
      <guid>https://www.seapinesgolfresort.com/calendar/soul-kool</guid>
      <enclosure type="image" length="456" url="https://img.example/soul-kool.png"/>
    </item>
    <item>
      <title>Baywood Farmers' Market</title>
      <description><![CDATA[<b>Los Osos Events</b><br /> Fresh produce, meats, fish, and more.<br /> Starting on 03/26/2018]]></description>
      <link>https://www.seapinesgolfresort.com/calendar/baywood-farmers-market</link>
      <guid>https://www.seapinesgolfresort.com/calendar/baywood-farmers-market</guid>
    </item>
    <item>
      <title>Mystery Event</title>
      <description><![CDATA[<b>Indoor Concert Series</b><br /> Details to come.]]></description>
      <link>https://www.seapinesgolfresort.com/calendar/mystery</link>
      <guid>https://www.seapinesgolfresort.com/calendar/mystery</guid>
    </item>
    <item>
      <title>Jazz &amp; Blues Night | An Evening of Standards</title>
      <description><![CDATA[<b>Indoor Concert Series</b><br /> An evening of jazz and blues.<br /> Starting on 06/20/2026 and ending on 06/20/2026]]></description>
      <link>https://www.seapinesgolfresort.com/calendar/jazz-blues</link>
      <guid>https://www.seapinesgolfresort.com/calendar/jazz-blues</guid>
    </item>
  </channel>
</rss>`;

test("parseRssItems pulls every item with decoded fields", () => {
  const items = parseRssItems(FIXTURE_XML);
  assert.equal(items.length, 5);
  const stellar = items[0];
  assert.equal(stellar.title, "Stellar");
  assert.equal(stellar.link, "https://www.seapinesgolfresort.com/calendar/stellar");
  assert.equal(stellar.image, "https://img.example/stellar.jpg");
  assert.match(stellar.description, /Sunday Music on the Patio/);
  // Entity in a title is decoded by the XML parser; pipe tagline is intact
  // here (trimming happens in buildRows, not parseRssItems).
  assert.equal(items[4].title, "Jazz & Blues Night | An Evening of Standards");
});

test("buildRows keeps datable in-window items, drops the rest with reasons", () => {
  const items = parseRssItems(FIXTURE_XML);
  const { rows, drops } = buildRows(items, { now: FIXED_NOW });

  const titles = rows.map((r) => r.title).sort();
  assert.deepEqual(titles, ["Jazz & Blues Night", "Soul Kool Festival", "Stellar"]);

  const reasons = drops.map((d) => d.reason).sort();
  assert.deepEqual(reasons, ["no-date", "out-of-window"]);
});

test("a single-day concert maps to the resort with no end and a Music category", () => {
  const items = parseRssItems(FIXTURE_XML);
  const { rows } = buildRows(items, { now: FIXED_NOW });
  const stellar = rows.find((r) => r.title === "Stellar");

  // 06/14/2026 14:00 PDT (UTC-7) === 06/14 21:00 UTC.
  assert.equal(stellar.starts_at, "2026-06-14T21:00:00.000Z");
  assert.equal(stellar.ends_at, null);
  assert.equal(stellar.venue, "Sea Pines Golf Resort");
  assert.equal(stellar.community, "Los Osos");
  assert.equal(stellar.source, "Sea Pines Golf Resort");
  assert.equal(stellar.category, "Music");
  assert.equal(stellar.image_url, "https://img.example/stellar.jpg");
  assert.equal(stellar.id, "sp-stellar-2026-06-14");
  assert.equal(stellar.source_url, "https://www.seapinesgolfresort.com/calendar/stellar");
  // Date phrase stripped; attribution appended.
  assert.doesNotMatch(stellar.description, /Starting on/);
  assert.match(stellar.description, /Source: Sea Pines Golf Resort$/);
});

test("a multi-day event sets ends_at", () => {
  const items = parseRssItems(FIXTURE_XML);
  const { rows } = buildRows(items, { now: FIXED_NOW });
  const fest = rows.find((r) => r.title === "Soul Kool Festival");
  assert.equal(fest.starts_at, "2026-07-11T21:00:00.000Z");
  assert.equal(fest.ends_at, "2026-07-18T21:00:00.000Z");
});

test("items without an image carry a null image_url", () => {
  const items = parseRssItems(FIXTURE_XML);
  const { rows } = buildRows(items, { now: FIXED_NOW });
  const jazz = rows.find((r) => r.title === "Jazz & Blues Night");
  assert.equal(jazz.image_url, null);
});

test("re-running produces an identical id set (idempotency)", () => {
  const items = parseRssItems(FIXTURE_XML);
  const first = buildRows(items, { now: FIXED_NOW }).rows.map((r) => r.id);
  const second = buildRows(items, { now: FIXED_NOW }).rows.map((r) => r.id);
  assert.deepEqual(second.sort(), first.sort());
});

test("parseEventDates reads start and optional end", () => {
  assert.deepEqual(parseEventDates("Foo. Starting on 06/14/2026 and ending on 06/18/2026"), {
    start: { y: 2026, mo: 6, d: 14 },
    end: { y: 2026, mo: 6, d: 18 },
  });
  assert.deepEqual(parseEventDates("Starting on 03/26/2018"), {
    start: { y: 2018, mo: 3, d: 26 },
    end: null,
  });
  assert.equal(parseEventDates("No dates in here"), null);
});

test("stripDatePhrase removes the trailing date sentence", () => {
  assert.equal(
    stripDatePhrase("A fun show. Starting on 06/14/2026 and ending on 06/14/2026"),
    "A fun show."
  );
});

test("extractSeriesLabel reads the bold prefix from raw markup", () => {
  assert.equal(
    extractSeriesLabel("<b>Concerts on the Green</b><br /> blurb"),
    "Concerts on the Green"
  );
  assert.equal(extractSeriesLabel("no markup"), "");
});

test("extractSlug takes the final path segment", () => {
  assert.equal(extractSlug("https://x.test/calendar/soul-kool"), "soul-kool");
  assert.equal(extractSlug("https://x.test/calendar/soul-kool/"), "soul-kool");
  assert.equal(extractSlug("https://x.test/calendar/soul-kool?x=1"), "soul-kool");
  assert.equal(extractSlug(""), "");
});

test("guessCategory defaults to Music, markets to Food & Drink", () => {
  assert.equal(guessCategory("Concerts on the Green", "Stellar"), "Music");
  assert.equal(guessCategory("Los Osos Events", "Baywood Farmers' Market"), "Food & Drink");
  assert.equal(guessCategory("", "Something Else"), "Music");
});

test("cleanTitle trims a pipe-delimited tagline", () => {
  assert.equal(
    cleanTitle("MiniNova Live in Los Osos, CA | Latin Rock & Soul Jazz"),
    "MiniNova Live in Los Osos, CA"
  );
  assert.equal(cleanTitle("Stellar"), "Stellar");
  assert.equal(cleanTitle("  Spaced  "), "Spaced");
});

test("pacificPartsToUtcIso applies the DST-correct offset", () => {
  // Summer: PDT is UTC-7.
  assert.equal(
    pacificPartsToUtcIso({ y: 2026, mo: 7, d: 4, hh: 17, mm: 0 }),
    "2026-07-05T00:00:00.000Z"
  );
  // Winter: PST is UTC-8.
  assert.equal(
    pacificPartsToUtcIso({ y: 2026, mo: 1, d: 10, hh: 17, mm: 0 }),
    "2026-01-11T01:00:00.000Z"
  );
});

test("truncateDescription respects the cap and prefers sentence breaks", () => {
  assert.equal(truncateDescription(""), "");
  assert.equal(truncateDescription("short"), "short");
  const long =
    "First sentence here. Second sentence is a bit longer and continues. " +
    "Third sentence runs on and on with extra padding to push past the cap.";
  const out = truncateDescription(long, 80);
  assert.ok(out.length <= 80);
  assert.match(out, /[.!?…]$/);
});
