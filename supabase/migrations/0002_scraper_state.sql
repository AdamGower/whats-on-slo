-- Persist HTTP cache validators (ETag / Last-Modified) per scraper key so
-- that conditional GETs can short-circuit unchanged remote feeds across
-- otherwise-stateless GitHub Actions runs.
--
-- Run once in the Supabase SQL Editor.

create table if not exists public.scraper_state (
  key text primary key,
  etag text,
  last_modified text,
  updated_at timestamptz not null default now()
);

alter table public.scraper_state enable row level security;

-- No public read/write policies. The scrapers run with the service_role
-- key and bypass RLS; the anon/public site never reads this table.
