import type { Event } from "@/types";
import {
  TIMEZONE,
  allDayLastDay,
  cleanDescription,
  dayKey,
  eventDate,
  splitSourceAttribution,
  timeKind,
} from "@/lib/event-format";
import { isHandCurated } from "@/lib/supabase";
import { SITE_NAME, SITE_URL, absUrl } from "@/lib/seo";
import { GENERIC_VENUE } from "@/lib/slug";

// schema.org structured data. The rule throughout: leave a property out rather
// than guess at it. We hold no price data (so no `offers`), no postal codes,
// and the `source` of a scraped row is the listing site, not the organizer.

// "2026-05-01T17:00:00-07:00": the Pacific wall-clock time with its offset,
// which is what Google expects for an event's local start time.
export function pacificIsoWithOffset(d: Date): string {
  const local = d
    .toLocaleString("sv-SE", { timeZone: TIMEZONE })
    .replace(" ", "T");
  const offsetMin = Math.round(
    (Date.parse(`${local}Z`) - Math.floor(d.getTime() / 1000) * 1000) / 60000
  );
  const sign = offsetMin <= 0 ? "-" : "+";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${local}${sign}${hh}:${mm}`;
}

// startDate/endDate per the event's time kind. All-day and Time TBA events get
// a bare date: we know the day, not the hour.
export function eventDates(ev: Event): { startDate: string; endDate?: string } {
  const start = eventDate(ev.startsAt);
  const kind = timeKind(ev);
  if (kind === "timed") {
    const endDate =
      ev.endsAt && eventDate(ev.endsAt) > start
        ? pacificIsoWithOffset(eventDate(ev.endsAt))
        : undefined;
    return { startDate: pacificIsoWithOffset(start), endDate };
  }
  const startDay = dayKey(start);
  if (kind === "allday") {
    const last = allDayLastDay(ev);
    return { startDate: startDay, endDate: last !== startDay ? last : undefined };
  }
  return { startDate: startDay };
}

const VIRTUAL_VENUE = /\bvirtual(ly)?\b|\bonline\b/i;

// "SLO Elks Lodge, 222 Elks Lane" -> name + street. A venue that is itself an
// address ("255 Pomeroy rd") is both.
function splitVenue(venue: string): { name: string; street?: string } {
  const v = venue.trim();
  const comma = v.indexOf(",");
  if (comma > 0) {
    const rest = v.slice(comma + 1).trim();
    if (/^\d+\s+\S/.test(rest)) return { name: v.slice(0, comma).trim(), street: rest };
  }
  if (/^\d+\s+[A-Za-z]/.test(v)) return { name: v, street: v };
  return { name: v };
}

function stripEmpty<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "")
  ) as T;
}

export function eventJsonLd(ev: Event) {
  const url = absUrl(`/events/${ev.slug}`);
  const { startDate, endDate } = eventDates(ev);
  const description = cleanDescription(splitSourceAttribution(ev.description).body);
  const virtual = VIRTUAL_VENUE.test(ev.venue);

  const location = virtual
    ? { "@type": "VirtualLocation", url: ev.sourceUrl }
    : (() => {
        const { name, street } = splitVenue(ev.venue);
        return {
          "@type": "Place",
          name: GENERIC_VENUE.test(name) ? ev.community : name,
          address: stripEmpty({
            "@type": "PostalAddress",
            streetAddress: street,
            addressLocality: ev.community,
            addressRegion: "CA",
            addressCountry: "US",
          }),
        };
      })();

  return stripEmpty({
    "@context": "https://schema.org",
    "@type": "Event",
    name: ev.title,
    url,
    startDate,
    endDate,
    eventAttendanceMode: virtual
      ? "https://schema.org/OnlineEventAttendanceMode"
      : "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location,
    description: description ? description.slice(0, 5000) : undefined,
    image: ev.imageUrl ? [ev.imageUrl] : undefined,
    organizer: isHandCurated(ev.id)
      ? { "@type": "Organization", name: ev.source }
      : undefined,
  });
}

// ItemList for a listing page: each entry points at our event page, the
// "summary page" pattern Google documents for event lists. Capped so a month
// view doesn't ship hundreds of entries.
export function itemListJsonLd(events: Event[], name: string, max = 100) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: Math.min(events.length, max),
    itemListElement: events.slice(0, max).map((ev, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: absUrl(`/events/${ev.slug}`),
      name: ev.title,
    })),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absUrl(it.path),
    })),
  };
}

export const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
};
