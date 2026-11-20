import EventsView, { eventsTitle } from "@/components/EventsView";
import { pageMetadata } from "@/lib/seo";

// Internal route. Visitors never see /browse URLs: next.config.ts rewrites
// "/?month=YYYY-MM&cat=X" here so each filter combination is rendered once,
// cached, and rebuilt in the background at most hourly. "all" stands in for
// a filter that wasn't given.
export const revalidate = 3600;

// No paths at build time; each one is rendered on its first visit and then
// served from the cache (ISR).
export function generateStaticParams() {
  return [];
}

type Params = Promise<{ month: string; cat: string }>;

function readParams(month: string, cat: string) {
  return {
    month: month === "all" ? null : decodeURIComponent(month),
    cat: cat === "all" ? null : decodeURIComponent(cat),
  };
}

export async function generateMetadata({ params }: { params: Params }) {
  const p = await params;
  const { month, cat } = readParams(p.month, p.cat);
  const title = eventsTitle(month, cat);
  if (!title) return {};
  // Canonical is the public URL visitors and the sitemap use, not /browse.
  const qs = new URLSearchParams();
  if (month) qs.set("month", month);
  if (cat) qs.set("cat", cat);
  return pageMetadata({
    title: `${title} in San Luis Obispo County`,
    description: `${title} across San Luis Obispo and the Central Coast: dates, times, venues and links, updated every six hours.`,
    path: `/?${qs.toString()}`,
  });
}

export default async function Browse({ params }: { params: Params }) {
  const p = await params;
  const { month, cat } = readParams(p.month, p.cat);
  return <EventsView month={month} cat={cat} />;
}
