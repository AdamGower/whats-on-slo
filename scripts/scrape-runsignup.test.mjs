// Tests for scrape-runsignup.mjs.
// Run with: `node --test scripts/scrape-runsignup.test.mjs`
//
// The fixture is synthesized inline rather than captured from RunSignup —
// minimal objects exercising each branch (real event times, date-only
// fallback, draft, private, out-of-window).

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildRows,
  cleanTitle,
  parseRsuDate,
  pacificPartsToUtcIso,
  truncateDescription,
} from "./scrape-runsignup.mjs";

// A "now" inside the fixture range so the 365-day window brackets it.
const FIXED_NOW = new Date("2026-06-15T12:00:00Z");

function fixture() {
  return {
    races: [
      {
        race: {
          race_id: 206950,
          name: "2026 - City to the Sea Half Marathon & 5K",
          next_date: "10/18/2026",
          next_end_date: "10/18/2026",
          is_draft_race: "F",
          is_private_race: "F",
          description: "<p>Point-to-point race to <strong>Avila Beach</strong>.</p>",
          url: "https://runsignup.com/Race/CA/SanLuisObispo/city2thesea",
          address: { street: "989 Chorro Street", city: "San Luis Obispo", state: "CA" },
          logo_url: "https://example.com/logo.png",
          events: [
            { name: "Half", start_time: "10/18/2026 07:00", end_time: "10/18/2026 10:30" },
            { name: "5K", start_time: "10/18/2026 07:30", end_time: "10/18/2026 08:00" },
          ],
        },
      },
      {
        // No event times — must fall back to next_date at the default hour.
        race: {
          race_id: 100,
          name: "Ryan's Ranch Run",
          next_date: "09/06/2026",
          next_end_date: "09/06/2026",
          is_draft_race: "F",
          is_private_race: "F",
          description: "Trail run.",
          url: "https://runsignup.com/Race/CA/PismoBeach/RyansRanchRun",
          address: { city: "Pismo Beach", state: "CA" },
          events: [],
        },
      },
      {
        // Draft — dropped.
        race: {
          race_id: 200, name: "Draft Race", next_date: "08/01/2026",
          is_draft_race: "T", is_private_race: "F", events: [],
          address: { city: "SLO" }, url: "https://x",
        },
      },
      {
        // Private — dropped.
        race: {
          race_id: 201, name: "Private Race", next_date: "08/01/2026",
          is_draft_race: "F", is_private_race: "T", events: [],
          address: { city: "SLO" }, url: "https://x",
        },
      },
      {
        // Far future — outside the 365-day window, dropped.
        race: {
          race_id: 202, name: "Way Future Run", next_date: "10/18/2030",
          is_draft_race: "F", is_private_race: "F", events: [],
          address: { city: "SLO" }, url: "https://x",
        },
      },
    ],
  };
}

test("emits one row per included race, drops draft/private/out-of-window", () => {
  const { rows, drops } = buildRows(fixture(), { now: FIXED_NOW });
  assert.equal(rows.length, 2);
  const reasons = drops.map((d) => d.reason).sort();
  assert.deepEqual(reasons, ["draft", "out-of-window", "private"]);
});

test("collapses multiple events into earliest start / latest end", () => {
  const { rows } = buildRows(fixture(), { now: FIXED_NOW });
  const city = rows.find((r) => r.id === "rsu-206950");
  // 07:00 PDT == 14:00 UTC; latest end 10:30 PDT == 17:30 UTC.
  assert.equal(city.starts_at, "2026-10-18T14:00:00.000Z");
  assert.equal(city.ends_at, "2026-10-18T17:30:00.000Z");
});

test("date-only race falls back to the default morning hour", () => {
  const { rows } = buildRows(fixture(), { now: FIXED_NOW });
  const ryan = rows.find((r) => r.id === "rsu-100");
  // 07:00 PDT fallback == 14:00 UTC.
  assert.equal(ryan.starts_at, "2026-09-06T14:00:00.000Z");
  assert.equal(ryan.ends_at, null);
});

test("every row has required fields, rsu- prefix, Outdoors category", () => {
  const { rows } = buildRows(fixture(), { now: FIXED_NOW });
  for (const r of rows) {
    assert.ok(r.id.startsWith("rsu-"), `id prefix: ${r.id}`);
    assert.ok(r.title, "title set");
    assert.ok(r.starts_at, "starts_at set");
    assert.ok(r.venue, "venue set");
    assert.ok(r.community, "community set");
    assert.equal(r.category, "Outdoors");
    assert.equal(r.source, "RunSignup");
  }
});

test("cleanTitle strips a leading edition year", () => {
  assert.equal(cleanTitle("2026 - City to the Sea"), "City to the Sea");
  assert.equal(cleanTitle("2026 Morro Bay Triathlon"), "Morro Bay Triathlon");
  assert.equal(cleanTitle("Rock to Pier Run"), "Rock to Pier Run");
});

test("cleanTitle drops a pipe-delimited tagline", () => {
  assert.equal(
    cleanTitle("The Sober Endurance 2-4-6 | A public movement"),
    "The Sober Endurance 2-4-6"
  );
  // Year prefix and pipe tagline together.
  assert.equal(cleanTitle("2026 Foo Run | raising funds"), "Foo Run");
});

test("description HTML is stripped and the venue comes from the address", () => {
  const { rows } = buildRows(fixture(), { now: FIXED_NOW });
  const city = rows.find((r) => r.id === "rsu-206950");
  assert.equal(city.description, "Point-to-point race to Avila Beach.");
  assert.equal(city.venue, "989 Chorro Street");
  assert.equal(city.community, "San Luis Obispo");
});

test("parseRsuDate handles datetime, date-only, and junk", () => {
  assert.deepEqual(parseRsuDate("10/18/2026 07:00"), { y: 2026, mo: 10, d: 18, hh: 7, mm: 0 });
  assert.deepEqual(parseRsuDate("9/6/2026"), { y: 2026, mo: 9, d: 6, hh: null, mm: null });
  assert.equal(parseRsuDate(""), null);
  assert.equal(parseRsuDate("not a date"), null);
});

test("pacificPartsToUtcIso applies the PDT offset", () => {
  assert.equal(
    pacificPartsToUtcIso({ y: 2026, mo: 7, d: 4, hh: 8, mm: 0 }),
    "2026-07-04T15:00:00.000Z"
  );
});

test("truncateDescription respects the cap and prefers sentence breaks", () => {
  assert.equal(truncateDescription(""), "");
  assert.equal(truncateDescription("short"), "short");
  const long =
    "First sentence here. Second sentence is a bit longer and continues. " +
    "Third runs on and on with padding to push past the cap easily for sure.";
  const out = truncateDescription(long, 80);
  assert.ok(out.length <= 80);
  assert.match(out, /[.!?…]$/);
});
