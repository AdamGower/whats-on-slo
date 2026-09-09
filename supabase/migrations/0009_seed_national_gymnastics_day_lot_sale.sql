-- Seed a one-off community submission: National Gymnastics Day Parking Lot
-- Sale at Performance Athletics Gymnastics.
--
-- Submitted through /submit by the gym for Sat Sep 19, 2026. A single-day
-- event with no machine-readable feed behind it, so it is seeded directly
-- like the other hand-curated rows. The id carries no source prefix, which is
-- what marks it hand-curated for the dedup priority in src/lib/supabase.ts.
-- Re-running is idempotent via the on-conflict upsert.
--
-- Unlike the Elks rows, the UTC and Pacific dates agree here — 9:30 AM PDT is
-- 16:30 UTC, same calendar day — so the slug date is unambiguous. It is still
-- written as the LOCAL date for consistency with every other seed.
--
-- The description leads with the parking-lot-sale paragraph on purpose: the
-- homepage card truncates at DESCRIPTION_WORD_LIMIT (50 words, see
-- truncateWords in src/app/page.tsx) and that paragraph is 48 words, so the
-- card shows it whole with no ellipsis. The second paragraph covers the
-- paid-class programming, which is secondary to the free public draw.
--
-- Run once in the Supabase SQL Editor.

insert into public.events
  (id, title, starts_at, ends_at, venue, community, description, source, source_url, category)
values
  ('national-gymnastics-day-lot-sale-2026-09-19',
   'National Gymnastics Day Parking Lot Sale',
   '2026-09-19T09:30-07:00', '2026-09-19T15:30-07:00',
   'Performance Athletics Gymnastics, 4484 Broad St', 'San Luis Obispo',
   'Performance Athletics Gymnastics hosts a free parking lot sale for National Gymnastics Day. Families and neighboring businesses set up a community rummage sale, each vendor pricing their own goods, so expect anything from free to trade to bargain. Admission costs nothing and the lot is open to everyone.

Inside, newcomers can try a free trial class or Family Fun Play. Silks, Parkour, and Bars & Bounce clinics plus Kids'' Party Paradise (Parents'' Night Out) run at regular cost and welcome non-members. Activities depend on day-of availability, or pick up a coupon to redeem later. Call (805) 547-1496 for schedules and reservations.',
   'Performance Athletics Gymnastics', 'https://performanceathleticsslo.com/contact-us',
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
