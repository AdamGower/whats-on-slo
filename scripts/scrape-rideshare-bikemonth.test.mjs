// Tests for scrape-rideshare-bikemonth.mjs.
// Run with: `node --test scripts/scrape-rideshare-bikemonth.test.mjs`

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ical from "node-ical";

import {
  buildRows,
  shouldExclude,
  parseLocation,
  pickLearnMore,
  truncateDescription,
} from "./scrape-rideshare-bikemonth.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(here, "__fixtures__", "rideshare-bikemonth.ics");

// Pick a "now" inside the fixture's date range so the 90-day window
// brackets every fixture event regardless of when the test runs.
const FIXED_NOW = new Date("2026-05-04T12:00:00Z");

async function loadFixture() {
  const text = await fs.readFile(FIXTURE, "utf8");
  return ical.parseICS(text);
}

test("filter passes exactly the three included events", async () => {
  const parsed = await loadFixture();
  const { rows, drops } = buildRows(parsed, { now: FIXED_NOW });

  const titles = rows.map((r) => r.title).sort();
  assert.deepEqual(titles, [
    "Bike Month Kickoff Festival",
    "Family Bike Parade",
    "Sunday Cruiser Ride",
  ]);

  // Each excluded event should be accounted for with a reason — fixture
  // contains 8 excluded VEVENTs.
  assert.equal(drops.length, 8);
  const dropReasons = drops.map((d) => d.reason).sort();
  assert.deepEqual(dropReasons, [
    "elementary-school",
    "register-required",
    "staff-or-employee",
    "to-school",
    "to-work",
    "tune-up",
    "wallace-group",
    "workshop",
  ]);
});

test("re-running produces an identical id set (idempotency)", async () => {
  const parsed = await loadFixture();
  const first = buildRows(parsed, { now: FIXED_NOW }).rows.map((r) => r.id);
  const second = buildRows(parsed, { now: FIXED_NOW }).rows.map((r) => r.id);
  assert.deepEqual(second.sort(), first.sort());
});

test("every emitted row has the required fields and Community category", async () => {
  const parsed = await loadFixture();
  const { rows } = buildRows(parsed, { now: FIXED_NOW });
  for (const r of rows) {
    assert.ok(r.id.startsWith("rs-"), `id has rs- prefix: ${r.id}`);
    assert.ok(r.title, "title set");
    assert.ok(r.starts_at, "starts_at set");
    assert.equal(r.category, "Community");
    assert.equal(r.source, "rideshare.org");
    assert.match(r.description, /Source: SLO Regional Rideshare$/);
  }
});

test("learn-more falls back through the priority chain", async () => {
  const parsed = await loadFixture();
  const { rows, learnMoreLevels } = buildRows(parsed, { now: FIXED_NOW });
  // Sunday Cruiser has URL → vevent-url
  // Kickoff has a URL inside DESCRIPTION → description-url
  // Family Bike Parade has neither → fallback
  assert.equal(learnMoreLevels["vevent-url"], 1);
  assert.equal(learnMoreLevels["description-url"], 1);
  assert.equal(learnMoreLevels["fallback"], 1);

  const cruiser = rows.find((r) => r.title === "Sunday Cruiser Ride");
  assert.equal(cruiser.source_url, "https://example.com/sunday-cruiser");

  const kickoff = rows.find((r) => r.title === "Bike Month Kickoff Festival");
  assert.equal(kickoff.source_url, "https://example.com/kickoff");

  const parade = rows.find((r) => r.title === "Family Bike Parade");
  assert.equal(parade.source_url, "https://rideshare.org/bike-month-calendar/");
});

test("shouldExclude unit cases", () => {
  assert.equal(shouldExclude("Bike to Work Breakfast", "", ""), "to-work");
  assert.equal(shouldExclude("Bike To School Day", "", ""), "to-school");
  assert.equal(shouldExclude("Employee Coffee", "", ""), "staff-or-employee");
  assert.equal(shouldExclude("Staff ride", "", ""), "staff-or-employee");
  assert.equal(shouldExclude("Repair Workshop", "", ""), "workshop");
  assert.equal(shouldExclude("Tune-Up Clinic", "", ""), "tune-up");
  assert.equal(shouldExclude("Tune Up Day", "", ""), "tune-up");
  assert.equal(shouldExclude("Group Ride", "Registration required.", ""), "register-required");
  assert.equal(shouldExclude("Group Ride", "", "Wallace Group Office"), "wallace-group");
  assert.equal(shouldExclude("Bike Rodeo", "", "Sinsheimer Elementary, SLO"), "elementary-school");
  assert.equal(shouldExclude("Family Parade", "Free fun", "Pier, Pismo"), null);
});

test("parseLocation handles common Google Calendar shapes", () => {
  assert.deepEqual(
    parseLocation("Mission Plaza, San Luis Obispo, CA 93401, USA"),
    { venue: "Mission Plaza", community: "San Luis Obispo" }
  );
  assert.deepEqual(
    parseLocation("Avila Beach Promenade, Avila Beach, CA"),
    { venue: "Avila Beach Promenade", community: "Avila Beach" }
  );
  assert.deepEqual(
    parseLocation("Mission Plaza"),
    { venue: "Mission Plaza", community: "San Luis Obispo County" }
  );
  assert.deepEqual(
    parseLocation(""),
    { venue: "TBA", community: "San Luis Obispo County" }
  );
});

test("pickLearnMore prefers VEVENT URL, then description URL, then fallback", () => {
  assert.deepEqual(
    pickLearnMore({ url: "https://a.example", description: "https://b.example" }),
    { url: "https://a.example", level: "vevent-url" }
  );
  assert.deepEqual(
    pickLearnMore({ description: "see https://b.example for info" }),
    { url: "https://b.example", level: "description-url" }
  );
  assert.deepEqual(pickLearnMore({}), {
    url: "https://rideshare.org/bike-month-calendar/",
    level: "fallback",
  });
});

test("truncateDescription respects the cap and prefers sentence breaks", () => {
  assert.equal(truncateDescription(""), "");
  assert.equal(truncateDescription("short text"), "short text");
  const long =
    "First sentence here. Second sentence is a bit longer and continues. " +
    "Third sentence runs on and on with extra padding text to push past the cap easily.";
  const out = truncateDescription(long, 80);
  assert.ok(out.length <= 80);
  // Prefer ending on punctuation when one is reachable in the back third.
  assert.match(out, /[.!?…]$/);
});
