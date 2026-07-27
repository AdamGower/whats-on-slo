import { fetchAllEventMonths } from "@/lib/supabase";
import type { MetadataRoute } from "next";

const BASE = "https://whatsonslo.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Every month that has events, past and future — so search engines can reach
  // archived months the default homepage view hides.
  const months = await fetchAllEventMonths();
  const now = new Date();

  return [
    {
      url: BASE,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1.0,
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
  ];
}
