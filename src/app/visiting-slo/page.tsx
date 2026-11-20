import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import PageHeader from "@/components/PageHeader";
import { EventMiniList, JsonLd } from "@/components/EventCard";
import { itemListJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";
import { REGIONS, TOWNS } from "@/lib/towns";
import { fetchWeekendEvents, weekendLabel } from "@/lib/weekend";

// The weekend block rolls over on its own; the rest is static copy.
export const revalidate = 900;

export const metadata = pageMetadata({
  title: "Visiting San Luis Obispo: A Planning Guide",
  description:
    "Planning a trip to San Luis Obispo County: getting here, getting around, weather, where the towns are, hiking, and the events on this weekend.",
  path: "/visiting-slo",
});

// Editorial copy for out-of-town visitors. House style for this page: plain
// and factual, no promotional adjectives, no em or en dashes.
const REGION_NOTES: Record<string, string> = {
  "San Luis Obispo and Avila":
    "The city of San Luis Obispo sits in the middle of the county on Highway 101, with Avila Beach about ten minutes to the south. Most visitors start here.",
  "North Coast":
    "Morro Bay, Los Osos, Cayucos, Cambria and San Simeon line Highway 1 north of San Luis Obispo. Hearst Castle and the Big Sur coast are at the far end.",
  "North County":
    "Paso Robles, Atascadero, Templeton and the smaller towns around them are inland on Highway 101 and Highway 46, in the county's main wine region. Summers are hot here.",
  "South County":
    "Pismo Beach, Grover Beach, Oceano, Arroyo Grande and Nipomo are about fifteen minutes south of San Luis Obispo, with long sandy beaches and the Oceano Dunes.",
};

export default async function VisitingSloPage() {
  const { window, events } = await fetchWeekendEvents();
  const highlights = events.filter((ev) => ev.imageUrl).slice(0, 8);
  const shown = highlights.length >= 4 ? highlights : events.slice(0, 8);

  return (
    <div className="flex flex-col flex-1 w-full">
      <JsonLd data={itemListJsonLd(shown, `Events in San Luis Obispo County, ${weekendLabel(window)}`)} />
      <PageHeader kicker="A guide for visitors" title="Visiting San Luis Obispo" />

      <main className="mx-auto max-w-3xl w-full px-6 py-10 flex-1 leading-relaxed">
        <p className="text-lg">
          San Luis Obispo County is on the California coast, about halfway
          between Los Angeles and San Francisco. It covers beach towns, a
          college city, a large wine region and a lot of open space with public
          trails. This page covers the basics for planning a visit and lists
          what is on this weekend.
        </p>

        <section className="mt-12">
          <h2 className="font-serif text-3xl font-bold border-b border-foreground/40 pb-2 mb-2">
            This weekend
          </h2>
          <p className="text-muted text-sm italic mb-6">
            {weekendLabel(window)} &middot; {events.length} events listed
          </p>
          {shown.length > 0 ? (
            <EventMiniList events={shown} />
          ) : (
            <p className="text-muted italic">Nothing is listed for this weekend yet.</p>
          )}
          <p className="mt-4">
            <Link href="/this-weekend" className="underline underline-offset-2 hover:text-accent">
              See all {events.length} events this weekend &raquo;
            </Link>
          </p>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="font-serif text-3xl font-bold border-b border-foreground/40 pb-2 mb-4">
            Getting here
          </h2>
          <p>
            <strong>By car.</strong> Highway 101 runs through the county from
            north to south. San Luis Obispo is about three hours from San Jose
            and about three and a half to four hours from both Los Angeles and
            San Francisco, depending on traffic. Highway 1 joins the coast at
            Morro Bay and continues north through Cambria to Big Sur. Sections of
            Highway 1 in Big Sur close from time to time after landslides, so
            check Caltrans road conditions before driving it.
          </p>
          <p>
            <strong>By train.</strong> Amtrak&rsquo;s Coast Starlight, which runs
            between Los Angeles and Seattle, stops in San Luis Obispo. The Pacific
            Surfliner from San Diego and Los Angeles ends in San Luis Obispo and
            also stops in Grover Beach.
          </p>
          <p>
            <strong>By air.</strong> San Luis Obispo County Regional Airport
            (SBP) is on the south edge of the city and has nonstop flights to a
            number of western hubs. Santa Barbara and San Jose airports are the
            next closest options.
          </p>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="font-serif text-3xl font-bold border-b border-foreground/40 pb-2 mb-4">
            Getting around
          </h2>
          <p>
            A car is the simplest way to see more than one town. Downtown San
            Luis Obispo is easy to cover on foot, and SLO Transit runs city
            buses. The Regional Transit Authority (RTA) runs buses between the
            larger towns, including Paso Robles, Morro Bay, Pismo Beach and
            Arroyo Grande. Parking downtown is mostly in public garages and
            metered spaces.
          </p>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="font-serif text-3xl font-bold border-b border-foreground/40 pb-2 mb-4">
            Weather
          </h2>
          <p>
            The coast stays mild all year. Summer mornings are often foggy at the
            beaches, with the fog clearing by midday on many days. Inland, Paso
            Robles and the North County are much hotter in summer and colder on
            winter nights. Most rain falls between November and April. Bring
            layers: it is common to need a jacket at the beach in the evening
            after a warm afternoon inland.
          </p>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="font-serif text-3xl font-bold border-b border-foreground/40 pb-2 mb-4">
            Things worth planning around
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              The downtown San Luis Obispo farmers market runs on Higuera Street
              every Thursday evening, with produce, food stalls and live music.
            </li>
            <li>
              Western monarch butterflies gather at the Pismo State Beach
              Monarch Butterfly Grove from roughly November through February.
            </li>
            <li>
              Hearst Castle tours are booked by time slot and often sell out on
              weekends and holidays, so reserve ahead.
            </li>
            <li>
              Cal Poly graduation in June and large events such as the California
              Mid-State Fair in Paso Robles each summer fill hotels across the
              county. Check the calendar before you book.
            </li>
          </ul>
        </section>

        <section className="mt-12 space-y-4">
          <h2 className="font-serif text-3xl font-bold border-b border-foreground/40 pb-2 mb-4">
            Hiking
          </h2>
          <p>
            Public trails start within minutes of most towns. Bishop Peak and
            Cerro San Luis rise on the edge of San Luis Obispo, Montaña de Oro
            State Park has coastal bluff trails near Los Osos, and the Irish Hills
            and Johnson Ranch open spaces sit on the south side of the city. Our
            hiking guide lists 54 trails within about 25 miles of San Luis
            Obispo, with distance, elevation gain, parking and whether dogs are
            allowed.
          </p>
          <p className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/hiking" className="underline underline-offset-2 hover:text-accent">
              All trails
            </Link>
            <Link href="/hiking?difficulty=Easy" className="underline underline-offset-2 hover:text-accent">
              Easy trails
            </Link>
            <Link href="/hiking?dogs=yes" className="underline underline-offset-2 hover:text-accent">
              Dog-friendly trails
            </Link>
            <Link href="/hiking?view=map" className="underline underline-offset-2 hover:text-accent">
              Trail map
            </Link>
          </p>
        </section>

        <section className="mt-12">
          <h2 className="font-serif text-3xl font-bold border-b border-foreground/40 pb-2 mb-4">
            The towns
          </h2>
          <div className="space-y-6">
            {REGIONS.map((region) => (
              <div key={region}>
                <h3 className="font-serif text-xl font-bold">{region}</h3>
                <p className="mt-1">{REGION_NOTES[region]}</p>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {TOWNS.filter((t) => t.region === region).map((t) => (
                    <Link
                      key={t.slug}
                      href={`/towns/${t.slug}`}
                      className="underline decoration-dotted underline-offset-2 hover:text-accent"
                    >
                      {t.name}
                    </Link>
                  ))}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
