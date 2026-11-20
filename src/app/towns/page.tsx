import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import PageHeader from "@/components/PageHeader";
import { JsonLd } from "@/components/EventCard";
import { addDays, dayKey } from "@/lib/event-format";
import { absUrl, pageMetadata } from "@/lib/seo";
import { fetchEventsBetweenDays } from "@/lib/supabase";
import { REGIONS, TOWNS } from "@/lib/towns";

export const revalidate = 3600;

export const metadata = pageMetadata({
  title: "Events by Town in San Luis Obispo County",
  description:
    "Find upcoming events town by town across San Luis Obispo County, from San Luis Obispo and Paso Robles to Morro Bay, Cambria, Pismo Beach and Arroyo Grande.",
  path: "/towns",
});

export default async function TownsIndex() {
  const today = dayKey(new Date());
  const events = await fetchEventsBetweenDays(today, addDays(today, 60));
  const counts = new Map<string, number>();
  for (const ev of events) counts.set(ev.community, (counts.get(ev.community) ?? 0) + 1);

  return (
    <div className="flex flex-col flex-1 w-full">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Towns in San Luis Obispo County",
          itemListElement: TOWNS.map((t, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: absUrl(`/towns/${t.slug}`),
            name: t.name,
          })),
        }}
      />
      <PageHeader title="Events by town" />

      <main className="mx-auto max-w-3xl w-full px-6 py-10 flex-1">
        <p className="text-lg leading-relaxed">
          San Luis Obispo County runs from the Santa Maria River north to the
          Monterey County line, with beach towns along Highway 1, wine country
          inland around Paso Robles, and the city of San Luis Obispo in the
          middle. Pick a town to see what is coming up there over the next two
          months.
        </p>

        {REGIONS.map((region) => (
          <section key={region} className="mt-10">
            <h2 className="font-serif text-2xl font-bold border-b border-foreground/40 pb-2 mb-4">
              {region}
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              {TOWNS.filter((t) => t.region === region).map((t) => (
                <li key={t.slug} className="flex items-baseline justify-between gap-3 border-b border-rule pb-2">
                  <Link href={`/towns/${t.slug}`} className="font-serif text-lg font-bold hover:text-accent">
                    {t.name}
                  </Link>
                  <span className="text-sm text-muted whitespace-nowrap">
                    {counts.get(t.name) ?? 0} upcoming
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      <SiteFooter />
    </div>
  );
}
