-- Per-run observability for the scrapers. Each scraper writes one row at the
-- end of its run with how many events it ingested. The `monitor` GitHub
-- Actions job reads recent rows to detect silent zero-event regressions
-- and emails an alert; the table also doubles as a manual audit log.
--
-- `status` distinguishes:
--   - 'success'       — scraper ran and ingested >0 events
--   - 'no-data'       — source returned data but zero matched our filters
--                       (this is the case the monitor alerts on)
--   - 'not-modified'  — source returned HTTP 304 (rideshare ICS), no work to do
--
-- Run once in the Supabase SQL Editor.

create table if not exists public.scraper_logs (
  id bigserial primary key,
  source text not null,
  event_count integer not null,
  status text not null check (status in ('success', 'no-data', 'not-modified')),
  ran_at timestamptz not null default now()
);

create index if not exists scraper_logs_ran_at_idx
  on public.scraper_logs (ran_at desc);

alter table public.scraper_logs enable row level security;

-- No public read/write policies. The scrapers and monitor job run with the
-- service_role key and bypass RLS; the anon/public site never reads this table.
