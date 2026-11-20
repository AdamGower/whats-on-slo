// URL slugs for event, town and venue pages.

const MAX_TITLE_SLUG = 70;

// "Cuesta Drama: Spring Awakening!" -> "cuesta-drama-spring-awakening".
// Accents fold to ASCII ("Montaña" -> "montana"); anything else that is not a
// letter or digit becomes a hyphen. Long titles are cut at a hyphen so a slug
// never ends mid-word.
export function slugify(text: string, max = MAX_TITLE_SLUG): string {
  const s = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastHyphen = cut.lastIndexOf("-");
  return (lastHyphen > 20 ? cut.slice(0, lastHyphen) : cut).replace(/-+$/g, "");
}

// Every event slug ends in its Pacific date, so the page can find the event by
// fetching just that one day.
const DATE_SUFFIX = /-(\d{4}-\d{2}-\d{2})$/;

export function slugDate(slug: string): string | null {
  return DATE_SUFFIX.exec(slug)?.[1] ?? null;
}

export function baseEventSlug(title: string, pacificDay: string): string {
  return `${slugify(title) || "event"}-${pacificDay}`;
}

// Venue strings that name no single place, so they get no venue widget.
export const GENERIC_VENUE = /^(offsite|online|tba|tbd|various( locations)?|virtually anywhere|\d+ (library branches|venues))$/i;

export function venueSlug(venue: string): string {
  return slugify(venue, 60);
}
