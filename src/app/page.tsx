import EventsView from "@/components/EventsView";

// Served from the cache and rebuilt in the background at most every 10
// minutes. The page used to read searchParams, which made every request a
// fresh render and exhausted the Vercel Hobby CPU allowance. Filtered views
// ("/?month=&cat=") are rewritten to /browse/[month]/[cat] in next.config.ts.
export const revalidate = 600;

export default function Home() {
  return <EventsView month={null} cat={null} />;
}
