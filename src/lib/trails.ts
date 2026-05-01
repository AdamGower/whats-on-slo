import trailsJson from "../../trails-data.json";
import type { Trail } from "@/types";

export const trails: Trail[] = trailsJson as Trail[];

export const DIFFICULTIES: Trail["difficulty"][] = [
  "Easy",
  "Moderate",
  "Hard",
  "Strenuous",
];

// Build a Google Maps "directions to here" URL from a trailhead's coordinates.
// Universal: opens Google Maps in browser, the Maps app on iOS/Android.
export function directionsUrl(t: Trail): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}`;
}

// Slugify a name for use as a stable React key / future detail-page route.
export function trailSlug(t: Trail): string {
  return t.name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
