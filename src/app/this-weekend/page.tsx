import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import PageHeader from "@/components/PageHeader";
import { EventDayList, JsonLd, TownName } from "@/components/EventCard";
import { itemListJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";
import { fetchWeekendEvents, weekendLabel, weekendWindow } from "@/lib/weekend";
import { CATEGORIES } from "@/lib/event-format";

// The window rolls over on its own (Friday to Sunday, Pacific), so the page is
// rebuilt in the background at most every 15 minutes: soon enough that Monday
// morning shows the next weekend, cheap because it is one page.
export const revalidate = 900;

const TITLE = "Things to Do in San Luis Obispo This Weekend";

export async function generateMetadata() {
  const w = weekendWindow();
  return pageMetadata({
    title: TITLE,
    description: `Events, live music, markets and family activities in San Luis Obispo and across SLO County, ${weekendLabel(w)}. Updated every few hours.`,
    path: "/this-weekend",
  });
}

export default async function ThisWeekendPage() {
  const { window, events } = await fetchWeekendEvents();
  const counts = new Map<string, number>();
  for (const ev of events) counts.set(ev.category, (counts.get(ev.category) ?? 0) + 1);
  const towns = new Map<string, number>();
  for (const ev of events) towns.set(ev.community, (towns.get(ev.community) ?? 0) + 1);
  const topTowns = [...towns.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="flex flex-col flex-1 w-full">
      <JsonLd data={itemListJsonLd(events, `Events in San Luis Obispo County, ${weekendLabel(window)}`)} />
      <PageHeader title="Things to do in San Luis Obispo this weekend" width="max-w-5xl">
        <p className="mt-4 text-center text-sm uppercase tracking-widest text-muted">
          {weekendLabel(window)}
        </p>
      </PageHeader>

      <main className="mx-auto max-w-5xl w-full px-6 py-10 flex-1">
        <p className="text-lg leading-relaxed max-w-3xl">
          {events.length > 0
            ? `${events.length} events are listed across San Luis Obispo County this weekend, from live music and theater to farmers markets, hikes and family activities.`
            : "Nothing is listed for this weekend yet. New events are added every six hours."}{" "}
          The list updates on its own and moves to the next weekend each Monday.
        </p>

        {events.length > 0 && (
          <div className="mt-6 flex flex-col gap-3 border-y border-rule py-4 text-sm">
            <p>
              <span className="text-[11px] uppercase tracking-widest text-muted mr-3">
                By type
              </span>
              {CATEGORIES.filter((c) => counts.get(c)).map((c, i) => (
                <span key={c}>
                  {i > 0 && <span aria-hidden className="text-muted"> &middot; </span>}
                  {c} <span className="text-muted text-[11px]">{counts.get(c)}</span>
                </span>
              ))}
            </p>
            <p>
              <span className="text-[11px] uppercase tracking-widest text-muted mr-3">
                Busiest towns
              </span>
              {topTowns.map(([t, n], i) => (
                <span key={t}>
                  {i > 0 && <span aria-hidden className="text-muted"> &middot; </span>}
                  <TownName name={t} /> <span className="text-muted text-[11px]">{n}</span>
                </span>
              ))}
            </p>
          </div>
        )}

        <div className="mt-10">
          <EventDayList
            events={events}
            emptyText="No events listed for this weekend yet. Check back soon."
          />
        </div>

        <p className="mt-12 text-sm text-muted">
          Planning further ahead? See the{" "}
          <Link href="/" className="underline underline-offset-2 hover:text-accent">
            full events calendar
          </Link>
          .
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
