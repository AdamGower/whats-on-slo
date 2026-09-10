// Data-integrity test: no encoded or escaped junk in user-visible event text.
//
// The unit tests in _clean-html.test.mjs prove the CLEANERS behave. This one
// proves the TABLE is actually clean -- it is the assertion that would have
// caught "Buffalo Pub &#038; Grill" and "Tragedy \(all metal\)" reaching the
// live site, since both were correct-code-wrong-data problems.
//
// Runs against whatever database the env points at, and SKIPS when no
// credentials are present, so `npm test` still passes offline and in any CI
// job without secrets. The scrape workflow does not run `npm test`, so this
// never gates a scheduled scrape; run it by hand after a backfill or when a
// new source lands.
//
//   node --test scripts/events-text-integrity.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const HAVE_CREDS = Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);

const FIELDS = ["title", "venue", "description"];

// Built from char codes so no shell, heredoc, or editor between here and disk
// can eat an escape. 92 is backslash, 96 backtick; the class spans every ASCII
// punctuation character, which is exactly what CommonMark allows after a
// backslash.
const BACKSLASH = String.fromCharCode(92);
const ASCII_PUNCT = "[!-/:-@[-" + String.fromCharCode(96) + "{-~]";
const MD_ESCAPE = new RegExp(BACKSLASH + BACKSLASH + ASCII_PUNCT);

// Literal needles, per the three things we assert are absent.
const CHECKS = [
  { label: '"&#" (numeric entity, e.g. &#038; / &#8211;)', hit: (v) => v.includes("&#") },
  { label: '"&amp;" (named entity)', hit: (v) => v.includes("&amp;") },
  { label: "backslash before ASCII punctuation (markdown escape)", hit: (v) => MD_ESCAPE.test(v) },
];

async function fetchAllRows() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("events")
      .select("id,title,venue,description,source")
      .range(from, from + 999);
    if (error) throw new Error(`reading events: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

// One shared fetch: the table is a few thousand rows and paging it once per
// assertion would triple the round trips for no extra coverage.
const rows = HAVE_CREDS ? await fetchAllRows() : [];

test("events table has rows to check", { skip: !HAVE_CREDS && "no SUPABASE credentials in env" }, () => {
  assert.ok(rows.length > 0, "expected at least one events row");
  console.log(`  (checked ${rows.length} rows x ${FIELDS.length} fields)`);
});

for (const check of CHECKS) {
  test(`no event text contains ${check.label}`, { skip: !HAVE_CREDS && "no SUPABASE credentials in env" }, () => {
    const offenders = [];
    for (const row of rows) {
      for (const field of FIELDS) {
        const value = row[field];
        if (typeof value !== "string" || !value) continue;
        if (!check.hit(value)) continue;
        offenders.push({ id: row.id, source: row.source, field, value });
      }
    }
    if (offenders.length > 0) {
      // Show enough to act on without dumping the whole table into the log.
      const shown = offenders
        .slice(0, 10)
        .map((o) => `    ${o.id} [${o.field}] (${o.source}): ${JSON.stringify(o.value.slice(0, 110))}`)
        .join("\n");
      const more =
        offenders.length > 10 ? `\n    ...and ${offenders.length - 10} more` : "";
      assert.fail(
        `${offenders.length} field(s) contain ${check.label}:\n${shown}${more}`
      );
    }
  });
}
