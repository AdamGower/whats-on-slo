-- Add a 'blocked' status to scraper_logs for sources whose site refuses
-- automated requests outright (e.g. a Cloudflare bot challenge).
--
-- Sea Pines Golf Resort put its whole site behind a Cloudflare challenge on
-- 2026-11-17. The scraper now recognises that and logs 'blocked' instead of
-- failing the job, so the block stays visible in scraper_logs and in the
-- monitor's summary without turning every scrape run red.
--
-- Until this runs, the scraper still skips cleanly; only its scraper_logs
-- insert is rejected (logRun warns and carries on).
--
-- Run once in the Supabase SQL Editor.

alter table public.scraper_logs
  drop constraint if exists scraper_logs_status_check;

alter table public.scraper_logs
  add constraint scraper_logs_status_check
  check (status in ('success', 'no-data', 'not-modified', 'out-of-season', 'blocked'));
