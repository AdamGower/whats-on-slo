// Tests for _log-run.mjs.
// Run with: `node --test scripts/_log-run.test.mjs`

import { test } from "node:test";
import assert from "node:assert/strict";

import { logRun } from "./_log-run.mjs";

// Minimal stand-in for the supabase-js client surface logRun touches.
function makeFakeSupabase({ insertImpl } = {}) {
  const calls = [];
  const client = {
    from(table) {
      calls.push({ kind: "from", table });
      return {
        async insert(payload) {
          calls.push({ kind: "insert", table, payload });
          return insertImpl ? insertImpl(payload) : { error: null };
        },
      };
    },
    _calls: calls,
  };
  return client;
}

test("logRun writes one row to scraper_logs with the expected shape", async () => {
  const supabase = makeFakeSupabase();
  await logRun(supabase, "BigBigSLO", 14, "success");

  const insertCall = supabase._calls.find((c) => c.kind === "insert");
  assert.ok(insertCall, "expected an insert call");
  assert.equal(insertCall.table, "scraper_logs");
  assert.equal(insertCall.payload.source, "BigBigSLO");
  assert.equal(insertCall.payload.event_count, 14);
  assert.equal(insertCall.payload.status, "success");
  assert.match(
    insertCall.payload.ran_at,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    "ran_at should be ISO 8601"
  );
});

test("logRun defaults status to 'success' when omitted", async () => {
  const supabase = makeFakeSupabase();
  await logRun(supabase, "Visit SLO", 42);
  const insertCall = supabase._calls.find((c) => c.kind === "insert");
  assert.equal(insertCall.payload.status, "success");
});

test("logRun does NOT throw if the insert returns an error", async () => {
  // Logging is observability — a failure must never abort the scraper.
  const supabase = makeFakeSupabase({
    insertImpl: () => ({ error: { message: "table missing" } }),
  });
  // Capture warn output so the test stays quiet
  const origWarn = console.warn;
  let warned = "";
  console.warn = (msg) => {
    warned = String(msg);
  };
  try {
    await logRun(supabase, "Madonna Inn", 0, "no-data");
    assert.match(warned, /scraper_logs insert failed for Madonna Inn/);
    assert.match(warned, /no-data/);
    assert.match(warned, /count=0/);
  } finally {
    console.warn = origWarn;
  }
});

test("logRun accepts the three known status values", async () => {
  const supabase = makeFakeSupabase();
  await logRun(supabase, "rideshare.org", 0, "not-modified");
  await logRun(supabase, "goslo.events", 0, "no-data");
  await logRun(supabase, "Ticketmaster", 5, "success");
  const inserts = supabase._calls.filter((c) => c.kind === "insert");
  assert.deepEqual(
    inserts.map((c) => c.payload.status),
    ["not-modified", "no-data", "success"]
  );
});
