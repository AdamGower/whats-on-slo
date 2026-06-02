-- Explicit table-level GRANTs for every table in the public schema.
--
-- Supabase ships with broad default privileges on the public schema, but
-- making the grants explicit per table is the convention we want going
-- forward: each migration that creates a table also declares which roles
-- can touch it, so the intent is visible in source instead of relying on
-- whatever defaults happen to be in effect.
--
-- Role model in this project:
--   anon          — unauthenticated visitors hitting the site
--   authenticated — signed-in users (not currently used, kept for parity)
--   service_role  — scrapers and monitor job; bypasses RLS
--
-- RLS is enabled on every table; the GRANTs below only open the door to
-- the table, the row-level policies decide which rows are visible.
--
-- Run once in the Supabase SQL Editor.

-- public.events — publicly readable event listings.
revoke all on public.events from anon, authenticated;
grant select on public.events to anon, authenticated;
grant all on public.events to service_role;

-- public.scraper_state — HTTP cache validators, scraper-internal.
revoke all on public.scraper_state from anon, authenticated;
grant all on public.scraper_state to service_role;

-- public.scraper_logs — per-run observability, scraper-internal.
revoke all on public.scraper_logs from anon, authenticated;
grant usage, select on sequence public.scraper_logs_id_seq to service_role;
grant all on public.scraper_logs to service_role;
