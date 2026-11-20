-- Seed a one-off community submission: The Vintage Vase Marketplace (Holiday
-- Edition) at Camp Arroyo Grande.
--
-- Submitted through /submit by Melissa Walker-Scott for Sun Dec 13, 2026,
-- 10 AM to 4 PM. A single market with no machine-readable feed behind it, so
-- it is seeded directly like the other hand-curated rows. The id carries no
-- source prefix, which is what marks it hand-curated for the dedup priority
-- in src/lib/dedup.ts. Re-running is idempotent via the on-conflict upsert.
--
-- The submitted link, "https://www.vintagevasemarketplace", has no top-level
-- domain, and vintagevasemarketplace.com is a "Launching Soon" placeholder
-- with a contact form and nothing about the event. The detail lives in the
-- market's Instagram flyer (post Dfui6DFC8ue, Nov 14 2026): "Vintage Vase
-- Marketplace, Local Artisan & Vintage Event, Sunday December 13th, 10-4 PM,
-- gifts, fresh flowers & food, at Camp Arroyo Grande, 250 Wesley Street (Go up
-- the hill!)". Date, hours and venue match the submission. The caption calls
-- it the market's last event of 2026. That post is the source link.
--
-- No other row covers Dec 13 at Camp Arroyo Grande. The city's tree lighting
-- in the Village the same day is a different event.
--
-- Dec 13 is in PST (-08:00). 10 AM PST is 18:00 UTC, same calendar day, so the
-- slug date is unambiguous.
--
-- The description leads with a hook paragraph of 41 words, under
-- DESCRIPTION_WORD_LIMIT (50, checked with truncateWords in
-- src/lib/event-format.ts) so the card shows it whole with no ellipsis.
--
-- Update, Nov 20: the organizer emailed the flyer as the photo and asked for
-- her Instagram as the link. The photo is served from public/events/
-- (resized to 1000px wide); the link is now her Instagram profile rather than
-- the single flyer post.
--
-- Run once in the Supabase SQL Editor.

insert into public.events
  (id, title, starts_at, ends_at, venue, community, description, source, source_url, category, image_url)
values
  ('the-vintage-vase-marketplace-holiday-edition-2026-12-13',
   'The Vintage Vase Marketplace (Holiday Edition)',
   '2026-12-13T10:00-08:00', '2026-12-13T16:00-08:00',
   'Camp Arroyo Grande, 250 Wesley Street', 'Arroyo Grande',
   'The Vintage Vase Marketplace closes out its 2026 season with a holiday market at Camp Arroyo Grande, up the hill from the Village. Local makers, artisans and bakers bring gifts, jewelry, vintage finds and collectibles, plus fresh cut flowers and arrangements.

There will be a hot chocolate bar and plenty of food. Follow @vintagevasemarketplace on Instagram for updates, or message the organizers there if you would like to join the vendor list for 2027.',
   'The Vintage Vase Marketplace', 'https://www.instagram.com/vintagevasemarketplace/',
   'Community',
   'https://whatsonslo.com/events/the-vintage-vase-marketplace-holiday-edition-2026-12-13.jpg')
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
  image_url = excluded.image_url,
  updated_at = now();
