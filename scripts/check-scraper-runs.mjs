// Read recent rows from scraper_logs and email an alert via Resend if any
// scraper reported `status = 'no-data'`. Runs as the final job in the
// scrape workflow with `if: always()` so it executes even when one of the
// scraper jobs has failed.
//
// Designed to be cheap and idempotent: a green run logs the all-clear and
// exits 0; a red run sends one consolidated email per cron firing.

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_TO = process.env.ALERT_TO || "adam@gowercrowd.com";
const ALERT_FROM =
  process.env.ALERT_FROM || "What's On SLO <hello@whatsonslo.com>";

// Window of "this run" — the cron fires every 6 hours, so 30 minutes is
// generous enough to cover any straggler scraper plus monitor startup.
const WINDOW_MINUTES = 30;

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error(
    "Missing env vars. Need SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SECRET_KEY."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
console.log(`Checking scraper_logs for rows since ${since} ...`);

const { data: rows, error } = await supabase
  .from("scraper_logs")
  .select("source, event_count, status, ran_at")
  .gte("ran_at", since)
  .order("ran_at", { ascending: false });

if (error) {
  console.error("Failed to read scraper_logs:", error);
  process.exit(1);
}

// Keep only the most recent row per source — a single source can write
// multiple rows in a window if (e.g.) a re-run fires.
const latestBySource = new Map();
for (const r of rows) {
  if (!latestBySource.has(r.source)) latestBySource.set(r.source, r);
}
const latest = Array.from(latestBySource.values());

const zeroEvents = latest.filter((r) => r.status === "no-data");
const successes = latest.filter((r) => r.status === "success");
const notModified = latest.filter((r) => r.status === "not-modified");
const outOfSeason = latest.filter((r) => r.status === "out-of-season");

console.log(
  `Sources reporting in last ${WINDOW_MINUTES}m: ${latest.length} ` +
    `(success=${successes.length}, no-data=${zeroEvents.length}, ` +
    `not-modified=${notModified.length}, out-of-season=${outOfSeason.length}).`
);

if (zeroEvents.length === 0) {
  console.log("All clear. No alert needed.");
  process.exit(0);
}

const subject = `[whats-on-slo] ${zeroEvents.length} scraper(s) returned zero events`;

const lines = [
  `${zeroEvents.length} scraper source(s) returned zero events in the last ${WINDOW_MINUTES} minutes:`,
  "",
  ...zeroEvents.map((r) => `  • ${r.source}  (ran at ${r.ran_at})`),
  "",
];
if (successes.length) {
  lines.push("Successful sources in this run:");
  for (const r of successes) {
    lines.push(`  • ${r.source}: ${r.event_count} events`);
  }
  lines.push("");
}
if (notModified.length) {
  lines.push("Not-modified (HTTP 304) sources, no work to do:");
  for (const r of notModified) lines.push(`  • ${r.source}`);
  lines.push("");
}
if (outOfSeason.length) {
  lines.push("Out-of-season (seasonal) sources, skipped:");
  for (const r of outOfSeason) lines.push(`  • ${r.source}`);
  lines.push("");
}
lines.push(
  "If a source has been quiet for multiple cycles, check the corresponding GitHub Actions run for parser drift."
);
const body = lines.join("\n");
console.log("\n--- alert body ---\n" + body + "\n--- end ---");

if (!RESEND_API_KEY) {
  console.warn(
    "RESEND_API_KEY not set; alert NOT emailed. The body above is what would have been sent."
  );
  // Don't exit non-zero — the scraper_logs row already records the issue
  // and the operator can still see it in the GitHub Actions log output.
  process.exit(0);
}

const resend = new Resend(RESEND_API_KEY);
const sendResult = await resend.emails.send({
  from: ALERT_FROM,
  to: ALERT_TO,
  subject,
  text: body,
});

if (sendResult.error) {
  console.error("Resend send failed:", sendResult.error);
  process.exit(1);
}
console.log(`Alert email sent to ${ALERT_TO}.`);
