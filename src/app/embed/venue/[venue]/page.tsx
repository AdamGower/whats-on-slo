import { addDays, dayKey, eventDate, formatCompactDate, formatEventTime } from "@/lib/event-format";
import { SITE_URL } from "@/lib/seo";
import { venueSlug } from "@/lib/slug";
import { fetchEventsBetweenDays } from "@/lib/supabase";

// The venue widget other sites put in an iframe. Cached and rebuilt in the
// background at most hourly; venues are rendered on first request, so any
// venue string in the data works without a redeploy.
export const revalidate = 3600;

const WINDOW_DAYS = 90;
const MAX_EVENTS = 12;

export function generateStaticParams() {
  return [];
}

type Params = Promise<{ venue: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { venue } = await params;
  return {
    title: `Upcoming events: ${venue}`,
    // The widget duplicates our own event pages; keep it out of search.
    robots: { index: false, follow: true },
  };
}

export default async function VenueEmbed({ params }: { params: Params }) {
  const { venue: slug } = await params;
  const today = dayKey(new Date());
  const all = await fetchEventsBetweenDays(today, addDays(today, WINDOW_DAYS));
  const events = all.filter((ev) => venueSlug(ev.venue) === slug).slice(0, MAX_EVENTS);
  const venueName = events[0]?.venue;
  const utm = "utm_source=venue-widget&utm_medium=embed";

  return (
    <div className="px-4 py-3 text-[15px] leading-snug">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted">
        Upcoming{venueName ? ` at ${venueName}` : ""}
      </p>
      {events.length === 0 ? (
        <p className="mt-3 text-muted italic">
          No upcoming events are listed right now.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-rule">
          {events.map((ev) => (
            <li key={ev.id} className="py-2.5">
              <a
                href={`${SITE_URL}/events/${ev.slug}?${utm}`}
                target="_blank"
                rel="noopener"
                className="font-serif font-bold hover:text-accent"
              >
                {ev.title}
              </a>
              <p className="text-xs text-muted mt-0.5">
                {formatCompactDate(eventDate(ev.startsAt))} &middot; {formatEventTime(ev)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 border-t border-rule pt-2 text-[11px] text-muted">
        Listed on{" "}
        <a
          href={`${SITE_URL}/?${utm}`}
          target="_blank"
          rel="noopener"
          className="font-serif font-bold text-foreground hover:text-accent"
        >
          What&rsquo;s On SLO
        </a>
      </p>
    </div>
  );
}
