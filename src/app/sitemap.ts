import { fetchAllEventMonths, fetchAllEvents } from "@/lib/supabase";
import { dayKey, eventDate } from "@/lib/event-format";
import { SITE_URL as BASE } from "@/lib/seo";
import { TOWNS } from "@/lib/towns";
import type { MetadataRoute } from "next";

// Rebuilt in the background at most every 6 hours, the scrape cadence, so new
// event pages reach the sitemap without a redeploy.
export const revalidate = 21600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Every month that has events, past and future — so search engines can reach
  // archived months the default homepage view hides.
  const [months, events] = await Promise.all([
    fetchAllEventMonths(),
    fetchAllEvents(),
  ]);
  const now = new Date();
  const today = dayKey(now);

  return [
    {
      url: BASE,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1.0,
    },
    {
      url: `${BASE}/this-weekend`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.9,
    },
    {
      url: `${BASE}/visiting-slo`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    {
      url: `${BASE}/towns`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    },
    ...TOWNS.map((t) => ({
      url: `${BASE}/towns/${t.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    {
      url: `${BASE}/for-venues`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    },
    {
      url: `${BASE}/hiking`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${BASE}/about`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.5,
    },
    {
      url: `${BASE}/subscribe`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.4,
    },
    {
      url: `${BASE}/submit`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    },
    {
      url: `${BASE}/comments`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    },
    ...months.map((m) => ({
      url: `${BASE}/?month=${m}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    // Every event page, past included. Upcoming events rank above past ones.
    ...events.map((ev) => {
      const upcoming = dayKey(eventDate(ev.startsAt)) >= today;
      return {
        url: `${BASE}/events/${ev.slug}`,
        changeFrequency: upcoming ? ("daily" as const) : ("yearly" as const),
        priority: upcoming ? 0.7 : 0.3,
      };
    }),
  ];
}
