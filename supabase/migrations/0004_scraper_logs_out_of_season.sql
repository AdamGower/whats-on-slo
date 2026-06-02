-- Add an 'out-of-season' status to scraper_logs for seasonal sources.
--
-- rideshare.org's "Bike Month" calendar is only populated in May. The other
-- eleven months the scraper skips its fetch and logs 'out-of-season' instead
-- of 'no-data', so the monitor job does not raise a false zero-event alert in
-- the off-season.
--
-- Run once in the Supabase SQL Editor.

alter table public.scraper_logs
  drop constraint if exists scraper_logs_status_check;

alter table public.scraper_logs
  add constraint scraper_logs_status_check
  check (status in ('success', 'no-data', 'not-modified', 'out-of-season'));
