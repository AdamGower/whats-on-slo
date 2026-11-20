import { fetchUpcomingEvents, fetchEventsForMonth } from "@/lib/supabase";
import type { Event } from "@/types";
import SiteFooter from "@/components/SiteFooter";
import {
  CATEGORIES,
  DESCRIPTION_WORD_LIMIT,
  TIMEZONE,
  eventDate,
  formatCompactDate,
  formatDayLabel,
  formatEventTime,
  formatMonthLabel,
  formatMonthShort,
  groupByDay,
  monthKey,
  splitSourceAttribution,
  truncateWords,
} from "@/lib/event-format";

function buildMonthIndex(events: Event[]) {
  const counts = new Map<string, number>();
  for (const ev of events) {
    const key = monthKey(eventDate(ev.startsAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, count]) => ({ key, count, label: formatMonthLabel(key) }));
}

function buildCategoryCounts(events: Event[]) {
  const counts = new Map<string, number>();
  for (const ev of events) {
    counts.set(ev.category, (counts.get(ev.category) ?? 0) + 1);
  }
  return counts;
}

// Build a URL preserving the params we want and dropping defaults so the
// canonical "/" stays clean.
function buildHref(
  month: string | null,
  cat: string | null,
  defaultMonth: string | null
) {
  const params = new URLSearchParams();
  if (month && month !== defaultMonth) params.set("month", month);
  if (cat) params.set("cat", cat);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}

export function eventsTitle(month: string | null, cat: string | null) {
  // Only title by month for a well-formed YYYY-MM; a malformed value renders
  // the default view, so it shouldn't produce an "Events in Invalid Date" tag.
  const monthLabel =
    month && /^\d{4}-\d{2}$/.test(month) ? formatMonthLabel(month) : null;
  return monthLabel && cat
    ? `${cat} events in ${monthLabel}`
    : monthLabel
    ? `Events in ${monthLabel}`
    : cat
    ? `${cat} events`
    : null;
}

// Shared body of "/" and the "/browse/[month]/[cat]" route that next.config
// rewrites "/?month=&cat=" onto. It reads its filters from props, never from
// searchParams, so both routes stay statically cached (ISR) instead of
// re-rendering on every request.
export default async function EventsView({
  month,
  cat,
}: {
  month: string | null;
  cat: string | null;
}) {
  const events = await fetchUpcomingEvents();
  const months = buildMonthIndex(events);

  // The month rail lists current/upcoming months only. A past month is
  // reachable by direct ?month= URL but never advertised as a button, and its
  // events aren't in the upcoming fetch, so it's pulled on demand below.
  const requestedMonth = month;
  const currentMonth = monthKey(new Date());
  const isUpcomingMonth =
    !!requestedMonth && months.some((m) => m.key === requestedMonth);
  const isPastMonth =
    !!requestedMonth &&
    /^\d{4}-\d{2}$/.test(requestedMonth) &&
    requestedMonth < currentMonth;

  // Default to the first month with events (the current/upcoming one). An
  // unrecognized or empty future month falls back here too.
  const validMonth = isUpcomingMonth
    ? requestedMonth!
    : isPastMonth
    ? requestedMonth!
    : months[0]?.key ?? currentMonth;

  const monthEvents = isPastMonth
    ? await fetchEventsForMonth(validMonth)
    : events.filter((ev) => monthKey(eventDate(ev.startsAt)) === validMonth);

  // Category filter — applied within the selected month
  const requestedCat = cat;
  const validCat =
    requestedCat && (CATEGORIES as string[]).includes(requestedCat)
      ? (requestedCat as Event["category"])
      : null;
  const categoryCounts = buildCategoryCounts(monthEvents);
  const filteredEvents = validCat
    ? monthEvents.filter((ev) => ev.category === validCat)
    : monthEvents;
  const grouped = groupByDay(filteredEvents);

  const defaultMonthKey = months[0]?.key ?? null;

  const today = new Date();
  const longDate = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: TIMEZONE,
  });

  return (
    <div className="flex flex-col flex-1 w-full">
      <header className="border-b-4 border-double border-foreground/80 px-6 pt-10 pb-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-[11px] uppercase tracking-[0.3em] text-muted">
            A daily guide for the Central Coast
          </p>
          <h1
            className="font-serif text-center text-5xl sm:text-6xl md:text-7xl font-black tracking-tight mt-3"
            style={{ fontStretch: "expanded" }}
          >
            What&rsquo;s On SLO
          </h1>
          <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs uppercase tracking-widest text-muted border-t border-rule pt-3">
            <span>San Luis Obispo &middot; {longDate}</span>
            <span className="hidden md:flex items-center gap-3">
              <a
                href="/about"
                className="underline decoration-dotted underline-offset-2 hover:text-accent"
              >
                About
              </a>
              <span aria-hidden>&middot;</span>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- kept as a plain link, as it was when this lived in app/page.tsx */}
              <a
                href="/"
                className="underline decoration-dotted underline-offset-2 hover:text-accent"
              >
                Events
              </a>
              <span aria-hidden>&middot;</span>
              <a
                href="/hiking"
                className="underline decoration-dotted underline-offset-2 hover:text-accent"
              >
                Hiking
              </a>
              <span aria-hidden>&middot;</span>
              <a
                href="/submit"
                className="underline decoration-dotted underline-offset-2 hover:text-accent"
              >
                Submit your event
              </a>
              <span aria-hidden>&middot;</span>
              <a
                href="/comments"
                className="underline decoration-dotted underline-offset-2 hover:text-accent"
              >
                Contact
              </a>
              <span aria-hidden>&middot;</span>
              <a
                href="/subscribe"
                className="underline decoration-dotted underline-offset-2 hover:text-accent"
              >
                Subscribe
              </a>
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl w-full px-6 py-10 flex-1">
        {months.length > 0 && (
          <nav
            aria-label="Browse by month"
            className="flex flex-wrap gap-x-5 gap-y-2 items-baseline border-b border-rule pb-4 mb-4 text-sm"
          >
            <span className="text-[11px] uppercase tracking-widest text-muted">
              Browse:
            </span>
            {months.map((m) => {
              const active = m.key === validMonth;
              return (
                <a
                  key={m.key}
                  href={buildHref(m.key, validCat, defaultMonthKey)}
                  className={
                    active
                      ? "font-serif font-bold text-accent border-b-2 border-accent pb-0.5"
                      : "font-serif text-foreground/80 hover:text-accent"
                  }
                >
                  {formatMonthShort(m.key)}
                  <span
                    className={
                      "ml-1 text-[11px] " +
                      (active ? "text-accent/80" : "text-muted")
                    }
                  >
                    {m.count}
                  </span>
                </a>
              );
            })}
          </nav>
        )}

        <nav
          aria-label="Filter by category"
          className="flex flex-wrap gap-x-4 gap-y-2 items-baseline border-b border-rule pb-4 mb-8 text-sm"
        >
          <span className="text-[11px] uppercase tracking-widest text-muted">
            Filter:
          </span>
          <a
            href={buildHref(validMonth, null, defaultMonthKey)}
            className={
              !validCat
                ? "font-bold text-accent border-b-2 border-accent pb-0.5"
                : "text-foreground/80 hover:text-accent"
            }
          >
            All
            <span
              className={
                "ml-1 text-[11px] " +
                (!validCat ? "text-accent/80" : "text-muted")
              }
            >
              {monthEvents.length}
            </span>
          </a>
          {CATEGORIES.map((cat) => {
            const count = categoryCounts.get(cat) ?? 0;
            if (count === 0) return null;
            const active = validCat === cat;
            return (
              <a
                key={cat}
                href={buildHref(validMonth, cat, defaultMonthKey)}
                className={
                  active
                    ? "font-bold text-accent border-b-2 border-accent pb-0.5"
                    : "text-foreground/80 hover:text-accent"
                }
              >
                {cat}
                <span
                  className={
                    "ml-1 text-[11px] " +
                    (active ? "text-accent/80" : "text-muted")
                  }
                >
                  {count}
                </span>
              </a>
            );
          })}
        </nav>

        <section className="mb-10">
          <h2 className="font-serif text-3xl font-bold border-b border-foreground/40 pb-2 mb-2">
            {formatMonthLabel(validMonth)}
            {validCat && (
              <span className="text-muted font-normal text-2xl">
                {" "}
                &middot; {validCat}
              </span>
            )}
          </h2>
          <p className="text-muted text-sm italic mb-6">
            {filteredEvents.length}{" "}
            {validCat ? validCat.toLowerCase() : ""} events
            &middot; updated automatically every 6 hours.
          </p>
        </section>

        {grouped.length === 0 ? (
          <p className="text-muted italic">
            No events listed for this month yet. Check back soon.
          </p>
        ) : (
          <div className="space-y-12">
            {grouped.map(([dayKey, events]) => (
              <section key={dayKey}>
                <h3 className="font-serif text-2xl font-bold mb-4 flex items-baseline gap-3">
                  <span>{formatDayLabel(eventDate(events[0].startsAt))}</span>
                  <span className="flex-1 h-px bg-rule" />
                </h3>
                <ul className="space-y-6">
                  {events.map((ev) => (
                    <li
                      key={ev.id}
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
                        <p className="font-semibold mt-0.5">
                          {formatEventTime(ev)}
                        </p>
                        <p className="text-muted uppercase text-[11px] tracking-wider mt-1">
                          {ev.category}
                        </p>
                      </div>
                      <div className="md:order-2 order-3">
                        <h4 className="font-serif text-xl font-bold leading-snug">
                          <a
                            href={ev.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-accent"
                          >
                            {ev.title}
                          </a>
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
                        {(() => {
                          const { body, source } = splitSourceAttribution(
                            ev.description
                          );
                          return (
                            <>
                              <p className="mt-2 leading-relaxed">
                                {truncateWords(body, DESCRIPTION_WORD_LIMIT)}
                              </p>
                              {source && (
                                <p className="mt-1 text-xs italic text-muted">
                                  {source}
                                </p>
                              )}
                            </>
                          );
                        })()}
                        <p className="mt-2 text-xs">
                          <a
                            href={ev.sourceUrl}
                            className="underline decoration-dotted underline-offset-2 hover:text-accent"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Learn more &raquo;
                          </a>
                        </p>
                      </div>
                      {ev.imageUrl && (
                        <a
                          href={ev.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="md:order-3 order-2 block max-w-[12rem] md:max-w-none"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={ev.imageUrl}
                            alt={ev.title}
                            loading="lazy"
                            className="w-full aspect-[4/3] object-cover rounded-sm border border-rule"
                          />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
