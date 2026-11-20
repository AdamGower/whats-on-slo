// Tests for town copy and community normalization in src/lib/towns.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TOWNS, normalizeCommunity } from "../src/lib/towns.ts";

test("every town intro is 80 to 120 words, with no em dashes", () => {
  for (const t of TOWNS) {
    const words = t.intro.trim().split(/\s+/).length;
    assert.ok(words >= 80 && words <= 120, `${t.name}: ${words} words`);
    assert.ok(!/[—–]/.test(t.intro), `${t.name} has a dash`);
  }
});

test("intros are unique", () => {
  assert.equal(new Set(TOWNS.map((t) => t.intro)).size, TOWNS.length);
});

test("slugs are unique and URL-safe", () => {
  assert.equal(new Set(TOWNS.map((t) => t.slug)).size, TOWNS.length);
  for (const t of TOWNS) assert.match(t.slug, /^[a-z0-9-]+$/);
});

test("known variants normalize to the canonical town", () => {
  for (const raw of ["San Luis Obsipo", "San Luis Obispo,", "San Luis Obipso", "SLO", "Downtown San Luis Obispo", "900 Palm St", " san luis obispo "]) {
    assert.equal(normalizeCommunity(raw), "San Luis Obispo", raw);
  }
  assert.equal(normalizeCommunity("Port San Luis"), "Avila Beach");
  assert.equal(normalizeCommunity("Morro Bay"), "Morro Bay");
});

test("unknown values pass through trimmed", () => {
  assert.equal(normalizeCommunity("Hamilton"), "Hamilton");
  assert.equal(normalizeCommunity("San Luis Obispo County"), "San Luis Obispo County");
});
