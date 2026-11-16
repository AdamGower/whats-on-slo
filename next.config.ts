import type { NextConfig } from "next";

// "/?month=YYYY-MM&cat=X" is the public URL for a filtered view (linked from
// the page and listed in the sitemap). A page that reads searchParams renders
// on every request, so instead these rewrites map the query onto a cached
// path route. Rules are mutually exclusive via `missing`.
const MONTH = "^(?<month>\\d{4}-\\d{2})$";
// Known categories only, so junk values fall through to the cached default
// page instead of each creating a new cache entry. Keep in sync with
// CATEGORIES in src/components/EventsView.tsx.
const CAT = "^(?<cat>Music|Food & Drink|Arts|Community|Family|Outdoors)$";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          has: [
            { type: "query", key: "month", value: MONTH },
            { type: "query", key: "cat", value: CAT },
          ],
          destination: "/browse/:month/:cat",
        },
        {
          source: "/",
          has: [{ type: "query", key: "month", value: MONTH }],
          missing: [{ type: "query", key: "cat" }],
          destination: "/browse/:month/all",
        },
        {
          source: "/",
          has: [{ type: "query", key: "cat", value: CAT }],
          missing: [{ type: "query", key: "month" }],
          destination: "/browse/all/:cat",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
