import { fetchUpcomingEvents } from "@/lib/supabase";
import type { MetadataRoute } from "next";

const BASE = "https://whats-on-slo.vercel.app";
const TIMEZONE = "America/Los_Angeles";

function monthKey(d: Date) {
  const dateStr = d.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
  return dateStr.slice(0, 7); // YYYY-MM
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const events = await fetchUpcomingEvents();

  const monthSet = new Set<string>();
  for (const ev of events) {
    monthSet.add(monthKey(new Date(ev.startsAt)));
  }

  const months = Array.from(monthSet).sort();
  const now = new Date();

  return [
    {
      url: BASE,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1.0,
    },
    ...months.map((m) => ({
      url: `${BASE}/?month=${m}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
