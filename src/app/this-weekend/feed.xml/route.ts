import { SITE_URL } from "@/lib/seo";
import { fetchWeekendEvents, weekendLabel } from "@/lib/weekend";
import {
  cleanDescription,
  eventDate,
  formatCompactDate,
  formatEventTime,
  splitSourceAttribution,
} from "@/lib/event-format";

// RSS 2.0 feed of this weekend's events. An email tool with RSS automation
// (Kit's RSS-to-email, if your plan includes it) can build the Friday send
// from this without anyone pasting HTML.
export const revalidate = 900;

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  const { window, events } = await fetchWeekendEvents();
  const items = events
    .map((ev) => {
      const url = `${SITE_URL}/events/${ev.slug}`;
      const body = cleanDescription(splitSourceAttribution(ev.description).body);
      const when = `${formatCompactDate(eventDate(ev.startsAt))}, ${formatEventTime(ev)}`;
      return `    <item>
      <title>${esc(ev.title)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <category>${esc(ev.category)}</category>
      <description>${esc(`${when} at ${ev.venue}, ${ev.community}. ${body}`.trim())}</description>
      <pubDate>${new Date(ev.startsAt).toUTCString()}</pubDate>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>This weekend in SLO</title>
    <link>${SITE_URL}/this-weekend</link>
    <atom:link href="${SITE_URL}/this-weekend/feed.xml" rel="self" type="application/rss+xml"/>
    <description>${esc(`Events across San Luis Obispo County, ${weekendLabel(window)}.`)}</description>
    <language>en-us</language>
${items}
  </channel>
</rss>
`;
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
