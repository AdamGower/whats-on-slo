// Tests for enrich-event-times.mjs.
// Run with: `node --test scripts/enrich-event-times.test.mjs`
//
// All HTML below is hand-written to exercise a specific extraction path. We
// never commit real scraped pages as fixtures.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  extractFromJsonLd,
  extractFromMeta,
  extractFromText,
  htmlToVisibleText,
  extractStartTime,
  resolveEventTime,
  pacificPartsToUtcIso,
  pacificDateParts,
  parseIsoWallClock,
} from "./enrich-event-times.mjs";

// goslo anchors unknown times at noon Pacific (UTC 19:00). An event on that
// sentinel has Pacific calendar day 2026-06-14.
const SENTINEL = "2026-06-14T19:00:00.000Z";
const KNOWN_DAY = { y: 2026, mo: 6, d: 14 };

// ---------------------------------------------------------- Pacific helpers

test("pacificPartsToUtcIso applies the DST-correct offset", () => {
  // Summer PDT (UTC-7): 8:00 PM → next-day 03:00 UTC.
  assert.equal(
    pacificPartsToUtcIso({ y: 2026, mo: 6, d: 14, hh: 20, mm: 0 }),
    "2026-06-15T03:00:00.000Z"
  );
  // Winter PST (UTC-8): 8:00 PM → next-day 04:00 UTC.
  assert.equal(
    pacificPartsToUtcIso({ y: 2026, mo: 1, d: 14, hh: 20, mm: 0 }),
    "2026-01-15T04:00:00.000Z"
  );
});

test("pacificDateParts reads the Pacific calendar day of an instant", () => {
  // The noon-PT sentinel belongs to June 14 in Pacific time.
  assert.deepEqual(pacificDateParts(new Date(SENTINEL)), KNOWN_DAY);
});

// ---------------------------------------------------------- JSON-LD

test("extractFromJsonLd reads a schema.org Event startDate with a time", () => {
  const html = `<html><head>
    <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Event","name":"Show",
     "startDate":"2026-06-14T20:00:00-07:00"}
    </script></head><body>x</body></html>`;
  const res = extractFromJsonLd(html, KNOWN_DAY);
  assert.equal(res.method, "json-ld");
  assert.equal(res.iso, "2026-06-15T03:00:00.000Z");
});

test("parseIsoWallClock reads local parts and ignores the offset", () => {
  assert.deepEqual(parseIsoWallClock("2026-06-14T18:30:00-04:00"), {
    y: 2026,
    mo: 6,
    d: 14,
    hh: 18,
    mm: 30,
  });
  assert.equal(parseIsoWallClock("2026-06-14"), null); // date-only, no time
});

test("extractFromJsonLd anchors the wall-clock time to Pacific, ignoring a non-Pacific offset", () => {
  // Squarespace quirk: a SLO (Pacific) venue's event tagged with an Eastern
  // offset. "18:00-0400" means 6 PM at the venue, NOT 3 PM Pacific — we must
  // treat the printed wall clock as Pacific.
  const html = `<script type="application/ld+json">
    {"@type":"Event","name":"COMEDY","startDate":"2026-06-14T18:00:00-04:00"}</script>`;
  const res = extractFromJsonLd(html, KNOWN_DAY);
  // 6 PM PDT (UTC-7) → 01:00 UTC next day. (Honoring -04:00 would have wrongly
  // produced 22:00 UTC / 3 PM Pacific.)
  assert.equal(res.iso, "2026-06-15T01:00:00.000Z");
});

test("extractFromMeta also anchors wall-clock to Pacific (ignores offset)", () => {
  const html = `<meta property="event:start_time" content="2026-06-14T19:30:00-04:00">`;
  const res = extractFromMeta(html, KNOWN_DAY);
  assert.equal(res.iso, "2026-06-15T02:30:00.000Z"); // 7:30 PM PDT
});

test("extractFromJsonLd finds the Event inside an @graph array", () => {
  const html = `<script type="application/ld+json">
    {"@context":"https://schema.org","@graph":[
      {"@type":"WebPage","name":"page"},
      {"@type":"MusicEvent","startDate":"2026-06-14T19:30:00-07:00"}
    ]}
  </script>`;
  const res = extractFromJsonLd(html, KNOWN_DAY);
  assert.equal(res.iso, "2026-06-15T02:30:00.000Z");
});

test("extractFromJsonLd ignores a date-only startDate (no time to recover)", () => {
  const html = `<script type="application/ld+json">
    {"@type":"Event","startDate":"2026-06-14"}</script>`;
  assert.equal(extractFromJsonLd(html, KNOWN_DAY), null);
});

test("extractFromJsonLd rejects a startDate on a different day", () => {
  // A listing page may embed several events; only the matching day counts.
  const html = `<script type="application/ld+json">
    {"@type":"Event","startDate":"2026-06-20T20:00:00-07:00"}</script>`;
  assert.equal(extractFromJsonLd(html, KNOWN_DAY), null);
});

test("extractFromJsonLd survives a malformed block and uses the next one", () => {
  const html = `
    <script type="application/ld+json">{ this is not json }</script>
    <script type="application/ld+json">
      {"@type":"Event","startDate":"2026-06-14T18:00:00-07:00"}
    </script>`;
  const res = extractFromJsonLd(html, KNOWN_DAY);
  assert.equal(res.iso, "2026-06-15T01:00:00.000Z");
});

// ---------------------------------------------------------- meta tags

test("extractFromMeta reads an event:start_time meta tag", () => {
  const html = `<meta property="event:start_time" content="2026-06-14T19:00:00-07:00">`;
  const res = extractFromMeta(html, KNOWN_DAY);
  assert.equal(res.method, "opengraph");
  assert.equal(res.iso, "2026-06-15T02:00:00.000Z");
});

test("extractFromMeta reads an itemprop=startDate meta tag (content-first order)", () => {
  const html = `<meta content="2026-06-14T21:00:00-07:00" itemprop="startDate">`;
  const res = extractFromMeta(html, KNOWN_DAY);
  assert.equal(res.iso, "2026-06-15T04:00:00.000Z");
});

test("extractFromMeta rejects a wrong-day meta time", () => {
  const html = `<meta property="event:start_time" content="2026-07-01T19:00:00-07:00">`;
  assert.equal(extractFromMeta(html, KNOWN_DAY), null);
});

// ---------------------------------------------------------- visible text

test("htmlToVisibleText strips scripts and styles", () => {
  const html = `<html><head><style>.x{color:red}</style>
    <script>var t="9:00 PM";</script></head>
    <body><p>Live music. Doors @ 6:30</p></body></html>`;
  const text = htmlToVisibleText(html);
  assert.match(text, /Doors @ 6:30/);
  assert.doesNotMatch(text, /9:00 PM/); // the script-only time must not leak
});

test("extractFromText parses an explicit am/pm time", () => {
  assert.deepEqual(extractFromText("The show starts at 8:00 PM sharp."), {
    method: "text",
    hh: 20,
    mm: 0,
  });
});

test("extractFromText handles 'Doors @ 6:30' (PM assumed for evening events)", () => {
  assert.deepEqual(extractFromText("Doors @ 6:30, music after."), {
    method: "text",
    hh: 18,
    mm: 30,
  });
});

test("extractFromText handles 'doors open at 6:30'", () => {
  assert.deepEqual(extractFromText("Doors open at 6:30 pm."), {
    method: "text",
    hh: 18,
    mm: 30,
  });
});

test("extractFromText prefers a show/start time over a doors time", () => {
  const out = extractFromText("Doors 6:30pm. Show at 8pm.");
  assert.deepEqual(out, { method: "text", hh: 20, mm: 0 });
});

test("extractFromText does not latch onto an unrelated number after a label", () => {
  // "5 bands" must not become 5:00; the real time is 8pm.
  const out = extractFromText("Show featuring 5 bands. Tickets, doors. 8:00 PM");
  assert.deepEqual(out, { method: "text", hh: 20, mm: 0 });
});

test("extractFromText returns null when there is no time", () => {
  assert.equal(extractFromText("Join us this summer for a great show!"), null);
});

test("extractFromText ignores a bare unlabelled number (no false 7:00)", () => {
  // "Suite 7" should not be read as a time; only am/pm or labelled times count.
  assert.equal(extractFromText("Held at 123 Main St, Suite 7."), null);
});

// ---------------------------------------------------------- priority chain

test("extractStartTime prefers JSON-LD over meta over text", () => {
  const html = `
    <meta property="event:start_time" content="2026-06-14T18:00:00-07:00">
    <script type="application/ld+json">
      {"@type":"Event","startDate":"2026-06-14T20:00:00-07:00"}</script>
    <body>Doors @ 5:00 PM</body>`;
  const res = extractStartTime(html, { knownDay: KNOWN_DAY });
  // JSON-LD's 8 PM wins.
  assert.equal(res.method, "json-ld");
  assert.equal(res.iso, "2026-06-15T03:00:00.000Z");
});

test("extractStartTime falls back to text when no structured data exists", () => {
  const html = `<body><h1>Tonight</h1><p>Doors @ 7:00 PM</p></body>`;
  const res = extractStartTime(html, { knownDay: KNOWN_DAY });
  assert.equal(res.method, "text");
  assert.equal(res.iso, "2026-06-15T02:00:00.000Z"); // 7 PM PDT
});

// ---------------------------------------------------------- end to end

test("resolveEventTime derives the known day from the sentinel and applies the time", () => {
  const event = { id: "gs-x", starts_at: SENTINEL, source_url: "https://x.test" };
  const html = `<body>Live show. Doors @ 8:00 PM.</body>`;
  const out = resolveEventTime(event, html);
  assert.equal(out.found, true);
  assert.equal(out.method, "text");
  assert.equal(out.startsAt, "2026-06-15T03:00:00.000Z");
});

test("resolveEventTime reports not-found when the page has no time", () => {
  const event = { id: "gs-x", starts_at: SENTINEL, source_url: "https://x.test" };
  const out = resolveEventTime(event, `<body>No time here.</body>`);
  assert.deepEqual(out, { found: false, method: null, startsAt: null });
});
