import Link from "next/link";
import type { Event } from "@/types";
import { jsonLdString } from "@/lib/seo";
import {
  DESCRIPTION_WORD_LIMIT,
  eventDate,
  formatCompactDate,
  formatDayLabel,
  formatEventTime,
  groupByDay,
  splitSourceAttribution,
  truncateWords,
} from "@/lib/event-format";

// One event in a listing. The title, image and "Learn more" all go to our own
// /events/[slug] page; the original source link lives on that page.
export function EventCard({ ev }: { ev: Event }) {
  const href = `/events/${ev.slug}`;
  const { body, source } = splitSourceAttribution(ev.description);
  return (
    <li
      className={
        ev.imageUrl
          ? "grid grid-cols-1 md:grid-cols-[10rem_1fr_11rem] gap-x-6 gap-y-3"
          : "grid grid-cols-1 md:grid-cols-[10rem_1fr] gap-x-6 gap-y-1"
      }
    >
      <div className="text-sm">
        <p className="text-muted text-[11px] uppercase tracking-wider">
          {formatCompactDate(eventDate(ev.startsAt))}
        </p>
        <p className="font-semibold mt-0.5">{formatEventTime(ev)}</p>
        <p className="text-muted uppercase text-[11px] tracking-wider mt-1">
          {ev.category}
        </p>
      </div>
      <div className="md:order-2 order-3">
        <h4 className="font-serif text-xl font-bold leading-snug">
          <Link href={href} className="hover:text-accent">
            {ev.title}
          </Link>
        </h4>
        <p className="text-sm text-muted mt-0.5">
          {ev.source === "rideshare.org" ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${ev.venue}, ${ev.community}`)}`}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-dotted underline-offset-2 hover:text-accent"
            >
              {ev.venue}
            </a>
          ) : (
            ev.venue
          )}{" "}
          &middot; {ev.community}
        </p>
        <p className="mt-2 leading-relaxed">
          {truncateWords(body, DESCRIPTION_WORD_LIMIT)}
        </p>
        {source && <p className="mt-1 text-xs italic text-muted">{source}</p>}
        <p className="mt-2 text-xs">
          <Link
            href={href}
            className="underline decoration-dotted underline-offset-2 hover:text-accent"
          >
            Learn more &raquo;
          </Link>
        </p>
      </div>
      {ev.imageUrl && (
        <Link
          href={href}
          className="md:order-3 order-2 block max-w-[12rem] md:max-w-none"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ev.imageUrl}
            alt={ev.title}
            loading="lazy"
            className="w-full aspect-[4/3] object-cover rounded-sm border border-rule"
          />
        </Link>
      )}
    </li>
  );
}

// Events grouped under a heading per Pacific day.
export function EventDayList({
  events,
  emptyText = "No events listed yet. Check back soon.",
}: {
  events: Event[];
  emptyText?: string;
}) {
  const grouped = groupByDay(events);
  if (grouped.length === 0) {
    return <p className="text-muted italic">{emptyText}</p>;
  }
  return (
    <div className="space-y-12">
      {grouped.map(([day, dayEvents]) => (
        <section key={day}>
          <h3 className="font-serif text-2xl font-bold mb-4 flex items-baseline gap-3">
            <span>{formatDayLabel(eventDate(dayEvents[0].startsAt))}</span>
            <span className="flex-1 h-px bg-rule" />
          </h3>
          <ul className="space-y-6">
            {dayEvents.map((ev) => (
              <EventCard key={ev.id} ev={ev} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// A compact list (title, date, venue) for related-events and sidebars.
export function EventMiniList({ events }: { events: Event[] }) {
  return (
    <ul className="divide-y divide-rule border-y border-rule">
      {events.map((ev) => (
        <li key={ev.id} className="py-3">
          <Link
            href={`/events/${ev.slug}`}
            className="font-serif text-lg font-bold leading-snug hover:text-accent"
          >
            {ev.title}
          </Link>
          <p className="text-sm text-muted">
            {formatCompactDate(eventDate(ev.startsAt))} &middot;{" "}
            {formatEventTime(ev)} &middot; {ev.venue}, {ev.community}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdString(data) }}
    />
  );
}

