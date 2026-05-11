// Tests for scrape-bigbigslo.mjs.
// Run with: `node --test scripts/scrape-bigbigslo.test.mjs`
//
// We deliberately do NOT commit a copy of the real CitySpark portal bundle
// here. Instead we synthesize a minimal bundle string that mirrors the
// upstream format (a JS source containing `"Events":[...]` JSON literal
// surrounded by code) closely enough to exercise the parser, including
// edge cases like stray brackets and quotes inside surrounding string
// literals.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  extractEventsArray,
  isSloCounty,
  buildRows,
  categoryFromText,
  dedupeBatch,
} from "./scrape-bigbigslo.mjs";

// Build a synthetic CitySpark-style bundle. The surrounding noise contains
// brackets and quotes inside string literals so we can verify the
// balanced-bracket extractor honors string boundaries (a naive bracket
// counter would desync on the noise).
function makeBundle(events) {
  const json = JSON.stringify(events);
  const noise =
    'var stray = "][}{ \\"escaped\\""; ' +
    "if (a > 1 && (c[0] || d[1])) { fn([1,2,3]); }";
  return `${noise}\nconst data={"Other":[],"Events":${json},"Trailing":[1,2]};`;
}

const SAMPLE_EVENTS = [
  {
    PId: 1001,
    Name: "SLO Rep Spring Theatre Performance",
    Venue: "SLO Repertory Theatre",
    CityState: "San Luis Obispo, CA",
    DateStart: "2026-06-01T19:30:00Z",
    DateEnd: "2026-06-01T21:30:00Z",
    Description: 'Theatre with edge cases: brackets [a]{b} and quotes "hi".',
    Short: "Theatre performance.",
    Address: "888 Morro St, San Luis Obispo, CA",
    PrimaryUrl: "https://example.com/slo-rep-show",
    LargeImg: "https://example.com/img-slo.jpg",
  },
  {
    PId: 1002,
    Name: "Santa Barbara Bowl Concert",
    Venue: "Santa Barbara Bowl",
    CityState: "Santa Barbara, CA",
    DateStart: "2026-06-02T20:00:00Z",
    DateEnd: null,
    PrimaryUrl: "https://example.com/sb-bowl",
    Address: "1122 N Milpas St, Santa Barbara, CA",
  },
  {
    PId: 1003,
    Name: "May 2026 Central Coast Cooking Show",
    // Empty venue forces the Address fallback. The address line contains
    // "Theatre Dr" — the category heuristic must not misclassify on it.
    Venue: "",
    CityState: "Paso Robles, CA",
    DateStart: "2026-06-03T17:30:00Z",
    DateEnd: "2026-06-03T19:30:00Z",
    Address: "2361 Theatre Dr, Paso Robles, CA",
    PrimaryUrl: "https://example.com/cooking",
  },
  {
    PId: 1004,
    Name: "Bakersfield Show",
    Venue: "Mechanics Bank Arena",
    CityState: "Bakersfield, CA",
    DateStart: "2026-06-04T20:00:00Z",
  },
  {
    PId: 1005,
    Name: "Cayucos Antique Faire",
    Venue: "Ocean Avenue",
    CityState: "Cayucos, CA",
    DateStart: "2026-06-05T16:00:00Z",
  },
];

test("extractEventsArray finds and parses the Events array", () => {
  const bundle = makeBundle(SAMPLE_EVENTS);
  const events = extractEventsArray(bundle);
  assert.equal(events.length, SAMPLE_EVENTS.length);
  assert.equal(events[0].PId, 1001);
  assert.equal(events[events.length - 1].PId, 1005);
});

test("extractEventsArray respects string-escapes in surrounding code", () => {
  // The surrounding noise contains stray `[` `]` `{` `}` and escaped quotes
  // inside string literals. A correct scanner must not desync on these.
  const bundle = makeBundle(SAMPLE_EVENTS);
  const events = extractEventsArray(bundle);
  // Round-trip: every input field is preserved exactly.
  for (let i = 0; i < SAMPLE_EVENTS.length; i++) {
    assert.equal(events[i].Name, SAMPLE_EVENTS[i].Name);
    assert.equal(events[i].CityState, SAMPLE_EVENTS[i].CityState);
  }
});

test("extractEventsArray throws when the marker is missing", () => {
  assert.throws(
    () => extractEventsArray('var x = {"NotEvents":[]}'),
    /marker/
  );
});

test("isSloCounty whitelists SLO County cities", () => {
  // SLO County — keep
  assert.equal(isSloCounty("San Luis Obispo, CA"), true);
  assert.equal(isSloCounty("Paso Robles, CA"), true);
  assert.equal(isSloCounty("Pismo Beach, CA"), true);
  assert.equal(isSloCounty("Cayucos, CA"), true);
  assert.equal(isSloCounty("Templeton, CA"), true);
  assert.equal(isSloCounty("Avila Beach, CA"), true);

  // Adjacent counties — drop
  assert.equal(isSloCounty("Santa Barbara, CA"), false);
  assert.equal(isSloCounty("Santa Maria, CA"), false);
  assert.equal(isSloCounty("Santa Ynez, CA"), false);
  assert.equal(isSloCounty("Lompoc, CA"), false);
  assert.equal(isSloCounty("Bakersfield, CA"), false);

  // Malformed inputs
  assert.equal(isSloCounty(""), false);
  assert.equal(isSloCounty(null), false);
  assert.equal(isSloCounty("San Luis Obispo"), false); // no state
  assert.equal(isSloCounty("San Luis Obispo, OR"), false); // wrong state
});

test("buildRows filters non-SLO-County rows and shapes the rest correctly", () => {
  const { rows, drops } = buildRows(SAMPLE_EVENTS);

  // 3 SLO-County (SLO Rep, Cooking Show in Paso, Cayucos) + 2 dropped (SB, Bakersfield)
  assert.equal(rows.length, 3);
  assert.equal(drops.length, 2);
  assert.equal(rows.length + drops.length, SAMPLE_EVENTS.length);

  // Every drop has a reason, both are not-slo-county
  for (const d of drops) {
    assert.equal(d.reason, "not-slo-county");
    assert.ok(d.cityState);
  }
  const droppedCities = drops.map((d) => d.cityState).sort();
  assert.deepEqual(droppedCities, ["Bakersfield, CA", "Santa Barbara, CA"]);

  // SLO Rep: id shape + community + Arts category from "Theatre" in title
  const sloRep = rows.find((r) => /SLO Rep/.test(r.title));
  assert.ok(sloRep, "expected SLO Rep row");
  assert.match(sloRep.id, /^bbs-1001-/);
  assert.equal(sloRep.community, "San Luis Obispo");
  assert.equal(sloRep.source, "BigBigSLO");
  assert.equal(sloRep.category, "Arts");
  assert.equal(sloRep.image_url, "https://example.com/img-slo.jpg");
  assert.match(sloRep.starts_at, /^20\d{2}-\d{2}-\d{2}T/);
});

test("buildRows uses Address fallback when Venue is empty", () => {
  const { rows } = buildRows(SAMPLE_EVENTS);
  const cooking = rows.find((r) => /Cooking Show/.test(r.title));
  assert.ok(cooking);
  // Venue was "", so we expect the first address segment.
  assert.equal(cooking.venue, "2361 Theatre Dr");
  // And category must NOT be Arts despite the address containing "Theatre".
  assert.equal(cooking.category, "Food & Drink");
});

test("buildRows drops events missing required fields", () => {
  const synthetic = [
    { PId: 1, Name: "Good", DateStart: "2026-06-01T00:00:00Z", CityState: "San Luis Obispo, CA" },
    { PId: 2, Name: "", DateStart: "2026-06-01T00:00:00Z", CityState: "San Luis Obispo, CA" },
    { PId: 3, Name: "No date", DateStart: null, CityState: "San Luis Obispo, CA" },
    { Name: "No PId", DateStart: "2026-06-01T00:00:00Z", CityState: "San Luis Obispo, CA" },
    { PId: 5, Name: "Wrong county", DateStart: "2026-06-01T00:00:00Z", CityState: "Bakersfield, CA" },
  ];
  const { rows, drops } = buildRows(synthetic);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "Good");
  const reasons = drops.map((d) => d.reason).sort();
  assert.deepEqual(reasons, ["no-date", "no-name", "no-pid", "not-slo-county"]);
});

test("buildRows falls back to BigBigSLO calendar when source has no URL", () => {
  const synthetic = [
    {
      PId: 1,
      Name: "No URL event",
      DateStart: "2026-06-01T00:00:00Z",
      CityState: "San Luis Obispo, CA",
      Venue: "TBA",
      PrimaryUrl: null,
      TicketUrl: null,
    },
  ];
  const { rows } = buildRows(synthetic);
  assert.equal(rows[0].source_url, "https://www.bigbigslo.com/events");
});

test("categoryFromText routes common cases", () => {
  assert.equal(categoryFromText("Live Music at SLO Brew"), "Music");
  assert.equal(categoryFromText("Spring Musical Theatre Performance"), "Arts");
  assert.equal(categoryFromText("Page to Stage: The Rainbow Fish"), "Family");
  assert.equal(categoryFromText("Central Coast Cooking Show"), "Food & Drink");
  assert.equal(categoryFromText("Trivia Night"), "Community");
});

test("dedupeBatch collapses rows that share a dedupe_key", () => {
  // Two different PIds resolve to the same (Pacific day, title slug, venue
  // first word) — the case that fires the DB unique-constraint and breaks
  // the whole upsert batch.
  const synthetic = [
    {
      PId: 2001,
      Name: "Live Music Friday",
      Venue: "SLO Brew Rock",
      CityState: "San Luis Obispo, CA",
      DateStart: "2026-06-12T19:30:00Z",
    },
    {
      PId: 2002,
      Name: "Live Music Friday!",
      Venue: "SLO Brew",
      CityState: "San Luis Obispo, CA",
      DateStart: "2026-06-12T20:00:00Z",
    },
    {
      PId: 2003,
      Name: "Unrelated Show",
      Venue: "Fremont Theater",
      CityState: "San Luis Obispo, CA",
      DateStart: "2026-06-12T20:00:00Z",
    },
  ];
  const { rows } = buildRows(synthetic);
  assert.equal(rows.length, 3);
  const { unique, duplicates } = dedupeBatch(rows);
  assert.equal(unique.length, 2);
  assert.equal(duplicates.length, 1);
  assert.match(duplicates[0].id, /^bbs-2002-/);
  assert.match(duplicates[0].keptId, /^bbs-2001-/);
  // The earlier row survives; the unrelated row passes through.
  const survivorIds = unique.map((r) => r.id).sort();
  assert.match(survivorIds[0], /^bbs-2001-/);
  assert.match(survivorIds[1], /^bbs-2003-/);
});

test("dedupeBatch is a no-op when every row has a distinct key", () => {
  const { rows } = buildRows(SAMPLE_EVENTS);
  const { unique, duplicates } = dedupeBatch(rows);
  assert.equal(unique.length, rows.length);
  assert.equal(duplicates.length, 0);
});

test("end-to-end: bundle string → SLO-County rows", () => {
  const bundle = makeBundle(SAMPLE_EVENTS);
  const events = extractEventsArray(bundle);
  const { rows, drops } = buildRows(events);
  assert.equal(rows.length, 3);
  assert.equal(drops.length, 2);
});
