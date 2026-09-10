// One-off backfill: strip markdown backslash escapes from BigBigSLO rows.
//
// BigBigSLO markdown-escapes ASCII punctuation, so "Tragedy (all metal)"
// stored as "Tragedy \(all metal\)" rendered with visible backslashes. The
// scraper now unescapes at the feed boundary (fromMarkdownFeedText); this
// fixes rows written before that.
//
// ---------------------------------------------------------------------------
// WHY THIS IS GUARDED, AND HOW
// ---------------------------------------------------------------------------
// Unescaping is NOT idempotent. A literal backslash arrives doubled, so:
//
//     "\("  --pass 1-->  "\("  --pass 2-->  "("        <-- silent data loss
//
// A second run must therefore be impossible, not merely discouraged. Rather
// than a ledger row saying "this already ran" -- which is coarse (all rows or
// none), and which a restore, a branch, or a second database would defeat --
// the guard is CONTENT-ADDRESSED and per row.
//
// A committed manifest records, for every row this backfill intends to touch,
// the SHA-256 of that field's exact pre-state. At write time each row is
// re-hashed and compared:
//
//   hash matches    -> row is untouched, unescape it and write        (once)
//   hash differs    -> already backfilled, or changed upstream: SKIP
//
// So a second run recomputes hashes, finds every one has moved, and writes
// nothing. The guarantee comes from the data itself, which makes it hold
// across machines, checkouts, CI, restores, and re-clones, with no state to
// keep in sync. It also refuses to touch a row a scraper legitimately rewrote
// after the manifest was generated -- a ledger could not tell the difference.
//
// Usage:
//   node scripts/backfill-unescape-markdown.mjs --generate-manifest
//   node scripts/backfill-unescape-markdown.mjs --dry-run
//   node scripts/backfill-unescape-markdown.mjs

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unescapeMarkdown } from "./_clean-html.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.join(HERE, "backfill-unescape-markdown.manifest.json");
const FIELDS = ["title", "venue", "description"];

const GENERATE = process.argv.includes("--generate-manifest");
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

const sha = (s) => createHash("sha256").update(String(s), "utf8").digest("hex");

async function fetchAll() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("events")
      .select("id,title,venue,description,source")
      .range(from, from + 999);
    if (error) {
      console.error("read failed:", error.message);
      process.exit(1);
    }
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

const rows = await fetchAll();
console.log(`Scanned ${rows.length} rows.`);

if (GENERATE) {
  const entries = [];
  for (const r of rows) {
    for (const f of FIELDS) {
      const v = r[f];
      if (!v) continue;
      const next = unescapeMarkdown(v);
      if (next === v) continue;
      entries.push({ id: r.id, field: f, source: r.source, before: sha(v) });
    }
  }
  fs.writeFileSync(
    MANIFEST,
    JSON.stringify(
      {
        note: "Per-field SHA-256 of pre-backfill state. A field is written only if its current value still hashes to `before`, which makes a re-run a no-op.",
        generated_rows: new Set(entries.map((e) => e.id)).size,
        generated_fields: entries.length,
        entries,
      },
      null,
      2
    ) + "\n"
  );
  console.log(
    `Manifest written: ${entries.length} field(s) across ${new Set(entries.map((e) => e.id)).size} row(s).`
  );
  process.exit(0);
}

if (!fs.existsSync(MANIFEST)) {
  console.error(`No manifest at ${MANIFEST}. Run --generate-manifest first.`);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const byId = new Map(rows.map((r) => [r.id, r]));

const planned = [];
let skippedHash = 0;
let missingRow = 0;
for (const e of manifest.entries) {
  const row = byId.get(e.id);
  if (!row) {
    missingRow++;
    continue;
  }
  const current = row[e.field];
  if (!current || sha(current) !== e.before) {
    skippedHash++;
    continue;
  }
  planned.push({ id: e.id, field: e.field, before: current, after: unescapeMarkdown(current) });
}

console.log(`\nManifest entries : ${manifest.entries.length}`);
console.log(`Rows gone        : ${missingRow}`);
console.log(`Hash moved (skip): ${skippedHash}   <- a re-run makes this the whole manifest`);
console.log(`To write         : ${planned.length}`);

if (planned.length === 0) {
  console.log("\nNothing to do. (Already applied, or upstream changed every row.)");
  process.exit(0);
}

console.log("\nSample (first 4):");
for (const p of planned.slice(0, 4)) {
  console.log(`  ${p.id} [${p.field}]`);
  console.log(`    - ${JSON.stringify(p.before.slice(0, 95))}`);
  console.log(`    + ${JSON.stringify(p.after.slice(0, 95))}`);
}

if (DRY_RUN) {
  console.log("\n--dry-run: no writes performed.");
  process.exit(0);
}

const patches = new Map();
for (const p of planned) {
  if (!patches.has(p.id)) patches.set(p.id, {});
  patches.get(p.id)[p.field] = p.after;
}

let ok = 0;
for (const [id, patch] of patches) {
  const { error } = await supabase
    .from("events")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error(`  FAILED ${id}: ${error.message}`);
    continue;
  }
  ok++;
  if (ok % 50 === 0) console.log(`  ...${ok}/${patches.size}`);
}
console.log(`\nUpdated ${ok}/${patches.size} rows.`);
