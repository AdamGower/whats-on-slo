// Shared Supabase client factory for the scrapers, with a dry-run switch.
//
// SCRAPE_DRY_RUN=1 runs a scraper end to end (fetch, parse, map, prune plan)
// without touching the database and without needing any Supabase env vars.
// Reads resolve empty, as if the table held nothing, and every write is
// printed instead of sent. The CI auto-fix workflow uses this to test a fix
// on an unreviewed branch without letting that code write to production.

import { createClient } from "@supabase/supabase-js";

export const DRY_RUN = process.env.SCRAPE_DRY_RUN === "1";

export function createScraperClient() {
  if (DRY_RUN) {
    console.log("SCRAPE_DRY_RUN=1: no database reads or writes will be made.");
    return createDryRunClient();
  }
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error(
      "Missing env vars. Need SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SECRET_KEY. " +
        "Set SCRAPE_DRY_RUN=1 to run without a database."
    );
    process.exit(1);
  }
  return createClient(url, key);
}

const WRITE_OPS = new Set(["insert", "upsert", "update", "delete"]);

// Stand-in for the supabase-js query builder: every method chains, and
// awaiting the chain resolves { data, error: null }. Writes log a one-line
// summary; a sample row from events upserts shows what would have landed.
export function createDryRunClient({ log = console.log } = {}) {
  return {
    from(table) {
      let op = "select";
      let payload;
      let single = false;
      const builder = new Proxy(
        {},
        {
          get(_, prop) {
            if (prop === "then") {
              return (resolve, reject) => {
                if (WRITE_OPS.has(op)) logWrite(log, table, op, payload);
                return Promise.resolve({ data: single ? null : [], error: null }).then(
                  resolve,
                  reject
                );
              };
            }
            return (...args) => {
              if (WRITE_OPS.has(prop)) {
                op = prop;
                payload = args[0];
              } else if (prop === "maybeSingle" || prop === "single") {
                single = true;
              } else if (op === "delete" && prop === "in") {
                payload = args[1];
              }
              return builder;
            };
          },
        }
      );
      return builder;
    },
  };
}

function logWrite(log, table, op, payload) {
  const rows = Array.isArray(payload) ? payload : payload ? [payload] : [];
  log(`[dry run] would ${op} ${rows.length} row(s) in ${table}`);
  if (table === "events" && op === "upsert" && rows[0]) {
    log(`[dry run] sample row: ${JSON.stringify(rows[0])}`);
  }
}
