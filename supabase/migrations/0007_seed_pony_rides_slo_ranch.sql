-- Seed a one-off community submission: Pony Rides at SLO Ranch.
--
-- Submitted through /submit by SLO Party Animals for Sat Aug 29, 2026. A
-- single-day event with no machine-readable feed behind it, so it is seeded
-- directly like the other hand-curated rows rather than scraped. The id
-- carries no source prefix, which is what marks it hand-curated for the
-- dedup priority in src/lib/supabase.ts. Re-running is idempotent via the
-- on-conflict upsert.
--
-- Run once in the Supabase SQL Editor.

insert into public.events
  (id, title, starts_at, ends_at, venue, community, description, source, source_url, category)
values
  ('pony-rides-slo-ranch-2026-08-29',
   'Pony Rides',
   '2026-08-29T10:00-07:00', '2026-08-29T16:00-07:00',
   'SLO Ranch', 'San Luis Obispo',
   'Come enjoy a fun pony ride with SLO Party Animals at SLO Ranch! Perfect for young riders, our gentle ponies and friendly handlers make it a sweet and memorable experience for the whole family.',
   'SLO Party Animals', 'https://www.slopartyanimals.com',
   'Family')
on conflict (id) do update set
  title = excluded.title,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  venue = excluded.venue,
  community = excluded.community,
  description = excluded.description,
  source = excluded.source,
  source_url = excluded.source_url,
  category = excluded.category,
  updated_at = now();
