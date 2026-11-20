// Tests for the pure helpers in scripts/send-weekend-email.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alreadyQueued,
  pacificToUtc,
  parseEmailPage,
  sendTimeFor,
} from "./send-weekend-email.mjs";

test("5 PM Pacific converts to UTC in standard and daylight time", () => {
  assert.equal(pacificToUtc("2026-11-26", "17:00").toISOString(), "2026-11-27T01:00:00.000Z");
  assert.equal(pacificToUtc("2026-07-16", "17:00").toISOString(), "2026-07-17T00:00:00.000Z");
});

test("send time is the Thursday before the weekend", () => {
  assert.equal(
    sendTimeFor({ friday: "2026-11-27", sunday: "2026-11-29" }).toISOString(),
    "2026-11-27T01:00:00.000Z",
  );
  // Friday on the first of the month: Thursday is in the previous month.
  assert.equal(
    sendTimeFor({ friday: "2027-01-01", sunday: "2027-01-03" }).toISOString(),
    "2027-01-01T01:00:00.000Z",
  );
});

test("parses subject, body and count from the email page", () => {
  const html = `<!doctype html><html><head><title>This weekend in SLO: Nov 27 to 29</title></head>
<body style="margin:0;"><table><tr><td>Friday &middot; 42 events across the county</td></tr></table></body></html>`;
  const { subject, body, count } = parseEmailPage(html);
  assert.equal(subject, "This weekend in SLO: Nov 27 to 29");
  assert.equal(body, "<table><tr><td>Friday &middot; 42 events across the county</td></tr></table>");
  assert.equal(count, 42);
});

test("missing title or body throws", () => {
  assert.throws(() => parseEmailPage("<html><body></body></html>"));
});

test("only scheduled or sent broadcasts with the same subject count as queued", () => {
  const list = [
    { subject: "This weekend in SLO: Nov 27 to 29", status: "draft" },
    { subject: "This weekend in SLO: Nov 20 to 22", status: "completed" },
  ];
  assert.equal(alreadyQueued(list, "This weekend in SLO: Nov 27 to 29"), false);
  assert.equal(alreadyQueued(list, "This weekend in SLO: Nov 20 to 22"), true);
});
