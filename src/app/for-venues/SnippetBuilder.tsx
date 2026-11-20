"use client";

import { useState } from "react";

const SITE = "https://whatsonslo.com";

type Venue = { name: string; slug: string; count: number; community: string };

function CopyBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre
        aria-label={label}
        className="overflow-x-auto whitespace-pre-wrap break-all border border-rule bg-foreground/5 p-4 pr-20 text-[13px] leading-relaxed font-mono"
      >
        {code}
      </pre>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard blocked: the code is still selectable by hand.
          }
        }}
        className="absolute top-2 right-2 border border-foreground bg-background px-3 py-1 text-[11px] uppercase tracking-widest hover:bg-foreground hover:text-background"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function BadgeSnippets() {
  const [variant, setVariant] = useState<"dark" | "light">("dark");
  const file =
    variant === "dark" ? "listed-on-whats-on-slo.svg" : "listed-on-whats-on-slo-light.svg";
  const code = `<a href="${SITE}/?utm_source=venue-badge&utm_medium=badge" title="Listed on What's On SLO">
  <img src="${SITE}/badge/${file}" alt="Listed on What's On SLO" width="200" height="52">
</a>`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6">
        {(["dark", "light"] as const).map((v) => (
          <label key={v} className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="badge-variant"
              checked={variant === v}
              onChange={() => setVariant(v)}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/badge/${v === "dark" ? "listed-on-whats-on-slo.svg" : "listed-on-whats-on-slo-light.svg"}`}
              alt={`Badge, ${v} version`}
              width={200}
              height={52}
            />
          </label>
        ))}
      </div>
      <CopyBlock code={code} label="Badge HTML" />
    </div>
  );
}

export function WidgetSnippets({ venues }: { venues: Venue[] }) {
  // Start on the busiest venue so the preview shows a full list.
  const [slug, setSlug] = useState(
    () => [...venues].sort((a, b) => b.count - a.count)[0]?.slug ?? ""
  );
  const venue = venues.find((v) => v.slug === slug);
  const src = `${SITE}/embed/venue/${slug}`;
  const code = `<iframe src="${src}" title="Upcoming events at ${venue?.name ?? "your venue"}" width="100%" height="480" style="border:0;max-width:480px" loading="lazy"></iframe>`;

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-[11px] uppercase tracking-widest text-muted">
          Choose your venue
        </span>
        <select
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="mt-1 block w-full border border-rule bg-background px-3 py-2"
        >
          {venues.map((v) => (
            <option key={v.slug} value={v.slug}>
              {v.name} ({v.community}) &middot; {v.count} upcoming
            </option>
          ))}
        </select>
      </label>
      <CopyBlock code={code} label="Widget HTML" />
      <div>
        <p className="text-[11px] uppercase tracking-widest text-muted mb-2">Preview</p>
        <iframe
          key={slug}
          src={`/embed/venue/${slug}`}
          title={`Preview of the widget for ${venue?.name ?? "the venue"}`}
          className="w-full max-w-[480px] h-[480px] border border-rule bg-background"
          loading="lazy"
        />
      </div>
    </div>
  );
}
