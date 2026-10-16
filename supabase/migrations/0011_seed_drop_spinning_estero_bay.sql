-- Seed a one-off community submission: Drop Spinning for Beginners at Estero
-- Bay Art and Craft's Harbor Studio in Morro Bay.
--
-- Submitted through /submit by the instructor, Jenne Hiigel, for Sun Oct 18,
-- 2026. A single class sold through the studio's Shopify store, with no
-- machine-readable feed behind it, so it is seeded directly like the other
-- hand-curated rows. The id carries no source prefix, which is what marks it
-- hand-curated for the dedup priority in src/lib/supabase.ts. Re-running is
-- idempotent via the on-conflict upsert.
--
-- The source page confirms the date and 1 PM start in its title, and the
-- flyer image (DropSpinningOct182026.png) confirms Sun, Oct 18. The body copy
-- gives "Length: 3 hours" and "Location: Harbor Studio, 523 Harbor Street",
-- so the 4 PM end matches the submission. The submitter's "Estero Bay Arts
-- and Crafts" is replaced with the business's own name from its site, and the
-- venue uses the studio street address rather than the retail shop on Morro
-- Bay Blvd.
--
-- 1 PM PDT is 20:00 UTC, same calendar day, so the slug date is unambiguous.
-- It is still written as the LOCAL date for consistency with every other seed.
--
-- The description leads with a hook paragraph kept under DESCRIPTION_WORD_LIMIT
-- (50 words, see truncateWords in src/app/page.tsx) so the homepage card shows
-- it whole with no ellipsis. The second paragraph carries the submitter's own
-- copy plus the studio's minimum-enrollment note.
--
-- Run once in the Supabase SQL Editor.

insert into public.events
  (id, title, starts_at, ends_at, venue, community, description, source, source_url, category)
values
  ('drop-spinning-for-beginners-2026-10-18',
   'Drop Spinning for Beginners',
   '2026-10-18T13:00-07:00', '2026-10-18T16:00-07:00',
   'Estero Bay Art and Craft Harbor Studio, 523 Harbor Street', 'Morro Bay',
   'Learn to spin your own yarn on a drop spindle in this three-hour beginner class at Estero Bay Art and Craft''s Harbor Studio. Instructor Jenne Hiigel teaches the basics, and the $55 fee covers all materials. No experience is needed, and the class suits beginners of all levels and interests.

Take your creativity back a step from buying finished yarn to making your own. Learn the meditative rhythm of spinning, and feel the fibers flow through your fingers as they work together to create yarn for your craft projects. Classes with fewer than three students enrolled may be cancelled and fully refunded.',
   'Estero Bay Art and Craft', 'https://esterobayartandcraft.com/products/drop-spinning-for-beginners-sun-oct-18-1-00pm',
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
