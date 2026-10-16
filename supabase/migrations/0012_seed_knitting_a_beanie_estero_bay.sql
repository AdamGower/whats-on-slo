-- Seed a one-off community submission: Knitting a Beanie at Estero Bay Art
-- and Craft's Harbor Studio in Morro Bay.
--
-- Submitted through /submit by the instructor, Jenne Hiigel, for Sun Nov 15,
-- 2026. A single class sold through the studio's Shopify store, with no
-- machine-readable feed behind it, so it is seeded directly like the other
-- hand-curated rows. The id carries no source prefix, which is what marks it
-- hand-curated for the dedup priority in src/lib/supabase.ts. Re-running is
-- idempotent via the on-conflict upsert.
--
-- The source page confirms the date and 10 AM start in its title, and the
-- flyer image (KnitBeanieNov152026.png) reads "Knitting a Beanie, Sun, Nov
-- 15", matching the submitted title. The store's product title is "Knit a
-- Beanie". The body copy gives "Length: 3 hours" and "Location: Harbor Studio,
-- 523 Harbor Street", so the 1 PM end matches the submission. Unlike the drop
-- spinning class, materials are NOT provided and the class has a knitting
-- prerequisite; the description says both so nobody turns up empty-handed.
--
-- Nov 15 falls after the Nov 1 DST change, so the offset is -08:00 (PST).
-- 10 AM PST is 18:00 UTC, same calendar day, so the slug date is unambiguous.
--
-- The description leads with a hook paragraph kept under DESCRIPTION_WORD_LIMIT
-- (50 words, see truncateWords in src/app/page.tsx) so the homepage card shows
-- it whole with no ellipsis. The second paragraph carries the submitter's own
-- copy, the materials list and the studio's minimum-enrollment note.
--
-- Run once in the Supabase SQL Editor.

insert into public.events
  (id, title, starts_at, ends_at, venue, community, description, source, source_url, category)
values
  ('knitting-a-beanie-2026-11-15',
   'Knitting a Beanie',
   '2026-11-15T10:00-08:00', '2026-11-15T13:00-08:00',
   'Estero Bay Art and Craft Harbor Studio, 523 Harbor Street', 'Morro Bay',
   'Learn to knit in the round and make a cozy beanie in this three-hour class at Estero Bay Art and Craft''s Harbor Studio with instructor Jenne Hiigel. The class costs $40. You should already know how to cast on, knit, purl and cast off, and you bring your own materials.

Cooler weather is coming. Be prepared to keep yourself and your loved ones warm with a cozy knitted beanie. You''ll learn how to use both double-point and circular needles to achieve seamless knitting. The pattern is knit from the top down, so all the shaping comes first, and the cuff is a simple rib stitch.

Bring 4 oz of worsted weight yarn (about 220 yards), plus size 9 needles (or the size that gets a gauge of about 4.5 stitches per inch) in both a 16-inch circular and a set of 7-inch double-points. Classes with fewer than three students enrolled may be cancelled and fully refunded.',
   'Estero Bay Art and Craft', 'https://esterobayartandcraft.com/products/knit-a-beanie-sun-nov-15-10-00am',
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
