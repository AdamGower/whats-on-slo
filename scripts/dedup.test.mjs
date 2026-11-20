// Tests for cross-source duplicate handling in src/lib/dedup.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collapseSameSourceMultiVenue,
  dedupRows,
  isWeakDescription,
} from "../src/lib/dedup.ts";

function row(id, over = {}) {
  return {
    id,
    title: "Show",
    starts_at: "2026-11-22T23:00:00Z",
    ends_at: null,
    venue: "Somewhere",
    community: "San Luis Obispo",
    description: "",
    source: id.split("-")[0],
    source_url: "https://example.com",
    category: "Music",
    image_url: null,
    time_tba: false,
    ...over,
  };
}

const RICH = "A full description of the concert program with soloists and the works being performed.";

test("placeholder descriptions are weak, real ones are not", () => {
  assert.equal(isWeakDescription("Live undefined at Performing Arts Center San Luis Obispo."), true);
  assert.equal(isWeakDescription("Live music at Fremont Theater."), true);
  assert.equal(isWeakDescription("The event is held on November 20, 2026 at Hotel Cheval in Paso Robles, CA."), true);
  assert.equal(isWeakDescription(""), true);
  assert.equal(isWeakDescription(RICH), false);
});

test("same title and minute in the same town merges across differing venue names", () => {
  const out = dedupRows([
    row("tm-1", { title: "SLO Master Chorale: Novemberfest", venue: "Performing Arts Center San Luis Obispo", description: "Live undefined at Performing Arts Center San Luis Obispo." }),
    row("vs-2", { title: "SLO Master Chorale: Novemberfest", venue: "Harold Miossi Hall – Performing Arts Center San Luis Obispo", description: RICH }),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "tm-1", "Ticketmaster keeps the listing");
  assert.equal(out[0].description, RICH, "but borrows the real description");
});

test("same-source rows at different venues are not merged by the second pass", () => {
  const out = dedupRows([
    row("lib-1", { venue: "Atascadero Library", community: "Atascadero" }),
    row("lib-2", { venue: "Cambria Library", community: "Atascadero" }),
  ]);
  assert.equal(out.length, 2);
});

test("matinee and evening showings from the winning source both stay", () => {
  const out = dedupRows([
    row("vs-1", { starts_at: "2026-11-21T21:30:00Z", ends_at: "2026-11-21T21:30:00Z", venue: "PCPA Marian Theatre" }),
    row("vs-2", { starts_at: "2026-11-22T03:00:00Z", ends_at: "2026-11-22T03:00:00Z", venue: "PCPA Marian Theatre" }),
    row("gs-3", { starts_at: "2026-11-21T21:30:00Z", ends_at: "2026-11-21T23:30:00Z", venue: "PCPA Marian Theatre" }),
  ]);
  assert.deepEqual(out.map((r) => r.id), ["vs-1", "vs-2"]);
  assert.equal(out[0].ends_at, "2026-11-21T23:30:00Z", "real end time borrowed from goslo");
  assert.equal(out[1].ends_at, "2026-11-22T03:00:00Z", "no match, left as is");
});

test("a weak winner borrows the richest description from its duplicates", () => {
  const out = dedupRows([
    row("bbs-1", { venue: "BarrelHouse Brewing", description: "The event is held on November 20, 2026 at BarrelHouse Brewing in Paso Robles, CA." }),
    row("gs-2", { venue: "BarrelHouse Brewing (Paso Robles)", description: RICH }),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "bbs-1");
  assert.equal(out[0].description, RICH);
});

test("one source, one venue, two times on a day stays as two showings", () => {
  const out = collapseSameSourceMultiVenue([
    row("vs-1", { starts_at: "2026-11-21T21:30:00Z", venue: "PCPA Marian Theatre" }),
    row("vs-2", { starts_at: "2026-11-22T03:00:00Z", venue: "PCPA Marian Theatre" }),
  ]);
  assert.equal(out.length, 2);
  assert.ok(out.every((r) => r.venue === "PCPA Marian Theatre"));
});

test("one source, several venues on a day still collapses with a count", () => {
  const out = collapseSameSourceMultiVenue([
    row("lib-1", { venue: "Atascadero Library" }),
    row("lib-2", { venue: "Cambria Library" }),
    row("lib-3", { venue: "Nipomo Library" }),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].venue, "3 library branches");
});
