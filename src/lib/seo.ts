import type { Metadata } from "next";

export const SITE_URL = "https://whatsonslo.com";
export const SITE_NAME = "What's On SLO";

// Absolute URL for a site path ("/events/x" -> "https://whatsonslo.com/events/x").
export function absUrl(path: string) {
  return path.startsWith("http") ? path : `${SITE_URL}${path}`;
}

// Per-page metadata with a canonical URL and full Open Graph / Twitter tags.
// Next replaces (does not merge) a parent's openGraph object, so every page
// that sets its own title has to restate siteName, type and locale too; this
// helper keeps that in one place.
export function pageMetadata({
  title,
  description,
  path,
  image,
  ogType = "website",
  noindex = false,
}: {
  title: string;
  description: string;
  path: string;
  image?: string;
  ogType?: "website" | "article";
  noindex?: boolean;
}): Metadata {
  const url = absUrl(path);
  const images = image ? [{ url: image }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: ogType,
      siteName: SITE_NAME,
      locale: "en_US",
      title,
      description,
      url,
      images,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

// Plain-text meta description from free text: whitespace collapsed, cut at a
// word boundary under ~155 characters.
export function metaDescription(text: string, max = 155) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 80 ? cut.slice(0, space) : cut).replace(/[,;:.\s]+$/, "")}…`;
}

// Serialize JSON-LD for a <script> tag. "<" is escaped so text from a scraped
// description can never close the script element.
export function jsonLdString(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
