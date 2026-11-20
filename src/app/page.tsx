import EventsView from "@/components/EventsView";
import { JsonLd } from "@/components/EventCard";
import { websiteJsonLd } from "@/lib/jsonld";
import { pageMetadata } from "@/lib/seo";

// Served from the cache and rebuilt in the background at most every 10
// minutes. The page used to read searchParams, which made every request a
// fresh render and exhausted the Vercel Hobby CPU allowance. Filtered views
// ("/?month=&cat=") are rewritten to /browse/[month]/[cat] in next.config.ts.
export const revalidate = 600;

const HOME_DESCRIPTION =
  "A daily guide to live music, food, festivals, and community events across San Luis Obispo and the Central Coast: Paso Robles, Morro Bay, Avila Beach, Pismo Beach, Cambria, Atascadero, and beyond.";

export const metadata = {
  ...pageMetadata({
    title: "San Luis Obispo Events Calendar",
    description: HOME_DESCRIPTION,
    path: "/",
  }),
  title: { absolute: "San Luis Obispo Events Calendar | What's On SLO" },
};

export default function Home() {
  return (
    <>
      <JsonLd data={websiteJsonLd} />
      <EventsView month={null} cat={null} />
    </>
  );
}
