import Link from "next/link";
import { trails, DIFFICULTIES, directionsUrl, trailSlug } from "@/lib/trails";
import type { Trail } from "@/types";
import MapWrapper from "./MapWrapper";

export const metadata = {
  title: "Hiking trails",
  description:
    "54 hand-picked hiking trails within 25 miles of San Luis Obispo. Filter by difficulty and dog-friendliness. Each trail includes distance, elevation, parking, hazards, and one-tap directions.",
};

type DogsFilter = "all" | "yes" | "no";
type ViewMode = "list" | "map";
type SearchParams = Promise<{
  difficulty?: string;
  dogs?: string;
  view?: string;
}>;

const DOGS_LABELS: Record<DogsFilter, string> = {
  all: "All",
  yes: "Allowed",
  no: "Not allowed",
};

function buildHref(
  difficulty: Trail["difficulty"] | null,
  dogs: DogsFilter,
  view: ViewMode
): string {
  const params = new URLSearchParams();
  if (difficulty) params.set("difficulty", difficulty);
  if (dogs !== "all") params.set("dogs", dogs);
  if (view !== "list") params.set("view", view);
  const qs = params.toString();
  return qs ? `/hiking?${qs}` : "/hiking";
}

function applyFilters(
  list: Trail[],
  difficulty: Trail["difficulty"] | null,
  dogs: DogsFilter
): Trail[] {
  return list.filter((t) => {
    if (difficulty && t.difficulty !== difficulty) return false;
    if (dogs === "yes" && !t.dogs) return false;
    if (dogs === "no" && t.dogs) return false;
    return true;
  });
}

function difficultyDot(d: Trail["difficulty"]) {
  // Subtle color cue keyed to difficulty. Using muted tones to fit the
  // newspaper aesthetic, not jelly-bean greens/reds.
  return {
    Easy: "bg-emerald-700",
    Moderate: "bg-amber-700",
    Hard: "bg-orange-800",
    Strenuous: "bg-accent",
  }[d];
}

export default async function HikingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const requestedDifficulty = params.difficulty;
  const validDifficulty =
    requestedDifficulty &&
    (DIFFICULTIES as string[]).includes(requestedDifficulty)
      ? (requestedDifficulty as Trail["difficulty"])
      : null;

  const requestedDogs = params.dogs;
  const validDogs: DogsFilter =
    requestedDogs === "yes" || requestedDogs === "no"
      ? (requestedDogs as DogsFilter)
      : "all";

  const validView: ViewMode = params.view === "map" ? "map" : "list";

  const filtered = applyFilters(trails, validDifficulty, validDogs);

  const difficultyCounts = new Map<Trail["difficulty"], number>();
  const dogsAvailableCount = applyFilters(trails, validDifficulty, "all").filter(
    (t) => t.dogs
  ).length;
  const dogsBlockedCount = applyFilters(trails, validDifficulty, "all").filter(
    (t) => !t.dogs
  ).length;
  for (const d of DIFFICULTIES) {
    difficultyCounts.set(
      d,
      applyFilters(trails, d, validDogs).length
    );
  }

  return (
    <div className="flex flex-col flex-1 w-full">
      <header className="border-b-4 border-double border-foreground/80 px-6 pt-10 pb-6">
        <div className="mx-auto max-w-5xl">
          <p className="text-center text-[11px] uppercase tracking-[0.3em] text-muted">
            <Link href="/" className="hover:text-accent">
              ← What&rsquo;s On SLO
            </Link>
          </p>
          <h1
            className="font-serif text-center text-5xl sm:text-6xl md:text-7xl font-black tracking-tight mt-3"
            style={{ fontStretch: "expanded" }}
          >
            Hiking
          </h1>
          <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs uppercase tracking-widest text-muted border-t border-rule pt-3">
            <span>54 trails within 25 miles of San Luis Obispo</span>
            <span>Hand-curated &middot; Updated periodically</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl w-full px-6 py-10 flex-1">
        {/* Difficulty filter */}
        <nav
          aria-label="Filter by difficulty"
          className="flex flex-wrap gap-x-4 gap-y-2 items-baseline border-b border-rule pb-4 mb-4 text-sm"
        >
          <span className="text-[11px] uppercase tracking-widest text-muted">
            Difficulty:
          </span>
          <a
            href={buildHref(null, validDogs, validView)}
            className={
              !validDifficulty
                ? "font-bold text-accent border-b-2 border-accent pb-0.5"
                : "text-foreground/80 hover:text-accent"
            }
          >
            All
            <span className="ml-1 text-[11px] text-muted">
              {applyFilters(trails, null, validDogs).length}
            </span>
          </a>
          {DIFFICULTIES.map((d) => {
            const active = validDifficulty === d;
            const count = difficultyCounts.get(d) ?? 0;
            return (
              <a
                key={d}
                href={buildHref(d, validDogs, validView)}
                className={
                  active
                    ? "font-bold text-accent border-b-2 border-accent pb-0.5"
                    : "text-foreground/80 hover:text-accent"
                }
              >
                {d}
                <span
                  className={
                    "ml-1 text-[11px] " +
                    (active ? "text-accent/80" : "text-muted")
                  }
                >
                  {count}
                </span>
              </a>
            );
          })}
        </nav>

        {/* Dogs filter */}
        <nav
          aria-label="Filter by dog-friendliness"
          className="flex flex-wrap gap-x-4 gap-y-2 items-baseline border-b border-rule pb-4 mb-4 text-sm"
        >
          <span className="text-[11px] uppercase tracking-widest text-muted">
            Dogs:
          </span>
          {(["all", "yes", "no"] as DogsFilter[]).map((d) => {
            const active = validDogs === d;
            const count =
              d === "all"
                ? applyFilters(trails, validDifficulty, "all").length
                : d === "yes"
                ? dogsAvailableCount
                : dogsBlockedCount;
            return (
              <a
                key={d}
                href={buildHref(validDifficulty, d, validView)}
                className={
                  active
                    ? "font-bold text-accent border-b-2 border-accent pb-0.5"
                    : "text-foreground/80 hover:text-accent"
                }
              >
                {DOGS_LABELS[d]}
                <span
                  className={
                    "ml-1 text-[11px] " +
                    (active ? "text-accent/80" : "text-muted")
                  }
                >
                  {count}
                </span>
              </a>
            );
          })}
        </nav>

        {/* View toggle: list / map */}
        <nav
          aria-label="View mode"
          className="flex flex-wrap gap-x-4 gap-y-2 items-baseline border-b border-rule pb-4 mb-8 text-sm"
        >
          <span className="text-[11px] uppercase tracking-widest text-muted">
            View:
          </span>
          {(["list", "map"] as ViewMode[]).map((v) => {
            const active = validView === v;
            return (
              <a
                key={v}
                href={buildHref(validDifficulty, validDogs, v)}
                className={
                  active
                    ? "font-bold text-accent border-b-2 border-accent pb-0.5"
                    : "text-foreground/80 hover:text-accent"
                }
              >
                {v === "list" ? "List" : "Map"}
              </a>
            );
          })}
        </nav>

        <p className="text-muted text-sm italic mb-8">
          {filtered.length} trail{filtered.length === 1 ? "" : "s"} match
          {filtered.length === 1 ? "es" : ""} your filters.
        </p>

        {validView === "map" && filtered.length > 0 && (
          <MapWrapper trails={filtered} />
        )}

        {filtered.length === 0 ? (
          <p className="text-muted italic">
            No trails match those filters.{" "}
            <a
              href="/hiking"
              className="underline decoration-dotted underline-offset-2 hover:text-accent"
            >
              Reset
            </a>
            .
          </p>
        ) : validView === "list" ? (
          <ul className="space-y-12">
            {filtered.map((t) => (
              <li
                key={trailSlug(t)}
                className="border-b border-rule pb-10 last:border-b-0"
              >
                {/* Title row */}
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h2 className="font-serif text-2xl sm:text-3xl font-bold leading-snug">
                    {t.source_url ? (
                      <a
                        href={t.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-accent"
                      >
                        {t.name}
                      </a>
                    ) : (
                      t.name
                    )}
                  </h2>
                  <span className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${difficultyDot(
                        t.difficulty
                      )}`}
                      aria-hidden
                    />
                    {t.difficulty}
                  </span>
                </div>

                <p className="text-sm text-muted mt-1">
                  {t.area} &middot; <span className="italic">{t.trailhead}</span>
                </p>

                {/* Stats line */}
                <p className="text-sm mt-3 flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    <strong>{t.distance_miles}</strong> mi
                  </span>
                  <span>
                    <strong>{t.elevation_gain_ft.toLocaleString()}</strong> ft
                    gain
                  </span>
                  <span>{t.trail_type}</span>
                  <span className="text-muted">Best: {t.best_months}</span>
                </p>

                {/* Hikers say */}
                <blockquote className="mt-5 pl-4 border-l-2 border-accent/60">
                  <p className="text-[11px] uppercase tracking-widest text-muted mb-1">
                    Hikers say
                  </p>
                  <p className="font-serif italic leading-relaxed">
                    {t.hikers_say}
                  </p>
                </blockquote>

                {/* Features */}
                {t.features && (
                  <p className="mt-4 leading-relaxed">{t.features}</p>
                )}

                {/* Practical info grid */}
                <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  <div>
                    <dt className="text-[11px] uppercase tracking-widest text-muted">
                      Dogs
                    </dt>
                    <dd>{t.dogs ? "Allowed" : "Not allowed"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-widest text-muted">
                      Bikes
                    </dt>
                    <dd>{t.bikes ? "Allowed" : "Not allowed"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[11px] uppercase tracking-widest text-muted">
                      Parking
                    </dt>
                    <dd className="leading-snug">{t.parking}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[11px] uppercase tracking-widest text-muted">
                      Hazards
                    </dt>
                    <dd className="leading-snug">{t.hazards}</dd>
                  </div>
                </dl>

                {/* Tags */}
                {t.tags && t.tags.length > 0 && (
                  <p className="mt-5 flex flex-wrap gap-2">
                    {t.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] uppercase tracking-wider text-muted border border-rule rounded-sm px-2 py-0.5"
                      >
                        {tag}
                      </span>
                    ))}
                  </p>
                )}

                {/* Action row */}
                <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <a
                    href={directionsUrl(t)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-serif font-bold underline decoration-2 underline-offset-4 hover:text-accent"
                  >
                    Get directions →
                  </a>
                  {t.source_url && (
                    <a
                      href={t.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted underline decoration-dotted underline-offset-2 hover:text-accent"
                    >
                      Source
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </main>

      <footer className="border-t border-rule mt-10 px-6 py-6">
        <div className="mx-auto max-w-5xl text-xs text-muted flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>What&rsquo;s On SLO &middot; Hiking</span>
          <Link href="/" className="hover:text-accent">
            ← Back to events
          </Link>
        </div>
      </footer>
    </div>
  );
}
