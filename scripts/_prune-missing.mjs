// Shared prune pass: remove rows a source has retracted.
//
// Every scraper upserts and none of them delete, so a row we ingested once
// lives forever even after the source drops it. That is not hypothetical:
// Visit SLO published 95 bogus "Cal Poly Commencement Weekend" occurrences
// and later deleted all but one, and the library renamed a program and
// reissued its ids. Both left phantom events on the site — the library ones
// were still eating a slot on 94 separate days months later.
//
// The hazard runs the other way too: a row missing from a feed usually means
// "retracted", but it can also mean "we did not look there", and deleting on
// that basis destroys real data. Four rules keep the two apart:
//
//   1. Only consider a window the run actually covered end to end. A scraper
//      reading today..+90 knows nothing about next spring, so rows out there
//      are not evidence of anything and must be left alone.
//   2. Never prune today or the past. Sources drop an event the moment it
//      ends, and our scrapers skip events that already finished, so a row
//      dated today can be absent from the feed and still be perfectly real.
//   3. Never prune on an empty run. Zero rows means the source broke, not
//      that it cancelled its entire calendar.
//   4. Refuse when an implausible share of the window would go. A truncated
//      feed or a half-failed fetch looks exactly like a mass retraction, and
//      a bad run should delete nothing at all.
//
// Rule 4 is a circuit breaker, not a judgement: when it trips the run logs
// loudly and prunes nothing, leaving a human to look.

const CHUNK = 50;

export function pacificDay(iso) {
  return new Date(iso).toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
  });
}

// The first day it is safe to prune: tomorrow, Pacific. See rule 2.
export function firstPrunableDay(now = new Date()) {
  const today = pacificDay(now.toISOString());
  return new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export function dayBefore(day) {
  return new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
}

// The last day this run actually saw, as a prune horizon. Most sources have no
// declared window — Ticketmaster searches by radius, goslo returns one page,
// the ICS feeds return whatever they hold — so their evidence simply runs out
// at the furthest event they returned. Anything past that is unexamined, not
// retracted. Returns null for an empty run, which planPrune already refuses.
export function latestPacificDay(rows) {
  let latest = null;
  for (const row of rows) {
    const day = pacificDay(row.starts_at);
    if (latest === null || day > latest) latest = day;
  }
  return latest;
}

// Pure: decide what to delete. `existing` is every row we hold for the source;
// `seenIds` is what the run just ingested.
export function planPrune({
  existing,
  seenIds,
  windowStartDay,
  windowEndDay,
  covered = true,
  maxPruneFraction = 0.34,
}) {
  const inWindow = existing.filter((row) => {
    const day = pacificDay(row.starts_at);
    return day >= windowStartDay && day <= windowEndDay;
  });
  const stale = inWindow.filter((row) => !seenIds.has(row.id));
  const fraction = inWindow.length === 0 ? 0 : stale.length / inWindow.length;

  let refusal = null;
  if (seenIds.size === 0) {
    refusal = "the run ingested no events at all";
  } else if (!covered) {
    // A page cap that cut the fetch short, or a per-event fetch that failed
    // partway: rows we never looked at are indistinguishable from retracted
    // ones, so the whole pass is void.
    refusal = "the run did not fully cover its window";
  } else if (windowEndDay == null || windowEndDay < windowStartDay) {
    refusal = "the covered window is empty";
  } else if (fraction > maxPruneFraction) {
    refusal =
      `${stale.length} of ${inWindow.length} rows in the window ` +
      `(${Math.round(fraction * 100)}%) look retracted, over the ` +
      `${Math.round(maxPruneFraction * 100)}% ceiling`;
  }

  return {
    stale: refusal ? [] : stale.map((r) => r.id),
    candidates: stale.map((r) => r.id),
    inWindow: inWindow.length,
    fraction,
    refusal,
  };
}

async function fetchAllByPrefix(supabase, idPrefix) {
  // Paginate: the Data API silently caps a response at 1000 rows.
  const rows = [];
  for (let from = 0; from < 20_000; from += 1000) {
    const { data, error } = await supabase
      .from("events")
      .select("id,title,starts_at")
      .like("id", `${idPrefix}%`)
      .order("starts_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`prune: fetching ${idPrefix} rows: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

// Delete the rows `label` no longer lists. Returns the plan, with `deleted`.
export async function pruneMissing(
  supabase,
  {
    idPrefix,
    seenIds,
    windowStartDay,
    windowEndDay,
    covered,
    label,
    dryRun = false,
    maxPruneFraction,
  }
) {
  const existing = await fetchAllByPrefix(supabase, idPrefix);
  const plan = planPrune({
    existing,
    seenIds,
    windowStartDay,
    windowEndDay,
    covered,
    maxPruneFraction,
  });

  const scope = `${label} ${windowStartDay}..${windowEndDay}`;
  if (plan.refusal) {
    console.warn(
      `Prune refused for ${scope}: ${plan.refusal}. Nothing deleted; ` +
        `${plan.candidates.length} rows would have gone.`
    );
    return { ...plan, deleted: 0 };
  }
  if (plan.stale.length === 0) {
    console.log(`Prune: nothing retracted in ${scope} (${plan.inWindow} rows checked).`);
    return { ...plan, deleted: 0 };
  }

  const byTitle = new Map();
  for (const row of existing) {
    if (!plan.stale.includes(row.id)) continue;
    byTitle.set(row.title, (byTitle.get(row.title) ?? 0) + 1);
  }
  console.log(
    `Prune: ${plan.stale.length} of ${plan.inWindow} rows in ${scope} are gone upstream:`
  );
  for (const [title, n] of [...byTitle.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)} x ${title}`);
  }

  if (dryRun) {
    console.log("Prune: dry run, nothing deleted.");
    return { ...plan, deleted: 0 };
  }

  for (let i = 0; i < plan.stale.length; i += CHUNK) {
    const { error } = await supabase
      .from("events")
      .delete()
      .in("id", plan.stale.slice(i, i + CHUNK));
    if (error) throw new Error(`prune: deleting ${label} rows: ${error.message}`);
  }
  console.log(`Prune: deleted ${plan.stale.length} retracted rows.`);
  return { ...plan, deleted: plan.stale.length };
}
