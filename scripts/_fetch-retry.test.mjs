// Tests for _fetch-retry.mjs.
// Run with: `node --test scripts/_fetch-retry.test.mjs`

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { fetchWithRetry } from "./_fetch-retry.mjs";

const URL_ = "https://example.test/feed?apikey=secret";
const NO_WAIT = { delaysMs: [0, 0] };

// Replace global fetch with a scripted sequence of outcomes. Each entry is
// either a status number (returns a Response) or an Error (rejects).
let calls;
let realFetch;
let realWarn;
let warnings;

function script(...outcomes) {
  globalThis.fetch = async () => {
    const next = outcomes[calls++];
    if (next instanceof Error) throw next;
    // 304 is a null-body status; Response refuses a body for it.
    return new Response(next === 304 ? null : `body ${next}`, { status: next });
  };
}

beforeEach(() => {
  calls = 0;
  warnings = [];
  realFetch = globalThis.fetch;
  realWarn = console.warn;
  console.warn = (msg) => warnings.push(msg);
});

afterEach(() => {
  globalThis.fetch = realFetch;
  console.warn = realWarn;
});

test("returns a 200 on the first attempt without retrying", async () => {
  script(200);
  const res = await fetchWithRetry(URL_, undefined, NO_WAIT);
  assert.equal(res.status, 200);
  assert.equal(calls, 1);
});

test("retries a network error, then succeeds", async () => {
  const err = new TypeError("fetch failed", { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } });
  script(err, 200);
  const res = await fetchWithRetry(URL_, undefined, NO_WAIT);
  assert.equal(res.status, 200);
  assert.equal(calls, 2);
  assert.match(warnings[0], /UND_ERR_CONNECT_TIMEOUT/);
});

test("retries 429 and 5xx, then succeeds", async () => {
  script(503, 429, 200);
  const res = await fetchWithRetry(URL_, undefined, NO_WAIT);
  assert.equal(res.status, 200);
  assert.equal(calls, 3);
});

test("hands back the final 5xx after three attempts", async () => {
  script(500, 502, 504);
  const res = await fetchWithRetry(URL_, undefined, NO_WAIT);
  assert.equal(res.status, 504);
  assert.equal(await res.text(), "body 504");
  assert.equal(calls, 3);
});

test("rethrows the network error after three attempts", async () => {
  script(new Error("a"), new Error("b"), new Error("c"));
  await assert.rejects(fetchWithRetry(URL_, undefined, NO_WAIT), /^Error: c$/);
  assert.equal(calls, 3);
});

test("does not retry other statuses such as 304, 401 and 404", async () => {
  for (const status of [304, 401, 404]) {
    calls = 0;
    script(status);
    const res = await fetchWithRetry(URL_, undefined, NO_WAIT);
    assert.equal(res.status, status);
    assert.equal(calls, 1);
  }
});

test("retry warnings never include the query string", async () => {
  script(500, 200);
  await fetchWithRetry(URL_, undefined, NO_WAIT);
  assert.equal(warnings.length, 1);
  assert.doesNotMatch(warnings[0], /apikey|secret/);
});
