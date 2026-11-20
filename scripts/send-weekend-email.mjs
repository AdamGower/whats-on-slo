// Schedules the weekly "This weekend in SLO" email in Kit.
//
// Run by .github/workflows/weekend-email.yml on Thursday mornings. It fetches
// the ready-made email from whatsonslo.com/email/this-weekend, checks that it
// is for the coming weekend, and creates a Kit broadcast to all subscribers,
// scheduled for Thursday at 5 PM Pacific.
//
//   KIT_API_KEY=...  node scripts/send-weekend-email.mjs            # schedule
//   KIT_API_KEY=...  WEEKEND_EMAIL_MODE=draft node scripts/...      # draft only
//
// Draft mode saves the broadcast without a send time, so nothing goes out.
// Running twice in schedule mode is safe: a broadcast with the same subject
// that is already scheduled or sent is left alone.

import { weekendLabel, weekendWindow } from "../src/lib/weekend-window.ts";

const KIT_API = "https://api.kit.com/v4";
const SEND_TIME = "17:00"; // Pacific, on the Thursday before the weekend
const FETCH_TRIES = 6;
const FETCH_WAIT_MS = 30_000;

// The UTC instant for a wall-clock time in Pacific on a given day, correct
// across daylight saving changes.
export function pacificToUtc(day, time) {
  const guess = new Date(`${day}T${time}:00Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(guess)
      .map((p) => [p.type, p.value]),
  );
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess.getTime() - (wall - guess.getTime()));
}

// 5 PM Pacific on the Thursday before the weekend's Friday.
export function sendTimeFor(window) {
  const thursday = new Date(`${window.friday}T12:00:00Z`);
  thursday.setUTCDate(thursday.getUTCDate() - 1);
  return pacificToUtc(thursday.toISOString().slice(0, 10), SEND_TIME);
}

// Pulls the subject, body and event count out of /email/this-weekend.
export function parseEmailPage(html) {
  const subject = html.match(/<title>([^<]*)<\/title>/)?.[1]?.trim();
  const open = html.indexOf("<body");
  const close = html.lastIndexOf("</body>");
  if (!subject || open < 0 || close < 0) throw new Error("Email page is missing its title or body");
  const body = html.slice(html.indexOf(">", open) + 1, close).trim();
  const count = Number(html.match(/&middot; (\d+) events across the county/)?.[1] ?? 0);
  return { subject: decodeEntities(subject), body, count };
}

function decodeEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// True when a broadcast with this subject is already scheduled or sent.
export function alreadyQueued(broadcasts, subject) {
  return broadcasts.some(
    (b) => b.subject === subject && ["scheduled", "sending", "completed"].includes(b.status),
  );
}

async function fetchEmailPage(siteUrl, window) {
  // The page is cached and rebuilt in the background, so the first request
  // after a quiet spell can return last weekend's copy. Retry until it shows
  // the coming weekend.
  const label = weekendLabel(window);
  for (let i = 1; i <= FETCH_TRIES; i++) {
    const res = await fetch(`${siteUrl}/email/this-weekend`, {
      signal: AbortSignal.timeout(60_000),
    });
    if (res.ok) {
      const html = await res.text();
      if (html.includes(label)) return html;
      console.log(`Attempt ${i}: page is not for ${label} yet, waiting for it to refresh`);
    } else {
      console.log(`Attempt ${i}: ${res.status} from ${siteUrl}/email/this-weekend`);
    }
    if (i < FETCH_TRIES) await new Promise((r) => setTimeout(r, FETCH_WAIT_MS));
  }
  throw new Error(`Could not get the email for ${label} from ${siteUrl}`);
}

async function kit(path, apiKey, init = {}) {
  const res = await fetch(`${KIT_API}${path}`, {
    ...init,
    headers: {
      "X-Kit-Api-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Kit ${init.method ?? "GET"} ${path} failed: ${res.status} ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

async function main() {
  const apiKey = process.env.KIT_API_KEY;
  if (!apiKey) throw new Error("KIT_API_KEY is not set");
  const mode = (process.env.WEEKEND_EMAIL_MODE || "schedule").toLowerCase();
  if (!["schedule", "draft"].includes(mode)) throw new Error(`Unknown WEEKEND_EMAIL_MODE "${mode}"`);
  const siteUrl = (process.env.SITE_URL || "https://whatsonslo.com").replace(/\/$/, "");

  const window = weekendWindow(new Date());
  const sendAt = sendTimeFor(window);
  console.log(`Weekend: ${weekendLabel(window)}. Mode: ${mode}. Send time: ${sendAt.toISOString()}`);
  if (mode === "schedule" && sendAt.getTime() < Date.now() + 5 * 60_000) {
    throw new Error("This weekend's send time has passed; nothing scheduled. Use draft mode to build it anyway.");
  }

  const { subject, body, count } = parseEmailPage(await fetchEmailPage(siteUrl, window));
  if (count === 0) throw new Error(`No events listed for ${weekendLabel(window)}; not sending an empty email`);
  console.log(`Email: "${subject}", ${count} events`);

  if (mode === "schedule") {
    const { broadcasts = [] } = await kit("/broadcasts?per_page=100&slim=true", apiKey);
    if (alreadyQueued(broadcasts, subject)) {
      console.log(`"${subject}" is already scheduled or sent in Kit. Nothing to do.`);
      return;
    }
  }

  const { broadcast } = await kit("/broadcasts", apiKey, {
    method: "POST",
    body: JSON.stringify({
      subject,
      content: body,
      preview_text: `${count} events across San Luis Obispo County this weekend`,
      description:
        mode === "draft"
          ? "Test draft from the weekend-email workflow. Do not send."
          : "Sent automatically by the weekend-email workflow.",
      public: false,
      published_at: null,
      send_at: mode === "schedule" ? sendAt.toISOString() : null,
    }),
  });
  console.log(
    `Created Kit broadcast ${broadcast?.id}: status ${broadcast?.status}, send_at ${broadcast?.send_at ?? "none"}`,
  );
  console.log(`Audience: ${JSON.stringify(broadcast?.subscriber_filter ?? "default")}`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
