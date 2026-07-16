// Tests for scrape-visit-slo.mjs.
// Run with: `node --test scripts/scrape-visit-slo.test.mjs`

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  findUnboundedSeries,
  pacificDay,
  slugFromUrl,
} from "./scrape-visit-slo.mjs";

// The horizon a run would ask for: DAYS_AHEAD (90) past a mid-July "today".
const HORIZON = "2026-10-14";

// Synthesise occurrences the way Visit SLO emits them: one row per day, each
// with its own id, all sharing a slug. Times are pinned to a Pacific offset so
// the Pacific calendar day is unambiguous. (We never commit scraped payloads.)
function series({ slug, title = "Test Event", firstDay, count, stepDays = 1 }) {
  const rows = [];
  const start = Date.parse(`${firstDay}T00:00:00Z`);
  for (let i = 0; i < count; i++) {
    const day = new Date(start + i * stepDays * 86_400_000)
      .toISOString()
      .slice(0, 10);
    rows.push({
      title,
      starts_at: `${day}T19:00:00-07:00`,
      source_url: `https://visitslo.com/events/${slug}/${day}/`,
    });
  }
  return rows;
}

test("slugFromUrl pulls the slug out of a Visit SLO event url", () => {
  assert.equal(
    slugFromUrl("https://visitslo.com/events/sextants-annual-paella-dinner/2026-08-14/"),
    "sextants-annual-paella-dinner"
  );
  assert.equal(slugFromUrl("https://visitslo.com/nope"), null);
  assert.equal(slugFromUrl(null), null);
});

test("pacificDay reports the Pacific calendar day, not the UTC one", () => {
  // 23:30 Pacific on Aug 14 is already Aug 15 in UTC.
  assert.equal(pacificDay("2026-08-14T23:30:00-07:00"), "2026-08-14");
});

test("flags a daily series still running at our horizon", () => {
  const rows = series({
    slug: "sextants-annual-paella-dinner",
    title: "Sextant’s Annual Paella Dinner",
    firstDay: "2026-08-14",
    count: 62, // daily through the horizon — a "repeat daily for a year" listing
  });
  const found = findUnboundedSeries(rows, { windowEndDay: HORIZON });
  assert.equal(found.length, 1);
  assert.equal(found[0].slug, "sextants-annual-paella-dinner");
  assert.equal(found[0].occurrences, 62);
  assert.equal(found[0].first, "2026-08-14");
});

test("leaves a real multi-week run alone (the Circus Vargas case)", () => {
  // 22 consecutive days — longer than some broken listings, but it stops well
  // inside our horizon, which is what makes it real.
  const rows = series({
    slug: "circus-vargas-the-big-one-is-back",
    firstDay: "2026-08-01",
    count: 22,
  });
  assert.deepEqual(findUnboundedSeries(rows, { windowEndDay: HORIZON }), []);
});

test("leaves a weekly series alone even though it reaches the horizon", () => {
  // Trivia night every Tuesday: touches the horizon but nowhere near daily.
  const rows = series({
    slug: "kreuzberg-scantron-trivia",
    firstDay: "2026-07-16",
    count: 14,
    stepDays: 7,
  });
  assert.deepEqual(findUnboundedSeries(rows, { windowEndDay: HORIZON }), []);
});

test("leaves a short run that merely butts against the horizon alone", () => {
  // A 10-day festival starting near the end of the window is dense and ends at
  // the edge, but is too short to be a year-long series.
  const rows = series({
    slug: "late-window-festival",
    firstDay: "2026-10-05",
    count: 10,
  });
  assert.deepEqual(findUnboundedSeries(rows, { windowEndDay: HORIZON }), []);
});

test("tolerates a series stopping a day short of the horizon", () => {
  // Our horizon is a UTC date while days are Pacific, so the last occurrence
  // can land just inside it.
  const rows = series({
    slug: "the-father-a-tragic-farce",
    firstDay: "2026-08-14",
    count: 60, // ends 2026-10-12, two days short of the horizon
  });
  const found = findUnboundedSeries(rows, { windowEndDay: HORIZON });
  assert.equal(found.length, 1);
  assert.equal(found[0].last, "2026-10-12");
});

test("judges each slug separately", () => {
  const rows = [
    ...series({ slug: "bogus", firstDay: "2026-08-14", count: 62 }),
    ...series({ slug: "real-run", firstDay: "2026-08-01", count: 22 }),
  ];
  const found = findUnboundedSeries(rows, { windowEndDay: HORIZON });
  assert.deepEqual(
    found.map((s) => s.slug),
    ["bogus"]
  );
});

test("ignores rows whose url carries no slug", () => {
  const rows = series({ slug: "x", firstDay: "2026-08-14", count: 62 }).map(
    (r) => ({ ...r, source_url: "https://visitslo.com/" })
  );
  assert.deepEqual(findUnboundedSeries(rows, { windowEndDay: HORIZON }), []);
});
