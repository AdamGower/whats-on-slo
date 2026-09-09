-- Seed a one-off community submission: SLO Elks Lodge #322 Haunted House &
-- Carnival.
--
-- Submitted through /submit by the lodge for Fri Oct 23 and Sat Oct 24, 2026.
-- One event, two nights, so two rows — the site groups and dedups by Pacific
-- calendar day (see dedupKey in src/lib/supabase.ts), and a single row
-- spanning both nights would surface only on the Friday. No machine-readable
-- feed behind it, so it is seeded directly like the other hand-curated rows.
-- The id carries no source prefix, which is what marks it hand-curated for
-- the dedup priority. Re-running is idempotent via the on-conflict upsert.
--
-- Note the id dates are the LOCAL (Pacific) dates. 5:00 PM PDT on Oct 23 is
-- 2026-10-24T00:00:00Z — midnight UTC — so a slug built from the UTC date
-- would name both rows a day late and collide the Friday row with the
-- Saturday one.
--
-- The description leads with the Forgotten Trail paragraph on purpose: the
-- homepage card truncates at DESCRIPTION_WORD_LIMIT (50 words, see
-- truncateWords in src/app/page.tsx), and that paragraph is exactly 50 words,
-- so the card shows it whole with no ellipsis. Nothing load-bearing is lost
-- to the cut: everything the second paragraph states is already on the card
-- in its own field — the run times as starts_at/ends_at, the street address
-- as part of venue.
--
-- Run once in the Supabase SQL Editor.

insert into public.events
  (id, title, starts_at, ends_at, venue, community, description, source, source_url, category)
values
  ('slo-elks-haunted-house-2026-10-23',
   'SLO Elks Lodge #322 Haunted House & Carnival',
   '2026-10-23T17:00-07:00', '2026-10-23T21:00-07:00',
   'SLO Elks Lodge, 222 Elks Lane', 'San Luis Obispo',
   'The Forgotten Trail: You are Search Team 3, sent into the forest after the Rangers who went before you found evidence of something dangerous. Some never made it back. Your Ranger will guide you along the trail, but once you enter the woods you might become part of the search.

Two nights of Halloween fun at the SLO Elks Lodge #322 Haunted House and Carnival, 5 to 9 PM Friday and Saturday. All ages, open to the public.',
   'SLO Elks Lodge #322', 'https://elks322.org/events/halloween-haunted-house/',
   'Family'),
  ('slo-elks-haunted-house-2026-10-24',
   'SLO Elks Lodge #322 Haunted House & Carnival',
   '2026-10-24T17:00-07:00', '2026-10-24T21:00-07:00',
   'SLO Elks Lodge, 222 Elks Lane', 'San Luis Obispo',
   'The Forgotten Trail: You are Search Team 3, sent into the forest after the Rangers who went before you found evidence of something dangerous. Some never made it back. Your Ranger will guide you along the trail, but once you enter the woods you might become part of the search.

Two nights of Halloween fun at the SLO Elks Lodge #322 Haunted House and Carnival, 5 to 9 PM Friday and Saturday. All ages, open to the public.',
   'SLO Elks Lodge #322', 'https://elks322.org/events/halloween-haunted-house/',
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
