-- Seed a one-off community submission: Monarch Grove Car Wash for Fifth Grade
-- Camp at Monarch Grove Elementary School.
--
-- Submitted through /submit by the organizer, Trevor Grimshaw, for Sun Sep 27,
-- 2026. A single-day event with no machine-readable feed behind it, so it is
-- seeded directly like the other hand-curated rows. The id carries no source
-- prefix, which is what marks it hand-curated for the dedup priority in
-- src/lib/supabase.ts. Re-running is idempotent via the on-conflict upsert.
--
-- The source page (monarchgrovepta.org/5th-grade) confirms the date, the 10 AM
-- to 2 PM window and the school, but its body copy only describes a tote bag
-- sale and never mentions the car wash. Published as submitted, link included,
-- on the moderator's call. The stored submission's 10:59 AM start is a form
-- slip; both the submitted body copy and the source page say 10 AM.
--
-- 10 AM PDT is 17:00 UTC, same calendar day, so the slug date is unambiguous.
-- It is still written as the LOCAL date for consistency with every other seed.
--
-- The description leads with a hook paragraph kept under DESCRIPTION_WORD_LIMIT
-- (50 words, see truncateWords in src/app/page.tsx) so the homepage card shows
-- it whole with no ellipsis. The second paragraph carries the submitter's
-- tongue-in-cheek wash details, framed as the organizers' own promise.
--
-- Run once in the Supabase SQL Editor.

insert into public.events
  (id, title, starts_at, ends_at, venue, community, description, source, source_url, category)
values
  ('monarch-grove-car-wash-fifth-grade-camp-2026-09-27',
   'Monarch Grove Car Wash for Fifth Grade Camp',
   '2026-09-27T10:00-07:00', '2026-09-27T14:00-07:00',
   'Monarch Grove Elementary School, 348 Los Osos Valley Rd', 'Los Osos',
   'Get your car washed and help send the fifth grade class at Monarch Grove Elementary School to science camp. Volunteers run the car wash from 10 AM to 2 PM in the school parking lot, and each $20 wash raises money for the 2026 fifth grade science camp.

The organizers promise a thorough job from their team of volunteer experts. Each car is rinsed with water drawn from local wells, washed with soaps from around the world, rinsed again, then hand dried with the finest cloths.',
   'Monarch Grove PTA', 'https://monarchgrovepta.org/5th-grade',
   'Community')
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
