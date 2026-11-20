// Tests for the all-day / Time TBA classification in src/lib/event-format.ts.
// Node can strip TypeScript types itself, so the real module is imported.
import { test } from "node:test";
import assert from "node:assert/strict";
import { timeKind, formatEventTime } from "../src/lib/event-format.ts";

test("Visit SLO midnight to 23:59 is all day", () => {
  const ev = { startsAt: "2026-10-25T07:00:00Z", endsAt: "2026-10-26T06:59:59Z" };
  assert.equal(timeKind(ev), "allday");
  assert.equal(formatEventTime(ev), "All day");
});

test("multi-day Visit SLO run shows its last day", () => {
  const ev = { startsAt: "2026-05-07T07:00:00Z", endsAt: "2026-05-18T06:59:59Z" };
  assert.equal(formatEventTime(ev), "All day, through May 17");
});

test("library midnight to midnight is all day, end day exclusive", () => {
  const ev = { startsAt: "2026-04-28T07:00:00Z", endsAt: "2026-05-02T07:00:00Z" };
  assert.equal(formatEventTime(ev), "All day, through May 1");
  const same = { startsAt: "2026-07-21T07:00:00Z", endsAt: "2026-07-21T07:00:00Z" };
  assert.equal(formatEventTime(same), "All day");
});

test("bare midnight with no end is Time TBA, not all day", () => {
  assert.equal(timeKind({ startsAt: "2026-05-21T07:00:00Z" }), "tba");
});

test("midnight with an evening end is Time TBA", () => {
  assert.equal(timeKind({ startsAt: "2026-11-21T08:00:00Z", endsAt: "2026-11-22T04:00:00Z" }), "tba");
});

test("time_tba flag wins", () => {
  assert.equal(timeKind({ startsAt: "2026-05-21T19:00:00Z", timeTba: true }), "tba");
});

test("a real time stays timed", () => {
  const ev = { startsAt: "2026-05-01T00:00:00Z", endsAt: "2026-05-01T03:00:00Z" };
  assert.equal(timeKind(ev), "timed");
  assert.equal(formatEventTime(ev), "5 PM – 8 PM");
});
