import EventsView, { eventsTitle } from "@/components/EventsView";

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
  return {
    title,
    openGraph: { title: title ?? undefined },
    twitter: { title: title ?? undefined },
  };
}

export default async function Browse({ params }: { params: Params }) {
  const p = await params;
  const { month, cat } = readParams(p.month, p.cat);
  return <EventsView month={month} cat={cat} />;
}
