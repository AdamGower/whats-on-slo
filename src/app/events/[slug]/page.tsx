import Link from "next/link";
import { notFound } from "next/navigation";
import SiteFooter from "@/components/SiteFooter";
import { EventMiniList, JsonLd, TownName } from "@/components/EventCard";
import { townByName } from "@/lib/towns";
import {
  addDays,
  allDayLastDay,
  cleanDescription,
  dayKey,
  eventDate,
  formatEventTime,
  formatLongDate,
  formatShortDay,
  splitSourceAttribution,
  timeKind,
} from "@/lib/event-format";
import { breadcrumbJsonLd, eventJsonLd } from "@/lib/jsonld";
import { metaDescription, pageMetadata } from "@/lib/seo";
import { fetchEventBySlug, fetchEventsBetweenDays } from "@/lib/supabase";
import type { Event } from "@/types";

// Rebuilt in the background at most every 6 hours, the scrape cadence. The
// next 30 days are built ahead of time; any other event (further out, or
// past) is rendered on its first visit and then cached the same way.
export const revalidate = 21600;

const PREBUILD_DAYS = 30;

function todayPacific() {
  return dayKey(new Date());
}

export async function generateStaticParams() {
  const today = todayPacific();
  const events = await fetchEventsBetweenDays(today, addDays(today, PREBUILD_DAYS));
  return events.map((ev) => ({ slug: ev.slug }));
}

type Params = Promise<{ slug: string }>;

// The last Pacific day the event runs on.
function lastDay(ev: Event) {
  if (timeKind(ev) === "allday") return allDayLastDay(ev);
  if (ev.endsAt) return dayKey(eventDate(ev.endsAt));
  return dayKey(eventDate(ev.startsAt));
}

function shortDate(ev: Event) {
  return formatShortDay(dayKey(eventDate(ev.startsAt)));
}

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const ev = await fetchEventBySlug(slug);
  if (!ev) return { title: "Event not found" };
  const body = cleanDescription(splitSourceAttribution(ev.description).body);
  const when = formatLongDate(eventDate(ev.startsAt));
  const description = metaDescription(
    body
      ? `${when} at ${ev.venue}, ${ev.community}. ${body}`
      : `${ev.title}: ${when} at ${ev.venue}, ${ev.community}.`
  );
  return pageMetadata({
    title: `${ev.title}, ${shortDate(ev)} in ${ev.community}`,
    description,
    path: `/events/${ev.slug}`,
    image: ev.imageUrl,
    ogType: "article",
  });
}

// Up to six other events the same week (three days either side) that share
// the category or the town; events matching both come first.
async function relatedEvents(ev: Event): Promise<Event[]> {
  const day = dayKey(eventDate(ev.startsAt));
  const nearby = await fetchEventsBetweenDays(addDays(day, -3), addDays(day, 4));
  const score = (o: Event) =>
    (o.category === ev.category ? 1 : 0) + (o.community === ev.community ? 1 : 0);
  return nearby
    .filter((o) => o.slug !== ev.slug && score(o) > 0)
    .sort(
      (a, b) =>
        score(b) - score(a) ||
        Math.abs(Date.parse(a.startsAt) - Date.parse(ev.startsAt)) -
          Math.abs(Date.parse(b.startsAt) - Date.parse(ev.startsAt))
    )
    .slice(0, 6);
}

// For a past event: what's coming up next in the same town.
async function upcomingInTown(ev: Event): Promise<Event[]> {
  const today = todayPacific();
  const soon = await fetchEventsBetweenDays(today, addDays(today, 21));
  return soon.filter((o) => o.community === ev.community).slice(0, 6);
}

export default async function EventPage({ params }: { params: Params }) {
  const { slug } = await params;
  const ev = await fetchEventBySlug(slug);
  if (!ev) notFound();

  const isPast = lastDay(ev) < todayPacific();
  const [related, upcoming] = await Promise.all([
    relatedEvents(ev),
    isPast ? upcomingInTown(ev) : Promise.resolve([] as Event[]),
  ]);

  const { body, source } = splitSourceAttribution(ev.description);
  const paragraphs = cleanDescription(body)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${ev.venue}, ${ev.community}, CA`
  )}`;
  let sourceHost = ev.source;
  try {
    sourceHost = new URL(ev.sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    // keep the source name
  }

  return (
    <div className="flex flex-col flex-1 w-full">
      <JsonLd data={eventJsonLd(ev)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Events", path: "/" },
          ...(townByName(ev.community)
            ? [{ name: ev.community, path: `/towns/${townByName(ev.community)!.slug}` }]
            : []),
          { name: ev.title, path: `/events/${ev.slug}` },
        ])}
      />

      <main className="mx-auto max-w-3xl w-full px-6 py-10 flex-1">
        <nav aria-label="Breadcrumb" className="text-xs uppercase tracking-widest text-muted mb-6">
          <Link href="/" className="hover:text-accent">
            Events
          </Link>{" "}
          <span aria-hidden>&rsaquo;</span>{" "}
          <TownName name={ev.community} />
        </nav>

        {isPast && (
          <p
            role="status"
            className="mb-6 border border-rule bg-foreground/5 px-4 py-3 text-sm"
          >
            This event has passed.{" "}
            {lastDay(ev) !== dayKey(eventDate(ev.startsAt))
              ? `It ran from ${formatShortDay(dayKey(eventDate(ev.startsAt)))} to ${formatLongDate(new Date(`${lastDay(ev)}T19:00:00Z`))}.`
              : `It took place on ${formatLongDate(eventDate(ev.startsAt))}.`}{" "}
            <Link href="/" className="underline underline-offset-2 hover:text-accent">
              See what&rsquo;s on now
            </Link>
            .
          </p>
        )}

        <p className="text-[11px] uppercase tracking-[0.2em] text-muted">
          {ev.category}
        </p>
        <h1 className="font-serif text-4xl sm:text-5xl font-black tracking-tight leading-tight mt-2">
          {ev.title}
        </h1>

        <dl className="mt-6 grid grid-cols-[6rem_1fr] gap-y-2 text-base border-y border-rule py-4">
          <dt className="text-muted text-sm uppercase tracking-wider pt-0.5">Date</dt>
          <dd className="font-semibold">
            <time dateTime={dayKey(eventDate(ev.startsAt))}>
              {formatLongDate(eventDate(ev.startsAt))}
            </time>
          </dd>
          <dt className="text-muted text-sm uppercase tracking-wider pt-0.5">Time</dt>
          <dd>{formatEventTime(ev)}</dd>
          <dt className="text-muted text-sm uppercase tracking-wider pt-0.5">Where</dt>
          <dd>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-dotted underline-offset-2 hover:text-accent"
            >
              {ev.venue}
            </a>
            , <TownName name={ev.community} />
          </dd>
        </dl>

        {ev.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ev.imageUrl}
            alt={ev.title}
            className="mt-8 w-full max-h-[28rem] object-cover rounded-sm border border-rule"
          />
        )}

        <div className="mt-8 space-y-4 leading-relaxed text-lg">
          {paragraphs.length > 0 ? (
            paragraphs.map((p, i) => (
              <p key={i} className="whitespace-pre-line">
                {p}
              </p>
            ))
          ) : (
            <p className="text-muted italic">
              No description was published for this event. See the listing
              below for details.
            </p>
          )}
          {source && <p className="text-sm italic text-muted">{source}</p>}
        </div>

        <p className="mt-8">
          <a
            href={ev.sourceUrl}
            target="_blank"
            rel="noopener"
            className="inline-block border border-foreground px-5 py-2.5 text-sm uppercase tracking-widest hover:bg-foreground hover:text-background transition-colors"
          >
            Full details and tickets at {sourceHost} &raquo;
          </a>
        </p>
        <p className="mt-2 text-xs text-muted">
          Listed by {ev.source}. Details can change, so check with the
          organizer before you go.
        </p>

        {upcoming.length > 0 && (
          <section className="mt-12">
            <h2 className="font-serif text-2xl font-bold mb-4">
              Coming up in {ev.community}
            </h2>
            <EventMiniList events={upcoming} />
          </section>
        )}

        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="font-serif text-2xl font-bold mb-4">
              {isPast ? "Other events that week" : "More events this week"}
            </h2>
            <EventMiniList events={related} />
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
