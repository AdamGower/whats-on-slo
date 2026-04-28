-- Phase 2: events table + public read policy + seed data.
-- Run once in the Supabase SQL Editor.

create table if not exists public.events (
  id text primary key,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue text not null,
  community text not null,
  description text not null,
  source text not null,
  source_url text not null,
  category text not null check (
    category in ('Music', 'Food & Drink', 'Arts', 'Community', 'Family', 'Outdoors')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_starts_at_idx on public.events (starts_at);

alter table public.events enable row level security;

drop policy if exists "Public read access" on public.events;
create policy "Public read access"
  on public.events
  for select
  to anon, authenticated
  using (true);

insert into public.events
  (id, title, starts_at, ends_at, venue, community, description, source, source_url, category)
values
  ('science-after-dark-2026-04-28',
   'Science After Dark',
   '2026-04-28T17:30-07:00', '2026-04-28T20:00-07:00',
   'Central Coast Aquarium', 'Avila Beach',
   'An evening of marine science, hands-on exhibits, and after-hours access to the aquarium''s tanks and touch pools.',
   'Visit Avila Beach', 'https://visitavilabeach.com/events',
   'Family'),
  ('downtown-slo-farmers-2026-04-30',
   'Thursday Night Farmers Market',
   '2026-04-30T18:00-07:00', '2026-04-30T21:00-07:00',
   'Higuera Street', 'Downtown San Luis Obispo',
   'Higuera Street closes for the weekly market: produce, food vendors, live music, and barbecue. Top-ten farmers market in the country per USA Today.',
   'Downtown SLO', 'https://downtownslo.com/events',
   'Community'),
  ('avila-farmers-market-2026-05-01',
   'Avila Beach Farmers Market',
   '2026-05-01T16:00-07:00', '2026-05-01T20:00-07:00',
   'Avila Beach Promenade', 'Avila Beach',
   'Weekly oceanfront market with fresh produce, artisan crafts, and prepared food from Central Coast vendors.',
   'Visit Avila Beach', 'https://visitavilabeach.com/events',
   'Food & Drink'),
  ('art-after-dark-2026-05-01',
   'Art After Dark — First Friday',
   '2026-05-01T17:00-07:00', '2026-05-01T20:00-07:00',
   'Galleries throughout Downtown', 'San Luis Obispo',
   'Free, self-guided gallery walk on the first Friday of every month. Working artists, open studios, light refreshments at participating venues.',
   'SLO County Arts', 'https://slocountyarts.org/experience-aad',
   'Arts'),
  ('cayucos-antique-faire-2026-05-02',
   'Cayucos Spring Antique Street Faire',
   '2026-05-02T09:00-07:00', '2026-05-02T17:00-07:00',
   'Ocean Avenue', 'Cayucos',
   'Vendors line Ocean Avenue with antiques, vintage clothing, and collectibles. Held twice a year — the spring edition draws regional crowds.',
   'Cayucos Chamber of Commerce', 'https://www.cayucoschamber.com/calendar',
   'Community'),
  ('billy-currington-2026-05-07',
   'Billy Currington',
   '2026-05-07T17:00-07:00', null,
   'Avila Beach Golf Resort', 'Avila Beach',
   'Country touring artist headlines the 2026 Avila Beach Resort concert series. Outdoor oceanfront venue.',
   'Songkick / Ticketmaster', 'https://events.avilabeachresort.com',
   'Music'),
  ('paso-wine-fest-2026-05-15',
   'Paso Wine Fest — Grand Tasting Weekend',
   '2026-05-15T12:00-07:00', '2026-05-17T18:00-07:00',
   'Downtown City Park & member wineries', 'Paso Robles',
   'Three days of tasting events across Paso wine country, anchored by the Saturday Grand Tasting in Downtown City Park. Member wineries host satellite events.',
   'Paso Robles Wine Country Alliance', 'https://pasowine.com/consumer_events',
   'Food & Drink'),
  ('live-oak-festival-2026-06-19',
   'Live Oak Music Festival',
   '2026-06-19T16:00-07:00', '2026-06-21T22:00-07:00',
   'El Chorro Regional Park', 'San Luis Obispo',
   'Bluegrass, soul, Americana, and world music across three stages. KCBX''s annual fundraiser, in its 38th year. Camping available.',
   'My805Tix', 'https://my805tix.com/e/liveoak2026',
   'Music')
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
