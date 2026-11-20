import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import PageHeader from "@/components/PageHeader";
import { EventDayList, JsonLd } from "@/components/EventCard";
import { addDays, dayKey } from "@/lib/event-format";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";
import { fetchEventsBetweenDays } from "@/lib/supabase";
import { TOWNS, townBySlug } from "@/lib/towns";

// Upcoming events shift daily, so rebuild in the background at most hourly.
export const revalidate = 3600;
// Only the towns we have written pages for; anything else is a 404.
export const dynamicParams = false;

const WINDOW_DAYS = 60;

export function generateStaticParams() {
  return TOWNS.map((t) => ({ town: t.slug }));
}

type Params = Promise<{ town: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { town: slug } = await params;
  const town = townBySlug(slug);
  if (!town) return {};
  return pageMetadata({
    title: `${town.name} Events: Things to Do in ${town.name}`,
    description: `Upcoming events in ${town.name}, CA: live music, markets, festivals, family activities and more, updated every six hours.`,
    path: `/towns/${town.slug}`,
  });
}

export default async function TownPage({ params }: { params: Params }) {
  const { town: slug } = await params;
  const town = townBySlug(slug);
  if (!town) notFound();

  const today = dayKey(new Date());
  const all = await fetchEventsBetweenDays(today, addDays(today, WINDOW_DAYS));
  const events = all.filter((ev) => ev.community === town.name);
  const neighbors = TOWNS.filter((t) => t.region === town.region && t.slug !== town.slug);

  return (
    <div className="flex flex-col flex-1 w-full">
      <JsonLd data={itemListJsonLd(events, `Upcoming events in ${town.name}`)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Towns", path: "/towns" },
          { name: town.name, path: `/towns/${town.slug}` },
        ])}
      />
      <PageHeader kicker={`${town.region} · San Luis Obispo County`} title={`Things to do in ${town.name}`} width="max-w-5xl" />

      <main className="mx-auto max-w-5xl w-full px-6 py-10 flex-1">
        <nav aria-label="Breadcrumb" className="text-xs uppercase tracking-widest text-muted mb-6">
          <Link href="/towns" className="hover:text-accent">
            Towns
          </Link>{" "}
          <span aria-hidden>&rsaquo;</span> <span>{town.name}</span>
        </nav>

        <p className="text-lg leading-relaxed max-w-3xl">{town.intro}</p>

        <h2 className="font-serif text-3xl font-bold border-b border-foreground/40 pb-2 mt-12 mb-2">
          Upcoming events in {town.name}
        </h2>
        <p className="text-muted text-sm italic mb-8">
          {events.length} {events.length === 1 ? "event" : "events"} in the next{" "}
          {WINDOW_DAYS} days &middot; updated automatically every 6 hours.
        </p>
        <EventDayList
          events={events}
          emptyText={`Nothing is listed in ${town.name} in the next ${WINDOW_DAYS} days. Try a nearby town below, or this weekend's events across the county.`}
        />

        <section className="mt-14 border-t border-rule pt-6">
          <h2 className="font-serif text-2xl font-bold mb-3">Nearby towns</h2>
          <p className="flex flex-wrap gap-x-5 gap-y-2">
            {neighbors.map((t) => (
              <Link
                key={t.slug}
                href={`/towns/${t.slug}`}
                className="underline decoration-dotted underline-offset-2 hover:text-accent"
              >
                {t.name}
              </Link>
            ))}
            <Link href="/towns" className="text-muted hover:text-accent">
              All towns &raquo;
            </Link>
          </p>
          <p className="mt-4 text-sm">
            <Link href="/this-weekend" className="underline underline-offset-2 hover:text-accent">
              Things to do in San Luis Obispo County this weekend
            </Link>
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
