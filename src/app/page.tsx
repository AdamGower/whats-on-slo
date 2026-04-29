import { fetchUpcomingEvents } from "@/lib/supabase";
import type { Event } from "@/types";

export const revalidate = 60;

const TIMEZONE = "America/Los_Angeles";
const DESCRIPTION_WORD_LIMIT = 50;

function eventDate(iso: string) {
  return new Date(iso);
}

function dayKey(d: Date) {
  return d.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

// "2026-04" — Pacific calendar month of a Date
function monthKey(d: Date) {
  return dayKey(d).slice(0, 7);
}

function formatMonthLabel(monthKey: string) {
  // Construct a date at noon Pacific on the first of that month for safe formatting
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1, 19, 0, 0));
  return d.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: TIMEZONE,
  });
}

function formatMonthShort(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1, 19, 0, 0));
  const month = d.toLocaleDateString("en-US", {
    month: "short",
    timeZone: TIMEZONE,
  });
  const yr = String(y).slice(-2);
  return `${month} ’${yr}`;
}

function formatDayLabel(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: TIMEZONE,
  });
}

function formatTime(d: Date) {
  return d
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: TIMEZONE,
    })
    .replace(":00 ", " ");
}

function formatTimeRange(start: Date, end?: Date) {
  const s = formatTime(start);
  if (!end) return s;
  if (dayKey(end) !== dayKey(start)) {
    return `${s} → ${end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: TIMEZONE,
    })}`;
  }
  return `${s} – ${formatTime(end)}`;
}

// Library staff write bilingual English-then-Spanish descriptions joined into
// one paragraph. Cut at the first ¡ or ¿ — those characters are unique to
// Spanish and never appear in English, so this is a safe, deterministic
// language boundary.
function stripBilingualSpanish(text: string) {
  if (!text) return text;
  const idx = text.search(/[¡¿]/);
  return idx === -1 ? text : text.slice(0, idx).trim();
}

// HTML stripping in scrapers can leave sentences smashed together when
// paragraph tags are removed: "End.Next sentence" or "(format)Next". Insert
// a space between sentence-ending punctuation and the next capitalized word.
function fixPunctuationSpacing(text: string) {
  if (!text) return text;
  return text.replace(/([.!?)])([A-Z])/g, "$1 $2");
}

// Truncate at a word boundary near maxWords. Adds an ellipsis when truncated.
function truncateWords(text: string, maxWords: number) {
  if (!text) return "";
  const cleaned = fixPunctuationSpacing(stripBilingualSpanish(text)).trim();
  const words = cleaned.split(/\s+/);
  if (words.length <= maxWords) return cleaned;
  // Try to break on the nearest sentence-ending punctuation in the last few
  // words of the cap so we don't dangle mid-clause.
  const slice = words.slice(0, maxWords);
  for (let i = slice.length - 1; i >= Math.max(0, slice.length - 8); i--) {
    if (/[.!?]$/.test(slice[i])) return slice.slice(0, i + 1).join(" ");
  }
  return slice.join(" ") + "…";
}

function groupByDay(events: Event[]) {
  const map = new Map<string, Event[]>();
  for (const ev of events) {
    const key = dayKey(eventDate(ev.startsAt));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

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

const CATEGORIES: Event["category"][] = [
  "Music",
  "Food & Drink",
  "Arts",
  "Community",
  "Family",
  "Outdoors",
];

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

type SearchParams = Promise<{ month?: string; cat?: string }>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const monthLabel = params.month ? formatMonthLabel(params.month) : null;
  const cat = params.cat;

  const title =
    monthLabel && cat
      ? `${cat} events in ${monthLabel}`
      : monthLabel
      ? `Events in ${monthLabel}`
      : cat
      ? `${cat} events`
      : null;

  return {
    title,
    openGraph: { title: title ?? undefined },
    twitter: { title: title ?? undefined },
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const events = await fetchUpcomingEvents();
  const months = buildMonthIndex(events);

  // Default to the first month with events (the current/upcoming one).
  const requestedMonth = params.month;
  const validMonth =
    requestedMonth && months.some((m) => m.key === requestedMonth)
      ? requestedMonth
      : months[0]?.key ?? monthKey(new Date());

  const monthEvents = events.filter(
    (ev) => monthKey(eventDate(ev.startsAt)) === validMonth
  );

  // Category filter — applied within the selected month
  const requestedCat = params.cat;
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
            <span>San Luis Obispo &middot; The Central Coast</span>
            <span>{longDate}</span>
            <span>Vol. 1 &middot; No. 1</span>
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
                        <p className="font-semibold">
                          {formatTimeRange(
                            eventDate(ev.startsAt),
                            ev.endsAt ? eventDate(ev.endsAt) : undefined
                          )}
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
                          {ev.venue} &middot; {ev.community}
                        </p>
                        <p className="mt-2 leading-relaxed">
                          {truncateWords(ev.description, DESCRIPTION_WORD_LIMIT)}
                        </p>
                        <p className="mt-2 text-xs text-muted">
                          Source:{" "}
                          <a
                            href={ev.sourceUrl}
                            className="underline decoration-dotted underline-offset-2 hover:text-accent"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {ev.source}
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

      <footer className="border-t border-rule mt-10 px-6 py-6">
        <div className="mx-auto max-w-5xl text-xs text-muted flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>What&rsquo;s On SLO &middot; A preview edition</span>
          <span className="flex items-center gap-4">
            <a
              href="/submit"
              className="underline decoration-dotted underline-offset-2 hover:text-accent"
            >
              Submit your event
            </a>
            <span>Aggregating 40+ Central Coast event sources.</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
