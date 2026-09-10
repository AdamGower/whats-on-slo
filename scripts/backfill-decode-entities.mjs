// One-off backfill: decode HTML entities already stored in events rows.
//
// The scrapers now decode on ingest (see _clean-html.mjs), but rows written
// before that fix still carry literal "&#038;" / "&#8211;" / "&mdash;" in
// title, venue, and description. This walks the whole table, applies the same
// decoder the scrapers use, and writes back only the rows that actually change.
//
// Field-appropriate cleaners, matching what each scraper now does on ingest:
//   title / venue -> cleanText (collapses whitespace; these are single-line)
//   description   -> cleanTextPreservingBreaks (keeps "\n\n" paragraphs, which
//                    BigBigSLO/Sea Pines/rideshare descriptions rely on)
//
// Decoding is idempotent on real-world input, so re-running is safe.
//
// Usage:
//   node scripts/backfill-decode-entities.mjs --dry-run
//   node scripts/backfill-decode-entities.mjs

import { createClient } from "@supabase/supabase-js";
import { decodeHTML } from "entities";

const DRY_RUN = process.argv.includes("--dry-run");
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error(
    "Missing env vars. Need SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SECRET_KEY."
  );
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

const PAGE = 1000;
let rows = [];
for (let from = 0; ; from += PAGE) {
  const { data, error } = await supabase
    .from("events")
    .select("id,title,venue,description,source")
    .range(from, from + PAGE - 1);
  if (error) {
    console.error("read failed:", error.message);
    process.exit(1);
  }
  rows = rows.concat(data);
  if (data.length < PAGE) break;
}
console.log(`Scanned ${rows.length} rows.`);

const updates = [];
const bySource = {};
for (const r of rows) {
  const decode = (v) => (v ? decodeHTML(String(v)) : v);
  const next = {
    title: decode(r.title),
    venue: decode(r.venue),
    description: decode(r.description),
  };
  const changed = Object.keys(next).filter((k) => next[k] !== r[k]);
  if (changed.length === 0) continue;
  // Never blank out a NOT NULL column: if a cleaner somehow empties a field
  // that had content, skip that field rather than writing "".
  const patch = {};
  for (const k of changed) {
    if (!next[k] && r[k]) continue;
    patch[k] = next[k];
  }
  if (Object.keys(patch).length === 0) continue;
  updates.push({ id: r.id, source: r.source, patch, before: r });
  bySource[r.source] = (bySource[r.source] || 0) + 1;
}

console.log(`\nRows needing update: ${updates.length}`);
console.log("By source:", bySource);
const fieldCounts = { title: 0, venue: 0, description: 0 };
for (const u of updates)
  for (const k of Object.keys(u.patch)) fieldCounts[k]++;
console.log("By field:", fieldCounts);

console.log("\nSample (first 5):");
for (const u of updates.slice(0, 5)) {
  for (const [k, v] of Object.entries(u.patch)) {
    console.log(`  ${u.id} [${k}]`);
    console.log(`    - ${JSON.stringify(String(u.before[k]).slice(0, 90))}`);
    console.log(`    + ${JSON.stringify(String(v).slice(0, 90))}`);
  }
}

if (DRY_RUN) {
  console.log("\n--dry-run: no writes performed.");
  process.exit(0);
}

let ok = 0;
for (const u of updates) {
  const { error } = await supabase
    .from("events")
    .update({ ...u.patch, updated_at: new Date().toISOString() })
    .eq("id", u.id);
  if (error) {
    console.error(`  FAILED ${u.id}: ${error.message}`);
    continue;
  }
  ok++;
  if (ok % 50 === 0) console.log(`  ...${ok}/${updates.length}`);
}
console.log(`\nUpdated ${ok}/${updates.length} rows.`);
