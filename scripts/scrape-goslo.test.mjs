// Tests for scrape-goslo.mjs.
// Run with: `node --test scripts/scrape-goslo.test.mjs`

import { test } from "node:test";
import assert from "node:assert/strict";

import { parseGosloDate } from "./scrape-goslo.mjs";

test("parseGosloDate parses a well-formed goslo date to noon-PT-ish UTC", () => {
  // 19:00 UTC ≈ noon PDT.
  assert.equal(parseGosloDate("Wed Apr 29 2026"), "2026-04-29T19:00:00.000Z");
  assert.equal(parseGosloDate("Mon Jan 5 2026"), "2026-01-05T19:00:00.000Z");
  assert.equal(parseGosloDate("Thu Dec 31 2026"), "2026-12-31T19:00:00.000Z");
});

test("parseGosloDate returns null for malformed or unrecognized input", () => {
  assert.equal(parseGosloDate(""), null);
  assert.equal(parseGosloDate("not a date"), null);
  assert.equal(parseGosloDate("Wed Foo 29 2026"), null);
});
