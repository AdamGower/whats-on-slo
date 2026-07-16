// Tests for _prune-missing.mjs.
// Run with: `node --test scripts/_prune-missing.test.mjs`

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  dayBefore,
  firstPrunableDay,
  pacificDay,
  planPrune,
} from "./_prune-missing.mjs";

// Rows as the table holds them: Pacific-pinned so the calendar day is exact.
function row(id, day, title = "Event") {
  return { id, title, starts_at: `${day}T19:00:00-07:00` };
}

const WINDOW = { windowStartDay: "2026-07-17", windowEndDay: "2026-10-14" };

// A realistic run: most of the window is still listed, a row or two is gone.
// Fixtures have to look like that — a toy set where half the window vanished
// trips the circuit breaker, which is the whole point of it.
function windowOf(staleIds = [], count = 10) {
  const existing = Array.from({ length: count }, (_, i) =>
    row(`vs-${i}`, "2026-08-01")
  );
  const seenIds = new Set(
    existing.map((r) => r.id).filter((id) => !staleIds.includes(id))
  );
  return { existing, seenIds };
}

test("deletes rows the source no longer lists", () => {
  const { existing, seenIds } = windowOf(["vs-7"]);
  const plan = planPrune({ existing, seenIds, ...WINDOW });
  assert.deepEqual(plan.stale, ["vs-7"]);
  assert.equal(plan.refusal, null);
});

test("keeps rows outside the window the run covered", () => {
  // The run only read to 2026-10-14; next spring is not evidence of anything.
  const { existing, seenIds } = windowOf(["vs-7"]);
  existing.push(row("vs-far", "2027-04-01"));
  const plan = planPrune({ existing, seenIds, ...WINDOW });
  assert.deepEqual(plan.stale, ["vs-7"]); // vs-far untouched despite being unseen
});

test("never prunes today or the past", () => {
  // Sources drop an event once it ends, and scrapers skip finished events, so
  // a row dated before the window start can be missing yet real.
  const existing = [row("vs-today", "2026-07-16"), row("vs-old", "2026-01-01")];
  const plan = planPrune({
    existing,
    seenIds: new Set(["vs-something"]),
    ...WINDOW,
  });
  assert.deepEqual(plan.stale, []);
});

test("refuses to prune when the run ingested nothing", () => {
  // A source outage is not a mass cancellation.
  const existing = [row("vs-1", "2026-08-01"), row("vs-2", "2026-08-02")];
  const plan = planPrune({ existing, seenIds: new Set(), ...WINDOW });
  assert.deepEqual(plan.stale, []);
  assert.match(plan.refusal, /no events/);
  assert.equal(plan.candidates.length, 2); // reported, not acted on
});

test("refuses when an implausible share of the window would go", () => {
  // A half-failed fetch looks exactly like a mass retraction.
  const existing = [
    row("vs-1", "2026-08-01"),
    row("vs-2", "2026-08-02"),
    row("vs-3", "2026-08-03"),
    row("vs-4", "2026-08-04"),
  ];
  const plan = planPrune({
    existing,
    seenIds: new Set(["vs-1"]), // 3 of 4 missing — 75%
    ...WINDOW,
  });
  assert.deepEqual(plan.stale, []);
  assert.match(plan.refusal, /75%/);
  assert.equal(plan.candidates.length, 3);
});

test("allows ordinary churn under the ceiling", () => {
  const existing = Array.from({ length: 20 }, (_, i) =>
    row(`vs-${i}`, "2026-08-01")
  );
  const seenIds = new Set(existing.slice(0, 18).map((r) => r.id)); // 10% gone
  const plan = planPrune({ existing, seenIds, ...WINDOW });
  assert.equal(plan.stale.length, 2);
  assert.equal(plan.refusal, null);
});

test("refuses an inverted window", () => {
  // A truncated run can compute an end before the start; prune nothing.
  const plan = planPrune({
    existing: [row("vs-1", "2026-08-01")],
    seenIds: new Set(["vs-other"]),
    windowStartDay: "2026-10-14",
    windowEndDay: "2026-07-17",
  });
  assert.deepEqual(plan.stale, []);
  assert.match(plan.refusal, /empty/);
});

test("an empty window is not a refusal, just nothing to do", () => {
  const plan = planPrune({
    existing: [row("vs-far", "2027-04-01")],
    seenIds: new Set(["vs-far"]),
    ...WINDOW,
  });
  assert.deepEqual(plan.stale, []);
  assert.equal(plan.refusal, null);
  assert.equal(plan.inWindow, 0);
});

test("respects the window edges inclusively", () => {
  const existing = [
    row("vs-start", "2026-07-17"),
    row("vs-end", "2026-10-14"),
    row("vs-before", "2026-07-16"),
    row("vs-after", "2026-10-15"),
  ];
  const plan = planPrune({ existing, seenIds: new Set(), ...WINDOW });
  assert.deepEqual(plan.candidates, ["vs-start", "vs-end"]);
});

test("firstPrunableDay is tomorrow in Pacific terms", () => {
  // 23:00 Pacific on Jul 16 is already Jul 17 in UTC — tomorrow is Jul 17.
  assert.equal(firstPrunableDay(new Date("2026-07-17T06:00:00Z")), "2026-07-17");
  assert.equal(firstPrunableDay(new Date("2026-07-16T18:00:00Z")), "2026-07-17");
});

test("dayBefore steps back one calendar day", () => {
  assert.equal(dayBefore("2026-08-01"), "2026-07-31");
  assert.equal(dayBefore("2026-01-01"), "2025-12-31");
});

test("pacificDay reports the Pacific day, not the UTC one", () => {
  assert.equal(pacificDay("2026-08-14T23:30:00-07:00"), "2026-08-14");
});
