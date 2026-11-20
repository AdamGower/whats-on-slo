// Tests for the Friday-to-Sunday window in src/lib/weekend-window.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { weekendLabel, weekendWindow } from "../src/lib/weekend-window.ts";

test("weekday points at the coming weekend", () => {
  // Wednesday Nov 18 2026, 10 AM Pacific
  const w = weekendWindow(new Date("2026-11-18T18:00:00Z"));
  assert.deepEqual(w, { friday: "2026-11-20", sunday: "2026-11-22", from: "2026-11-20", to: "2026-11-23" });
  assert.equal(weekendLabel(w), "Friday, November 20 to Sunday, November 22");
});

test("Saturday starts today, keeps the same weekend", () => {
  const w = weekendWindow(new Date("2026-11-21T20:00:00Z"));
  assert.equal(w.friday, "2026-11-20");
  assert.equal(w.from, "2026-11-21");
});

test("late Sunday evening Pacific is still Sunday, not Monday UTC", () => {
  // 11 PM Sunday Pacific = 07:00 Monday UTC
  const w = weekendWindow(new Date("2026-11-23T07:00:00Z"));
  assert.equal(w.from, "2026-11-22");
  assert.equal(w.to, "2026-11-23");
});

test("Monday moves on to the next weekend", () => {
  const w = weekendWindow(new Date("2026-11-23T17:00:00Z"));
  assert.equal(w.friday, "2026-11-27");
});
