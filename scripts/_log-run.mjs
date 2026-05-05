// Tiny shared helper for writing per-run rows to the `scraper_logs` table.
// Logging is observability, not part of the data path: a write failure
// here warns to stderr but never aborts the scraper. The monitor job
// reads this table and alerts on `status = 'no-data'`.
//
// Status values:
//   'success'      — ingested >0 events
//   'no-data'      — source returned, but zero events matched our filters
//   'not-modified' — source returned HTTP 304 (no work needed)

export async function logRun(supabase, source, eventCount, status = "success") {
  const { error } = await supabase.from("scraper_logs").insert({
    source,
    event_count: eventCount,
    status,
    ran_at: new Date().toISOString(),
  });
  if (error) {
    console.warn(
      `scraper_logs insert failed for ${source} (status=${status}, count=${eventCount}): ${error.message}`
    );
  }
}
