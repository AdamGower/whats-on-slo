-- Seed Morro Bay Art in the Park as static events.
--
-- A hand-curated, thrice-yearly fair with no machine-readable feed, so it is
-- seeded directly rather than scraped. Three 2026 occurrences (each a
-- three-day weekend) at Morro Bay City Park. Re-running is idempotent via the
-- on-conflict upsert.
--
-- Run once in the Supabase SQL Editor.

insert into public.events
  (id, title, starts_at, ends_at, venue, community, description, source, source_url, category)
values
  ('morro-bay-art-in-the-park-2026-05-23',
   'Morro Bay Art in the Park',
   '2026-05-23T10:00-07:00', '2026-05-25T17:00-07:00',
   'Morro Bay City Park', 'Morro Bay',
   'Free outdoor fine-art and craft show held three weekends a year in Morro Bay City Park. Local and regional artists exhibit paintings, photography, jewelry, ceramics, and woodwork.',
   'Morro Bay Art in the Park', 'https://morrobayartinthepark.com',
   'Arts'),
  ('morro-bay-art-in-the-park-2026-07-03',
   'Morro Bay Art in the Park',
   '2026-07-03T10:00-07:00', '2026-07-05T17:00-07:00',
   'Morro Bay City Park', 'Morro Bay',
   'Free outdoor fine-art and craft show held three weekends a year in Morro Bay City Park. Local and regional artists exhibit paintings, photography, jewelry, ceramics, and woodwork.',
   'Morro Bay Art in the Park', 'https://morrobayartinthepark.com',
   'Arts'),
  ('morro-bay-art-in-the-park-2026-09-05',
   'Morro Bay Art in the Park',
   '2026-09-05T10:00-07:00', '2026-09-07T17:00-07:00',
   'Morro Bay City Park', 'Morro Bay',
   'Free outdoor fine-art and craft show held three weekends a year in Morro Bay City Park. Local and regional artists exhibit paintings, photography, jewelry, ceramics, and woodwork.',
   'Morro Bay Art in the Park', 'https://morrobayartinthepark.com',
   'Arts')
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
