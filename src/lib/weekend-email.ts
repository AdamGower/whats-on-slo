import type { Event } from "@/types";
import {
  eventDate,
  formatDayLabel,
  formatEventTime,
  groupByDay,
  splitSourceAttribution,
  truncateWords,
} from "@/lib/event-format";
import { SITE_URL } from "@/lib/seo";
import { weekendLabel } from "@/lib/weekend-window";

// The weekly "This weekend in SLO" email, filled from the Friday to Sunday
// window. Not wired to a sender: /email/this-weekend serves the HTML to paste
// into a Kit broadcast, and /this-weekend/feed.xml carries the same events
// for an RSS-driven send.

const PER_DAY = 10;
const UTM = "utm_source=newsletter&utm_medium=email&utm_campaign=this-weekend";

type Window = { friday: string; sunday: string };

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function eventUrl(ev: Event) {
  return `${SITE_URL}/events/${ev.slug}?${UTM}`;
}

// Up to PER_DAY events a day. Events with a photo and a real time go first,
// since they make the strongest listing; order within the day stays by time.
export function pickEmailEvents(events: Event[]) {
  return groupByDay(events).map(([day, list]) => {
    const ranked = [...list]
      .map((ev, i) => ({ ev, i, score: (ev.imageUrl ? 2 : 0) + (ev.timeTba ? 0 : 1) }))
      .sort((a, b) => b.score - a.score || a.i - b.i)
      .slice(0, PER_DAY)
      .sort((a, b) => a.i - b.i)
      .map((x) => x.ev);
    return { day, events: ranked, total: list.length };
  });
}

function shortRange(w: Window) {
  const f = new Date(`${w.friday}T19:00:00Z`);
  const s = new Date(`${w.sunday}T19:00:00Z`);
  const month = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", timeZone: "America/Los_Angeles" });
  const date = (d: Date) =>
    d.toLocaleDateString("en-US", { day: "numeric", timeZone: "America/Los_Angeles" });
  return month(f) === month(s)
    ? `${month(f)} ${date(f)} to ${date(s)}`
    : `${month(f)} ${date(f)} to ${month(s)} ${date(s)}`;
}

export function weekendEmailSubject(w: Window) {
  return `This weekend in SLO: ${shortRange(w)}`;
}

export function renderWeekendEmailHtml(w: Window, events: Event[]): string {
  const days = pickEmailEvents(events);
  const label = weekendLabel(w);
  const allUrl = `${SITE_URL}/this-weekend?${UTM}`;

  const dayBlocks = days
    .map(({ day, events: list, total }) => {
      const heading = formatDayLabel(eventDate(list[0].startsAt));
      const rows = list
        .map((ev) => {
          const blurb = truncateWords(splitSourceAttribution(ev.description).body, 30);
          return `
          <tr><td style="padding:14px 0;border-bottom:1px solid #d8cdb8;">
            <a href="${esc(eventUrl(ev))}" style="font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:bold;color:#2C2416;text-decoration:none;">${esc(ev.title)}</a>
            <div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:#6b6357;padding-top:4px;">${esc(formatEventTime(ev))} &middot; ${esc(ev.venue)}, ${esc(ev.community)}</div>
            ${blurb ? `<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#2C2416;padding-top:6px;">${esc(blurb)}</div>` : ""}
          </td></tr>`;
        })
        .join("");
      const more =
        total > list.length
          ? `<tr><td style="padding:10px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;"><a href="${esc(allUrl)}" style="color:#8a1c1c;">${total - list.length} more on ${esc(heading.split(",")[0])} &raquo;</a></td></tr>`
          : "";
      return `
        <tr><td style="padding:28px 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:bold;color:#2C2416;border-bottom:2px solid #2C2416;" data-day="${day}">${esc(heading)}</td></tr>
        ${rows}${more}`;
    })
    .join("");

  const body = days.length
    ? dayBlocks
    : `<tr><td style="padding:24px 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#6b6357;">Nothing is listed for this weekend yet. See the full calendar at <a href="${esc(SITE_URL)}" style="color:#8a1c1c;">whatsonslo.com</a>.</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(weekendEmailSubject(w))}</title>
</head>
<body style="margin:0;padding:0;background:#faf7f0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f0;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
  <tr><td style="text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#6b6357;">What&rsquo;s On SLO</td></tr>
  <tr><td style="text-align:center;padding-top:8px;font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:bold;color:#2C2416;">This weekend in SLO</td></tr>
  <tr><td style="text-align:center;padding:6px 0 14px;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#6b6357;border-bottom:4px double #2C2416;">${esc(label)} &middot; ${events.length} events across the county</td></tr>
  ${body}
  <tr><td style="padding:28px 0 8px;text-align:center;">
    <a href="${esc(allUrl)}" style="display:inline-block;padding:12px 22px;background:#2C2416;color:#F5F0E8;font-family:Helvetica,Arial,sans-serif;font-size:13px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;">See all ${events.length} events</a>
  </td></tr>
  <tr><td style="padding:16px 0;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#6b6357;">Times and details come from each organizer and can change. Check the event page before you go.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function renderWeekendEmailText(w: Window, events: Event[]): string {
  const days = pickEmailEvents(events);
  const lines = [
    "THIS WEEKEND IN SLO",
    `${weekendLabel(w)} · ${events.length} events across the county`,
    "",
  ];
  for (const { events: list, total } of days) {
    lines.push(formatDayLabel(eventDate(list[0].startsAt)).toUpperCase(), "");
    for (const ev of list) {
      lines.push(ev.title, `${formatEventTime(ev)} · ${ev.venue}, ${ev.community}`, eventUrl(ev), "");
    }
    if (total > list.length) lines.push(`...and ${total - list.length} more that day.`, "");
  }
  lines.push(`All ${events.length} events: ${SITE_URL}/this-weekend?${UTM}`);
  return lines.join("\n");
}
