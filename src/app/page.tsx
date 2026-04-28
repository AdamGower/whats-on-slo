import { fetchUpcomingEvents } from "@/lib/supabase";
import type { Event } from "@/types";

export const revalidate = 60;

function eventDate(iso: string) {
  return new Date(iso);
}

function formatDayLabel(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTimeRange(start: Date, end?: Date) {
  const s = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: start.getMinutes() === 0 ? undefined : "2-digit",
  });
  if (!end) return s;
  if (end.toDateString() !== start.toDateString()) {
    return `${s} → ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  const e = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: end.getMinutes() === 0 ? undefined : "2-digit",
  });
  return `${s} – ${e}`;
}

function groupByDay(events: Event[]) {
  const map = new Map<string, Event[]>();
  for (const ev of events) {
    const key = eventDate(ev.startsAt).toDateString();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return Array.from(map.entries()).sort(
    ([a], [b]) => new Date(a).getTime() - new Date(b).getTime()
  );
}

export default async function Home() {
  const events = await fetchUpcomingEvents();
  const grouped = groupByDay(events);

  const today = new Date();
  const longDate = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
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
        <section className="mb-10">
          <h2 className="font-serif text-3xl font-bold border-b border-foreground/40 pb-2 mb-2">
            On Today
          </h2>
          <p className="text-muted text-sm italic mb-6">
            Live from the database. Sources update on a schedule.
          </p>
        </section>

        {grouped.length === 0 ? (
          <p className="text-muted italic">
            No upcoming events. Check back soon.
          </p>
        ) : (
          <div className="space-y-12">
            {grouped.map(([dayKey, events]) => (
              <section key={dayKey}>
                <h3 className="font-serif text-2xl font-bold mb-4 flex items-baseline gap-3">
                  <span>{formatDayLabel(new Date(dayKey))}</span>
                  <span className="flex-1 h-px bg-rule" />
                </h3>
                <ul className="space-y-6">
                  {events.map((ev) => (
                    <li
                      key={ev.id}
                      className="grid grid-cols-1 md:grid-cols-[10rem_1fr] gap-x-6 gap-y-1"
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
                      <div>
                        <h4 className="font-serif text-xl font-bold leading-snug">
                          {ev.title}
                        </h4>
                        <p className="text-sm text-muted mt-0.5">
                          {ev.venue} &middot; {ev.community}
                        </p>
                        <p className="mt-2 leading-relaxed">{ev.description}</p>
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
          <span>
            Aggregating 40+ Central Coast event sources. Live data and filters
            coming soon.
          </span>
        </div>
      </footer>
    </div>
  );
}
