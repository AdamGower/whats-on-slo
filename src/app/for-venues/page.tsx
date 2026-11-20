import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import PageHeader from "@/components/PageHeader";
import { addDays, dayKey } from "@/lib/event-format";
import { pageMetadata } from "@/lib/seo";
import { GENERIC_VENUE, venueSlug } from "@/lib/slug";
import { fetchEventsBetweenDays } from "@/lib/supabase";
import { BadgeSnippets, WidgetSnippets } from "./SnippetBuilder";

// The venue list follows the calendar, so rebuild it in the background daily.
export const revalidate = 86400;

export const metadata = pageMetadata({
  title: "For Venues: Badge and Events Widget",
  description:
    "Free tools for venues listed on What's On SLO: a \"Listed on What's On SLO\" badge and an embeddable widget that shows your upcoming events on your own website.",
  path: "/for-venues",
});

export default async function ForVenuesPage() {
  const today = dayKey(new Date());
  const events = await fetchEventsBetweenDays(today, addDays(today, 90));
  const bySlug = new Map<string, { name: string; slug: string; count: number; community: string }>();
  for (const ev of events) {
    if (GENERIC_VENUE.test(ev.venue.trim())) continue;
    const slug = venueSlug(ev.venue);
    if (!slug) continue;
    const v = bySlug.get(slug);
    if (v) v.count++;
    else bySlug.set(slug, { name: ev.venue, slug, count: 1, community: ev.community });
  }
  const venues = [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col flex-1 w-full">
      <PageHeader kicker="Free tools for venues and organizers" title="For venues" />

      <main className="mx-auto max-w-3xl w-full px-6 py-10 flex-1 leading-relaxed">
        <p className="text-lg">
          What&rsquo;s On SLO lists events from venues across San Luis Obispo
          County, collected every six hours from public calendars. If your venue
          is listed, you can use the two tools below on your own website. Both are
          free, and both stay up to date on their own.
        </p>

        <section className="mt-12">
          <h2 className="font-serif text-3xl font-bold border-b border-foreground/40 pb-2 mb-4">
            1. The &ldquo;Listed on What&rsquo;s On SLO&rdquo; badge
          </h2>
          <p className="mb-6">
            A small image that links back to What&rsquo;s On SLO. Pick a version
            and paste the code into your site&rsquo;s HTML, for example in the
            footer or on your events page.
          </p>
          <BadgeSnippets />
        </section>

        <section className="mt-14">
          <h2 className="font-serif text-3xl font-bold border-b border-foreground/40 pb-2 mb-4">
            2. Your upcoming events widget
          </h2>
          <p className="mb-6">
            A small box that lists your next events as they appear on What&rsquo;s
            On SLO, updated hourly. Choose your venue, copy the code and paste it
            where you want the list to appear. The widget lists up to twelve
            events in the next 90 days.
          </p>
          {venues.length > 0 ? (
            <WidgetSnippets venues={venues} />
          ) : (
            <p className="text-muted italic">No venues have upcoming events right now.</p>
          )}
        </section>

        <section className="mt-14">
          <h2 className="font-serif text-2xl font-bold mb-3">
            Not listed, or listed wrong?
          </h2>
          <p>
            If your venue isn&rsquo;t in the list, or your events are missing,{" "}
            <Link href="/submit" className="underline underline-offset-2 hover:text-accent">
              submit an event
            </Link>{" "}
            or{" "}
            <Link href="/comments" className="underline underline-offset-2 hover:text-accent">
              get in touch
            </Link>{" "}
            and tell us where your calendar is published.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
