// Tests for scrape-goslo.mjs.
// Run with: `node --test scripts/scrape-goslo.test.mjs`

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildRows,
  dayLabel,
  pacificPartsToUtcIso,
  parseWallClock,
} from "./scrape-goslo.mjs";

// Synthetic events.json items, hand-written to cover each path. (We never
// commit raw scraped feeds as fixtures.)
const venue = (name, town) => ({ id: "v", name, url: "https://venue.test", town });

test("timed evening event keeps its Pacific time and LOCAL-date id", () => {
  const [row] = buildRows([
    {
      title: "Band &amp; Friends",
      date: "2026-12-09T19:30",
      details: "A  night of music.",
      detailsLink: "https://venue.test/e/1",
      venue: venue("The Siren", "Morro Bay"),
      category: "music",
    },
  ]);
  // 7:30 PM PST is 03:30 UTC the next day; the id must still say Dec 09.
  assert.equal(row.starts_at, "2026-12-10T03:30:00.000Z");
  assert.equal(row.id, "gs-band-friends-wed-dec-09-2026");
  assert.equal(row.title, "Band & Friends");
  assert.equal(row.description, "A night of music.");
  assert.equal(row.community, "Morro Bay");
  assert.equal(row.category, "Music");
  assert.equal(row.time_tba, false);
  assert.equal(row.ends_at, null);
});

test("midnight means no known time: noon-Pacific sentinel and time_tba", () => {
  const [row] = buildRows([
    {
      title: "Art Show",
      date: "2026-07-04T00:00",
      details: "",
      detailsLink: "https://venue.test/e/2",
      venue: venue("Some Gallery"),
      category: "art",
    },
  ]);
  assert.equal(row.starts_at, "2026-07-04T19:00:00.000Z"); // noon PDT
  assert.equal(row.time_tba, true);
  assert.equal(row.category, "Arts");
  assert.equal(row.community, "San Luis Obispo"); // no town, no name match
  assert.match(row.description, /^Live event at Some Gallery\./);
});

test("skips recurring, promotion and undated items, and duplicate ids", () => {
  const base = {
    title: "Trivia",
    date: "2026-11-12T18:00",
    detailsLink: "https://venue.test/e/3",
    venue: venue("Pub", "Paso Robles"),
    category: "social-games",
  };
  const rows = buildRows([
    base,
    { ...base, detailsLink: "https://venue.test/e/3b" }, // same title + day
    { ...base, title: "Weekly Yoga", recurring: true },
    { ...base, title: "Clinic Grand Opening", category: "promotion" },
    { ...base, title: "Undated", date: "TBD" },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].community, "Paso Robles");
  assert.equal(rows[0].category, "Community");
});

test("timed end is stored; unknown category falls back to a guess", () => {
  const [row] = buildRows([
    {
      title: "Sunset Hike",
      date: "2026-11-15T14:00",
      dateEnd: "2026-11-15T16:00",
      detailsLink: "https://venue.test/e/4",
      venue: venue("Trailhead"),
      category: "something-new",
    },
  ]);
  assert.equal(row.ends_at, "2026-11-16T00:00:00.000Z");
  assert.equal(row.category, "Outdoors");
});

test("helpers", () => {
  assert.equal(parseWallClock("nope"), null);
  assert.equal(dayLabel({ y: 2026, mo: 4, d: 29 }), "Wed Apr 29 2026");
  assert.equal(
    pacificPartsToUtcIso({ y: 2026, mo: 3, d: 8, hh: 17, mm: 0 }),
    "2026-03-09T00:00:00.000Z" // first day of PDT
  );
  assert.deepEqual(buildRows(null), []);
});
