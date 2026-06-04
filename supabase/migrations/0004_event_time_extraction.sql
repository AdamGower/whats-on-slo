-- Time-extraction support.
--
-- Many feeds give us a date but no clock time. Scrapers anchor those at a
-- per-source sentinel hour (goslo noon, Sea Pines 2 PM, RunSignup 7 AM) so the
-- event still groups under the right calendar day — but rendering that sentinel
-- as a real time ("12 PM") is misleading. We now mark such rows so the UI can
-- show "Time TBA", and a separate enrichment pass (scripts/enrich-event-times
-- .mjs) visits each event's source_url to recover a real start time when one
-- is published on the page.
--
-- Run once in the Supabase SQL Editor.

-- 1. Flag rows whose start time is a sentinel, not a real feed time. The
--    public site reads this column (anon already holds the table-level SELECT
--    grant on events, so the new column is covered). Existing rows default to
--    false; the sentinel scrapers set it true on their next run.
alter table public.events
  add column if not exists time_tba boolean not null default false;

-- 2. Cache extraction results per source URL so we don't re-fetch the same
--    event page every sync. `starts_at` holds the recovered UTC instant (null
--    when no time was found); `time_found` distinguishes "checked, none on the
--    page" from "found one"; `method` records which signal won (json-ld /
--    opengraph / text) for debugging; `checked_at` drives the freshness TTL.
create table if not exists public.event_time_cache (
  source_url text primary key,
  starts_at timestamptz,
  time_found boolean not null default false,
  method text,
  checked_at timestamptz not null default now()
);

alter table public.event_time_cache enable row level security;

-- No public read/write policies. The enrichment script runs with the
-- service_role key and bypasses RLS; the anon/public site never reads this
-- table (mirrors scraper_state / scraper_logs).
