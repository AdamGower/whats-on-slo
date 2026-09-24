// Tests for the dry-run client in _supabase.mjs.
// Run with: `node --test scripts/_supabase.test.mjs`

import { test } from "node:test";
import assert from "node:assert/strict";

import { createDryRunClient } from "./_supabase.mjs";
import { logRun } from "./_log-run.mjs";

function makeClient() {
  const lines = [];
  return { client: createDryRunClient({ log: (l) => lines.push(l) }), lines };
}

test("list reads resolve to an empty array", async () => {
  const { client } = makeClient();
  const { data, error } = await client
    .from("events")
    .select("id,title,starts_at")
    .like("id", "goslo-%")
    .order("starts_at", { ascending: true })
    .range(0, 999);
  assert.deepEqual(data, []);
  assert.equal(error, null);
});

test("maybeSingle reads resolve to null, as for a missing row", async () => {
  const { client } = makeClient();
  const { data } = await client
    .from("scraper_state")
    .select("etag,last_modified")
    .eq("key", "seapines")
    .maybeSingle();
  assert.equal(data, null);
});

test("an events upsert is logged with its count and a sample row", async () => {
  const { client, lines } = makeClient();
  const rows = [{ id: "a", title: "One" }, { id: "b", title: "Two" }];
  const { error } = await client.from("events").upsert(rows, { onConflict: "id" });
  assert.equal(error, null);
  assert.equal(lines[0], "[dry run] would upsert 2 row(s) in events");
  assert.match(lines[1], /"id":"a"/);
});

test("a chunked delete logs the ids it would remove", async () => {
  const { client, lines } = makeClient();
  await client.from("events").delete().in("id", ["x", "y", "z"]);
  assert.deepEqual(lines, ["[dry run] would delete 3 row(s) in events"]);
});

test("logRun goes through without error", async () => {
  const { client, lines } = makeClient();
  await logRun(client, "Test", 5, "success");
  assert.deepEqual(lines, ["[dry run] would insert 1 row(s) in scraper_logs"]);
});
