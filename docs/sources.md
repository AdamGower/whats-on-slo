# What's On SLO: Master Event Source Inventory

**Geographic center:** San Luis Obispo city center (35.2828°N, 120.6596°W)
**Radius:** 25 miles
**In-scope communities:** San Luis Obispo, Los Osos, Baywood Park, Morro Bay, Cayucos, Cambria, Avila Beach, Shell Beach, Pismo Beach, Grover Beach, Arroyo Grande, Oceano, Nipomo, Atascadero, Templeton, Santa Margarita, Paso Robles, and unincorporated areas within the radius

---

## Ecosystem Assessment

The SLO-area event ecosystem is meaningfully fragmented. No single source captures more than roughly 30–40% of events within the 25-mile radius. The tourism-facing aggregators (Visit SLO, SLO CAL) cover mainstream and anchor events well but miss recurring neighborhood happenings, nonprofit fundraisers, library programs, and the active live music scene documented by hyper-local publishers like Big Big SLO and goslo.events. The north county (Paso Robles, Templeton, Atascadero) is served by an entirely separate source set from the south/coastal corridor (Pismo, Arroyo Grande, Grover Beach). Cambria and Cayucos are served largely by their own chambers. There is no existing product that aggregates across all these layers, covers the full radius consistently, and surfaces long-tail events — Los Osos garden club plant sales, Cayucos antique fairs, Baywood waterfront concerts — that define local life.

The fragmentation is sufficient to justify a dedicated aggregator. The City of San Luis Obispo's own community calendar explicitly refers users to the "SLO Happenings app" for private events, acknowledging the gap. Building one to genuine completeness requires 10–15 source integrations from day one and a second-tier expansion of 20–30 more sources. The good news: several tier-one sources offer API or structured feeds (Ticketmaster Discovery API, Bandsintown, library calendar, goslo.events RSS), so the automation stack is buildable without scraping every source by hand.

---

## Source 001 — Downtown SLO Farmers Market and Events Calendar
- **URL:** https://downtownslo.com/events
- **Type:** Downtown business association, WordPress-based calendar
- **Geography:** Downtown San Luis Obispo — Higuera Street corridor
- **Events:** Thursday Night Farmers Market; Concerts in the Plaza (summer Friday nights at Mission Plaza); Art After Dark (first Friday monthly); holiday events; downtown promotions
- **Current:** Yes — Thursday Farmers Market confirmed top-10 USA Today 2026
- **Long-tail:** No — anchor recurring events only
- **Breadth:** Narrow but indispensable
- **Noise:** Low
- **Metadata:** Strong
- **Automation:** Scrapable HTML — WordPress; The Events Calendar plugin likely; iCal export probable
- **User submissions:** No
- **Usefulness:** High for anchor recurring events
- **Extraction note:** WordPress Events Calendar; recurring events with future dates pre-populated; low scraping complexity

## Source 002 — Visit SLO (San Luis Obispo Visitors Bureau)
- **URL:** https://visitslo.com/events
- **Type:** Official city tourism bureau, curated event calendar
- **Geography:** City of SLO and immediate surroundings; some county-wide coverage
- **Events:** Concerts, festivals, performing arts, food and wine, outdoor recreation, family events, seasonal celebrations, art walks
- **Current:** Yes — 2026 events including Civic Ballet performances and Film Festival active
- **Long-tail:** No — visitor-oriented mainstream events
- **Breadth:** Broad within city; narrow on outlying communities
- **Noise:** Low
- **Metadata:** Strong
- **Automation:** Scrapable HTML — WordPress + The Events Calendar plugin; iCal export likely
- **User submissions:** Unknown — contact bureau
- **Usefulness:** High for SLO city events
- **Extraction note:** Clean WordPress markup; event detail pages likely have JSON-LD

## Source 003 — Visit SLO CAL (San Luis Obispo County Tourism)
- **URL:** https://www.slocal.com/events
- **Type:** County-level tourism organization, curated event listings
- **Geography:** All of SLO County
- **Events:** Major festivals, wine events, art and culture, outdoor recreation, food and drink, seasonal events
- **Current:** Yes — SLO Film Festival April 23–28, 2026; Central Coast Shakespeare Festival listed
- **Long-tail:** No — tourism-quality mainstream events only
- **Breadth:** Broad geographically; narrow by event type
- **Noise:** Low
- **Metadata:** Strong
- **Automation:** Scrapable HTML — WordPress, consistent structure
- **User submissions:** Unknown
- **Usefulness:** High as geographic backbone covering full county
- **Extraction note:** Standard tourism CMS; check for JSON-LD event schema

## Source 004 — New Times SLO Central Coast Events Calendar
- **URL:** https://posting.newtimesslo.com/sanluisobispo/Events
- **Type:** Alternative weekly newspaper calendar with editorial and user-submitted events
- **Geography:** All of SLO County; coverage extending to Santa Barbara County
- **Events:** Concerts, comedy, arts, performing arts, community events, film, food and drink, nonprofit fundraisers, recurring events, civic events — widest editorial scope of any media source
- **Current:** Yes — weekly Events Wire email Friday; calendar continuously updated
- **Long-tail:** Yes — primary source for events that mainstream tourism calendars miss
- **Breadth:** Indispensable — broadest editorial event coverage in county
- **Noise:** Medium
- **Metadata:** Partial to Strong
- **Automation:** Scrapable HTML — hosted community calendar platform; consistent pages
- **User submissions:** Yes — public submission, reviewed before publication
- **Usefulness:** Very high for long-tail coverage
- **Extraction note:** SaaS community calendar; consistent HTML; pagination standard

## Source 005 — KCBX Community Calendar
- **URL:** https://www.kcbx.org/community-calendar
- **Type:** Public radio station (NPR affiliate) — community-submitted, editorially reviewed
- **Geography:** SLO, Santa Barbara, southern Monterey Counties
- **Events:** Arts, entertainment, nonprofit, civic, performing arts, lectures, classes, workshops
- **Current:** Yes
- **Long-tail:** Yes — most important source for arts-adjacent and nonprofit community events
- **Breadth:** Broad; indispensable for nonprofit and cultural tier
- **Noise:** Low
- **Metadata:** Strong
- **Automation:** Scrapable HTML; category filters via URL params; RSS feed available for news
- **User submissions:** Yes — public submission; reviewed by editor; 2+ weeks lead time
- **Usefulness:** High
- **Extraction note:** CMS-based; category filtering via URL params

## Source 006 — Ticketmaster Discovery API
- **URL:** https://developer.ticketmaster.com
- **Type:** Global ticketing platform — public REST API with geographic radius search
- **Geography:** All in-scope communities; lat/long + radius supported
- **Events:** Major concerts, touring shows, performing arts, comedy, sports
- **Current:** Yes
- **Long-tail:** No
- **Breadth:** Narrow but highest reliability for ticketed events
- **Noise:** Low
- **Metadata:** Strong — full structured JSON
- **Automation:** Public REST API; free tier upon registration
- **User submissions:** No
- **Usefulness:** High — instant clean structured data
- **Extraction note:** `GET /discovery/v2/events.json?latlong=35.2828,-120.6596&radius=25&unit=miles&apikey={key}`

## Source 007 — My805Tix
- **URL:** https://my805tix.com
- **Type:** Regional ticketing platform — dominant local provider for SLO and Santa Barbara
- **Geography:** SLO and Santa Barbara counties
- **Events:** Concerts, theater, comedy, festivals, food and drink, wellness, film, sports, tours
- **Current:** Yes
- **Long-tail:** Yes — platform of choice for local arts orgs, small festivals, community events
- **Breadth:** Broad for locally produced events — indispensable
- **Noise:** Low
- **Metadata:** Strong
- **Automation:** Semi-structured / scrapable HTML — no confirmed public API; recommend partnership (info@my805tix.com)
- **User submissions:** Yes — organizers create events
- **Usefulness:** Very high
- **Extraction note:** Scrape listing pages by region; consider partnership before scraper

## Source 008 — goslo.events
- **URL:** https://goslo.events
- **Type:** Independent local event aggregator — automated venue scraping
- **Geography:** SLO, Los Osos, Morro Bay, Pismo Beach, Arroyo Grande, Grover Beach, Atascadero, Paso Robles
- **Events:** Primarily live music and concerts at bars, breweries, venues
- **Current:** Yes
- **Long-tail:** Yes — small-venue live music
- **Breadth:** Narrow (music) but valuable
- **Noise:** Low to Medium — automated; times occasionally inaccurate
- **Metadata:** Partial
- **Automation:** RSS/Atom feed at goslo.events/feed; email digest also
- **User submissions:** No — fully automated
- **Usefulness:** Medium-high; RSS makes ingestion simple
- **Extraction note:** Subscribe to RSS feed; cross-validate times against venue pages

## Source 009 — Big Big SLO
- **URL:** https://www.bigbigslo.com
- **Type:** Independent local music calendar and media brand
- **Geography:** SLO County venues
- **Events:** Live music, concerts at venues and wineries, brewery events; some comedy and theater
- **Current:** Yes
- **Long-tail:** Yes — small/medium live music
- **Breadth:** Narrow but indispensable for music
- **Noise:** Low
- **Metadata:** Partial to Strong
- **Automation:** Scrapable HTML; built on Muzeek platform
- **User submissions:** Yes — free at bigbigslo.com/webcalendar
- **Usefulness:** High for live music completeness
- **Extraction note:** Muzeek-based; check Muzeek for feed/API access

## Source 010 — Central Coast Rocks
- **URL:** https://www.centralcoastrocks.com
- **Type:** Independent live music calendar — community-driven, free listing
- **Geography:** Ventura to Paso Robles; city-filtered pages
- **Events:** Live music, open mics, karaoke, comedy; small venues
- **Current:** Yes
- **Long-tail:** Yes — recurring small-venue events
- **Breadth:** Narrow
- **Noise:** Low
- **Metadata:** Partial
- **Automation:** Scrapable HTML — simple table/list; city-filtered pages
- **User submissions:** Yes — free email submission
- **Usefulness:** Supplementary; high for recurring small-venue events
- **Extraction note:** Simple HTML; city pages scrapable; low complexity

## Source 011 — Fremont Theater SLO
- **URL:** https://www.fremontslo.com (ticketing via Prekindle)
- **Type:** Historic concert venue — primary mid-size venue in SLO (900 cap)
- **Geography:** Downtown SLO
- **Events:** Concerts, comedy, touring acts, DJ events, film screenings
- **Current:** Yes — full May–August 2026 calendar
- **Long-tail:** No — but high consumer demand
- **Breadth:** Narrow but high-demand
- **Noise:** Low
- **Metadata:** Strong
- **Automation:** Prekindle has documented open API; also on Ticketmaster, Songkick, Bandsintown
- **User submissions:** No
- **Usefulness:** High
- **Extraction note:** Prefer Prekindle API or Ticketmaster cross-validation

## Source 012 — Vina Robles Amphitheatre
- **URL:** https://vinaroblesamphitheatre.com/concerts
- **Type:** Outdoor amphitheater — major concert venue (3,200 cap)
- **Geography:** Paso Robles
- **Events:** Major touring concerts; full 2026 season published
- **Current:** Yes
- **Long-tail:** No
- **Breadth:** Narrow but high-demand north county
- **Noise:** Low
- **Metadata:** Strong
- **Automation:** Live Nation venue; pull via Ticketmaster Discovery API or Songkick
- **User submissions:** No
- **Usefulness:** High
- **Extraction note:** Best via Ticketmaster API

## Source 013 — California Mid-State Fair
- **URL:** https://www.midstatefair.com/event-center/calendar.php
- **Type:** Annual fair + year-round event center
- **Geography:** Paso Robles Event Center
- **Events:** Annual fair July 15–26 2026 (80th anniversary); concert series; year-round shows
- **Current:** Yes — full 2026 lineup announced
- **Long-tail:** No — but irreplaceable for category
- **Breadth:** Narrow but extreme demand July–August
- **Noise:** Low
- **Metadata:** Strong
- **Automation:** Scrapable HTML / Ticketmaster API
- **User submissions:** No
- **Usefulness:** High during fair season
- **Extraction note:** Fair calendar HTML consistent; concerts via Ticketmaster API

## Source 014 — Performing Arts Center San Luis Obispo (PAC SLO)
- **URL:** https://www.pacslo.org/events
- **Type:** Major performing arts venue — anchor for Cal Poly Arts, SLO Symphony, Opera SLO, Civic Ballet
- **Geography:** San Luis Obispo
- **Events:** Broadway tours, symphony, opera, ballet, comedy, family shows, Cal Poly Arts season
- **Current:** Yes
- **Long-tail:** No — anchor only
- **Breadth:** Narrow but anchor-level
- **Noise:** Low
- **Metadata:** Strong
- **Automation:** Scrapable HTML; iCal export likely; consistent structure
- **User submissions:** No
- **Usefulness:** High
- **Extraction note:** Event schema markup likely present

## Source 015 — Avila Beach Resort Concert Series
- **URL:** https://events.avilabeachresort.com (also songkick.com/venues/17026)
- **Type:** Venue concert series — oceanfront outdoor
- **Geography:** Avila Beach
- **Events:** Concert series — Billy Currington May 7, Iration June 28, Modest Mouse Oct 22, etc.
- **Current:** Yes — full 2026 season
- **Long-tail:** No
- **Breadth:** Narrow (single venue series)
- **Noise:** Low
- **Metadata:** Strong via Songkick/Ticketmaster
- **Automation:** Songkick venue API (ID 17026) or Ticketmaster
- **User submissions:** No
- **Usefulness:** High — beloved unique venue
- **Extraction note:** Pull via Songkick venue calendar API

## Source 016 — Live at the Lighthouse Concert Series (Point San Luis Lighthouse)
- **URL:** https://visitavilabeach.com/events
- **Type:** Venue event series
- **Geography:** Avila Beach — Point San Luis Lighthouse
- **Events:** 8 intimate outdoor concerts in 2026; Aug 8, Sep 12 confirmed
- **Current:** Yes
- **Long-tail:** Yes — appear on no other aggregator
- **Breadth:** Very narrow but high distinctiveness
- **Noise:** Low
- **Metadata:** Partial
- **Automation:** Scrapable HTML — WordPress
- **User submissions:** No
- **Usefulness:** Medium — low volume but unique
- **Extraction note:** Structured upcoming events section

## Source 017 — Visit Avila Beach Events Calendar
- **URL:** https://visitavilabeach.com/events
- **Type:** Tourism org — Avila Beach community events
- **Geography:** Avila Beach and Avila Valley
- **Events:** Avila Beach Farmers Market (1st Friday 4–8), Science After Dark, aquarium programs, concert series
- **Current:** Yes
- **Long-tail:** Yes — Avila community events
- **Breadth:** Narrow
- **Noise:** Low
- **Metadata:** Partial to Strong
- **Automation:** Scrapable HTML — WordPress
- **User submissions:** Unknown
- **Usefulness:** Medium — fills Avila gap
- **Extraction note:** Consistent event card layout

## Source 018 — SLO Coast Wine Member Events Calendar
- **URL:** https://slocoastwine.com/events
- **Type:** Wine industry association
- **Geography:** SLO Coast wine country (south county / Edna Valley / Avila)
- **Events:** Winery events, harvest, dinners, Sunset Series, Rosé the SLO Way
- **Current:** Yes
- **Long-tail:** Yes — south county wineries underrepresented elsewhere
- **Breadth:** Narrow (wine, south county)
- **Noise:** Low
- **Metadata:** Partial
- **Automation:** Scrapable HTML — consistent cards
- **User submissions:** Yes — member wineries
- **Usefulness:** Medium-high
- **Extraction note:** Two-step extraction; cards link to winery pages

## Source 019 — Paso Robles Wine Country Alliance Consumer Events
- **URL:** https://pasowine.com/consumer_events
- **Type:** Wine industry association
- **Geography:** Paso Robles wine country
- **Events:** Paso Wine Fest May 15–17 2026, BlendFest, Sparkling Paso, Rhône Rangers, harvest events
- **Current:** Yes — 2026 calendar published
- **Long-tail:** Yes
- **Breadth:** Narrow but indispensable for wine tourism
- **Noise:** Low
- **Metadata:** Strong
- **Automation:** Scrapable HTML; consistent format
- **User submissions:** Yes — member wineries
- **Usefulness:** High
- **Extraction note:** Paginated by month; straightforward

## Source 020 — Alex Madonna Expo Center Events Calendar
- **URL:** https://www.madonnainn.com/calendar
- **Type:** Multi-purpose venue (2,600 cap)
- **Geography:** San Luis Obispo
- **Events:** SLO Craft Beer Fest, concerts, SLO Chamber Expo, consignment sales, antique shows
- **Current:** Yes — full 2026 calendar with iCal per event
- **Long-tail:** Yes — pop-ups and trade shows
- **Breadth:** Medium — diverse
- **Noise:** Low to Medium
- **Metadata:** Strong — iCal links per event
- **Automation:** Scrapable HTML / iCal — per-event Google Calendar and iCal links
- **User submissions:** No
- **Usefulness:** High
- **Extraction note:** Per-event iCal links; parse .ics for structured data

## Source 021 — SLO County Arts Community Calendar
- **URL:** https://slocountyarts.org/calendar-submissions
- **Type:** County arts council
- **Geography:** All of SLO County
- **Events:** Visual arts, performing arts, gallery shows, art walks, open studios, lectures
- **Current:** Yes — Art After Dark monthly; Open Studios Art Tour Oct 2026
- **Long-tail:** Yes — gallery openings, studio events, artist lectures
- **Breadth:** Narrow but indispensable for arts
- **Noise:** Low
- **Metadata:** Partial to Strong
- **Automation:** Scrapable HTML — WordPress
- **User submissions:** Yes
- **Usefulness:** High
- **Extraction note:** Standard WordPress calendar

## Source 022 — SLO County Public Libraries Event Calendar
- **URL:** https://sanluisobispo.librarycalendar.com
- **Type:** Public library system
- **Geography:** 15+ branch libraries countywide
- **Events:** Youth programs, STEM, crafts, author talks, book clubs, tech, family events
- **Current:** Yes
- **Long-tail:** Yes — systematically undercovered elsewhere
- **Breadth:** Broad geographically; narrow by type
- **Noise:** Low
- **Metadata:** Strong
- **Automation:** SaaS librarycalendar.com platform; URL parameter filters; `/events/feed/html` endpoint
- **User submissions:** No
- **Usefulness:** Medium-high for families
- **Extraction note:** Branch + age group + program type filters

## Source 023 — Live Oak Music Festival
- **URL:** https://liveoakfest.org (ticketing my805tix.com/e/liveoak2026)
- **Type:** Annual festival — 38th annual; KCBX primary fundraiser
- **Geography:** El Chorro Regional Park, SLO
- **Events:** 3-day festival June 19–21 2026; bluegrass, soul, Americana, world; 3 stages
- **Current:** Yes
- **Long-tail:** Yes — community-significant
- **Breadth:** Single event
- **Noise:** Low
- **Metadata:** Strong via My805Tix
- **Automation:** Scrapable; also via My805Tix and KCBX
- **User submissions:** No
- **Usefulness:** High

## Source 024 — Festival Mozaic
- **URL:** https://www.festivalmozaic.org
- **Type:** Annual summer classical and multi-genre festival
- **Geography:** Multiple venues countywide
- **Events:** 15+ main stage events July 15–Aug 1 2026; orchestral, chamber, free midday concerts
- **Current:** Yes
- **Long-tail:** Yes — free Community Midday Concerts
- **Breadth:** Narrow but multi-venue
- **Noise:** Low
- **Metadata:** Strong
- **Automation:** Scrapable HTML — WordPress
- **User submissions:** No
- **Usefulness:** High during July–August

## Source 025 — Edible San Luis Obispo Events Coverage
- **URL:** https://ediblesanluisobispo.com/category/events
- **Type:** Food/travel publication — seasonal events editorial
- **Geography:** All of SLO County
- **Events:** Wine and food festivals, winery dinners, Pacific Pour, Camp CASS, Chef's Counter
- **Current:** Yes
- **Long-tail:** Yes — restaurant + winery collaborations
- **Breadth:** Narrow (food/wine)
- **Noise:** Low
- **Metadata:** Partial — embedded in narrative
- **Automation:** Semi-structured; NLP extraction needed
- **User submissions:** Sponsorships and press releases
- **Usefulness:** Medium-high for food/wine
- **Extraction note:** Article format; scrape `/category/events` and parse text

## Source 026 — Avila Beach Farmers Market
- **URL:** https://visitavilabeach.com/events
- **Type:** Weekly recurring community market
- **Geography:** Avila Beach Promenade
- **Events:** Friday 4–8 PM; produce, artisan crafts, local cuisine
- **Current:** Yes — May–November
- **Long-tail:** Yes
- **Breadth:** Single recurring event
- **Noise:** Low
- **Metadata:** Partial
- **Automation:** Scrapable HTML
- **User submissions:** No
- **Usefulness:** Medium
- **Extraction note:** Generate future Friday dates in season

## Source 027 — Estero Bay News Events and Activities
- **URL:** https://esterobaynews.com/events-activities
- **Type:** Independent local news
- **Geography:** Morro Bay, Los Osos, Baywood Park, Cayucos
- **Events:** Community events, concerts, fundraisers, civic, library, garden club, art shows
- **Current:** Yes — bi-weekly
- **Long-tail:** Yes — primary discovery for north coastal corridor
- **Breadth:** Narrow geographically but indispensable
- **Noise:** Low
- **Metadata:** Partial — narrative format
- **Automation:** Semi-structured; NLP needed
- **User submissions:** Editorial
- **Usefulness:** High
- **Extraction note:** URL pattern `/events-activities/events-and-activities-[date]`; NLP parsing required

## Source 028 — Visit Morro Bay Events Calendar
- **URL:** https://www.morrobay.org/events
- **Type:** Morro Bay tourism organization
- **Geography:** Morro Bay
- **Events:** Festivals, concerts, outdoor, food/wine, seasonal; Bird Festival (264 events Jan), Fish/Farmer's Market, Car Show
- **Current:** Yes
- **Long-tail:** Yes
- **Breadth:** Narrow
- **Noise:** Low
- **Metadata:** Partial to Strong
- **Automation:** Scrapable HTML — WordPress
- **User submissions:** Unknown
- **Usefulness:** Medium-high

## Source 029 — Cayucos Chamber of Commerce Community Calendar
- **URL:** https://www.cayucoschamber.com/calendar
- **Type:** Chamber of commerce
- **Geography:** Cayucos
- **Events:** Antique Street Faire, Polar Bear Dip, Sea Glass Festival, art events, weekly farmers market
- **Current:** Yes — Spring Antique Street Faire May 3 2026
- **Long-tail:** Yes
- **Breadth:** Very narrow
- **Noise:** Low
- **Metadata:** Partial
- **Automation:** Scrapable HTML — basic
- **User submissions:** Yes
- **Usefulness:** Medium

## Source 030 — Paso Robles Main Street / Downtown Paso Events
- **URL:** https://pasoroblesdowntown.org/downtown-events
- **Type:** Downtown business association
- **Geography:** Downtown Paso Robles
- **Events:** Vintage Rendezvous, Art After Dark Paso, downtown festivals, Third Saturday, Comic Book Expo
- **Current:** Yes
- **Long-tail:** Yes
- **Breadth:** Narrow
- **Noise:** Low
- **Metadata:** Partial
- **Automation:** Scrapable HTML — WordPress
- **User submissions:** Unknown
- **Usefulness:** Medium-high

## Source 031 — City of Atascadero Events and Recreation Calendar
- **URL:** https://www.atascadero.org/events-directory-last
- **Type:** City government
- **Geography:** Atascadero
- **Events:** Charles Paddock Zoo events, Wednesday Farmers Market, Saturdays in the Park summer concerts, Downtown Summer Sizzle
- **Current:** Yes
- **Long-tail:** Yes
- **Breadth:** Narrow
- **Noise:** Low
- **Metadata:** Partial to Strong
- **Automation:** Scrapable HTML — city CMS
- **User submissions:** Unknown
- **Usefulness:** Medium

## Source 032 — City of Grover Beach Summer Concert Series
- **URL:** https://www.groverbeach.org/calendar.aspx
- **Type:** City CMS (CivicEngage)
- **Geography:** Grover Beach
- **Events:** Stone Soup Music Festival, Sunday Summer Concert Series, recreation
- **Current:** Yes
- **Long-tail:** Yes
- **Breadth:** Very narrow
- **Noise:** Low
- **Metadata:** Partial
- **Automation:** Scrapable HTML / iCal
- **User submissions:** No
- **Usefulness:** Medium

## Source 033 — City of Pismo Beach + CVB Events
- **URL:** https://www.pismobeach.org/calendar.aspx; pismobeach.org/1011/CVB-Events
- **Type:** City CMS + CVB
- **Geography:** Pismo Beach and Shell Beach
- **Events:** July 4th, Classic Car Show, Clam Festival, Marching Band Review
- **Current:** Yes
- **Long-tail:** Yes
- **Breadth:** Narrow
- **Noise:** Low
- **Metadata:** Partial
- **Automation:** Scrapable HTML / iCal — CivicEngage
- **User submissions:** No
- **Usefulness:** Medium

## Source 034 — Bandsintown API
- **URL:** https://www.bandsintown.com (API rest.bandsintown.com)
- **Type:** Global concert discovery — artist-centric
- **Geography:** All in-scope
- **Events:** Concerts and live music with ticketed admission
- **Current:** Yes
- **Long-tail:** No
- **Breadth:** Narrow (concerts)
- **Noise:** Low
- **Metadata:** Strong JSON
- **Automation:** Public API; app_id registration; review ToS for commercial use
- **User submissions:** Yes (artist teams)
- **Usefulness:** Supplementary to Ticketmaster
- **Extraction note:** `GET /events?app_id=X&location=San+Luis+Obispo,CA`

## Source 035 — Songkick API Venue Calendar Search
- **URL:** https://www.songkick.com (API api.songkick.com)
- **Type:** Global concert tracking — venue/artist
- **Geography:** All in-scope venues; venue IDs known
- **Events:** Concerts and performing arts (ticketed)
- **Current:** Yes
- **Long-tail:** No
- **Breadth:** Narrow
- **Noise:** Low
- **Metadata:** Strong JSON
- **Automation:** Public REST API; key required
- **User submissions:** No
- **Usefulness:** Supplementary; cross-validation
- **Extraction note:** `GET /api/3.0/venues/{id}/calendar.json?apikey={key}`

## Source 036 — NightOut
- **URL:** https://nightout.com
- **Type:** Event discovery and ticketing aggregator
- **Geography:** SLO area
- **Events:** Concerts, comedy, nightlife
- **Current:** Yes
- **Long-tail:** Partial
- **Breadth:** Medium
- **Noise:** Low to Medium
- **Metadata:** Partial
- **Automation:** Scrapable HTML
- **User submissions:** Unknown
- **Usefulness:** Supplementary; cross-validate

## Source 037 — Meetup SLO-Area Active Groups
- **URL:** https://www.meetup.com
- **Type:** Social event and community group platform
- **Geography:** SLO area
- **Events:** Trivia, hiking, volleyball, beach days, bonfires, game nights, networking
- **Current:** Yes
- **Long-tail:** Yes — recurring social/community events
- **Breadth:** Narrow (Meetup-platform only)
- **Noise:** Medium — some members-only
- **Metadata:** Partial
- **Automation:** Semi-structured; ToS restricts scraping; embed widgets are an alternative
- **User submissions:** Yes
- **Usefulness:** Medium
- **Extraction note:** Public group event pages; review ToS carefully

## Source 038 — SLO Botanical Garden
- **URL:** https://slobg.org/calendar-of-events
- **Type:** Non-profit botanical garden
- **Geography:** SLO
- **Events:** Book clubs, tours, watercolor workshops, Family Free Days (Faerie Festival), birding, volunteers
- **Current:** Yes
- **Long-tail:** Yes
- **Breadth:** Very narrow
- **Noise:** Low
- **Metadata:** Partial
- **Automation:** Scrapable HTML — WordPress
- **User submissions:** No
- **Usefulness:** Medium

## Source 039 — South County Chambers of Commerce
- **URL:** https://business.southcountychambers.com/events/calendar
- **Type:** Regional chamber
- **Geography:** Arroyo Grande, Grover Beach, Oceano, Pismo Beach, Nipomo, Shell Beach
- **Events:** Community events, festivals, fundraisers, civic, recreation
- **Current:** Yes
- **Long-tail:** Yes
- **Breadth:** Narrow geographically
- **Noise:** Low
- **Metadata:** Partial
- **Automation:** Scrapable HTML
- **User submissions:** Unknown
- **Usefulness:** Medium-high for south county

## Source 040 — KSBY "6 Things to Do" Weekly
- **URL:** https://www.ksby.com/news/local-news/in-your-community/6-things-to-do
- **Type:** Local TV news editorial events feature
- **Geography:** Central Coast
- **Events:** Concerts, festivals, outdoor, family, civic, arts, wine — editorial selection
- **Current:** Yes — Friday weekly
- **Long-tail:** Yes — editorial discovery
- **Breadth:** Broad selection of ~6/week
- **Noise:** Low
- **Metadata:** Partial — narrative
- **Automation:** Semi-structured; NLP extraction
- **User submissions:** Editorial
- **Usefulness:** Supplementary

## Source 041 — Facebook Events SLO County (WALLED GARDEN — FLAG)
- **URL:** https://www.facebook.com/events
- **Automation:** WALLED GARDEN / MANUAL ONLY — Graph API event access removed 2018; scraping violates ToS and is blocked
- **Usefulness:** Cannot be automated; manual or user-submission path only
- **Extraction note:** Flag as manual-only; consider in-app user submission for FB events; do not build scraper

## Source 042 — Instagram SLO Event Discovery (WALLED GARDEN — FLAG)
- **URL:** https://www.instagram.com
- **Automation:** WALLED GARDEN / MANUAL ONLY
- **Usefulness:** Cannot be automated; manual editorial monitoring channel only
- **Extraction note:** Manual monitoring of key accounts; do not build scraper

## Source 043 — PredictHQ Events API (commercial)
- **URL:** https://www.predicthq.com
- **Type:** Commercial event aggregation; 19 categories
- **Geography:** Global; SLO tracked
- **Events:** Concerts, festivals, performing arts, community, sports, conferences, expos, academic, weather
- **Current:** Yes
- **Long-tail:** Partial
- **Breadth:** Very broad
- **Noise:** Low — impact-ranked
- **Metadata:** Strong, enriched
- **Automation:** Commercial REST API; Python client; free tier for eval; paid for prod
- **User submissions:** No
- **Usefulness:** High supplementary; evaluate as paid data partner

## Source 044 — RunSignup Race Search API
- **URL:** https://runsignup.com/Rest/races (endpoint); https://runsignup.com (site)
- **Type:** Race registration platform — public REST API
- **Geography:** All in-scope communities; US zipcode + radius search (93401, 25 mi)
- **Events:** Running races, triathlons, bike races, walks — e.g. City to the Sea Half, Morro Bay Triathlon, Rock to Pier Run, Ryan's Ranch Run
- **Current:** Yes — full 2026 calendar
- **Long-tail:** Yes — local races appear on no other aggregator we ingest
- **Breadth:** Narrow (races only) but the primary feeder for the Outdoors category
- **Noise:** Low — ~5 races in radius; well-structured
- **Metadata:** Strong — JSON with per-event start/end times, IANA timezone, full address, logo
- **Automation:** Public REST API; no API key required for race search; `events=T` embeds event times so one request suffices
- **User submissions:** No (organizers list their own races on the platform)
- **Usefulness:** High for the Outdoors category
- **Extraction note:** `GET /Rest/races?format=json&zipcode=93401&radius=25&events=T&start_date=&end_date=`. One row per race (earliest event start → latest end). Implemented in `scripts/scrape-runsignup.mjs` with `rsu-` id prefix.

---

## MVP Recommendation List (Initial 13 Sources)

1. **Ticketmaster Discovery API** — zero-scraping; lat/long radius query; highest demand events
2. **My805Tix** — most important local platform; locally produced events
3. **New Times SLO Community Calendar** — long-tail; hundreds/month
4. **KCBX Community Calendar** — best for arts/nonprofit/community
5. **Big Big SLO** — small/mid-venue live music
6. **goslo.events RSS** — fastest integration; music aggregator
7. **SLO CAL** — county-wide tourism backbone
8. **Visit SLO** — city-level backbone
9. **Madonna Inn / Alex Madonna Expo Center** — per-event iCal; multi-use venue
10. **SLO County Library Calendar** — structured platform; family programming
11. **Eventbrite (geographic search)** — wide independent organizer coverage; deduplicate
12. **Vina Robles Amphitheatre** — via Ticketmaster API; north county anchor
13. **SLO Coast Wine + Paso Robles Wine Country Alliance** — wine ecosystem

---

## Indispensable Long-Tail Sources

- **Estero Bay News** — only systematic coverage of Morro Bay, Los Osos, Baywood Park, Cayucos community level
- **Central Coast Rocks** — only source for recurring small-venue music (karaoke, open mics, residencies)
- **goslo.events** — high freshness; catches venue-site announcements
- **Los Osos Chamber of Commerce** — Barefoot Concerts on the Green, Earth Day, neighborhood
- **Cayucos Chamber of Commerce** — without it Cayucos is empty
- **SLO Botanical Garden** — exact target demographic
- **Meetup SLO Groups** — recurring social events found nowhere else

---

## Broad but Noisy

- **Eventbrite** — high volume + uniqueness; manage noise via geo + dedupe vs Ticketmaster
- **NightOut** — gap-fill; some Ticketmaster overlap
- **New Times Community Calendar** — high volume; volume is itself a feature

---

## Rejected / Excluded Sources

- seecalifornia.com/events/morro-bay-events — stale 2011 events
- avilabeachpier.com/activities — static, no calendar
- pleasantvalleywinetrail.com — geographic edge
- tripadvisor.com events — no structured calendar
- morrobayinbloom.org/events — narrow garden volunteers only
- centralcoastwinecomp.com — duplicative for consumers

---

## Sample 7-Day Event Calendar (April 28 – May 4, 2026)

- **Downtown SLO Thursday Night Farmers Market** — Thu May 1, 6–9 PM, Higuera St — recurring; iCal likely
- **Science After Dark, Central Coast Aquarium** — Mon Apr 28, 5:30–8 PM, Avila Beach — visitavilabeach.com
- **Avila Beach Farmers Market** — Fri May 1, 4–8 PM, Avila Promenade — recurring weekly
- **Billy Currington at Avila Beach Golf Resort** — Thu May 7, 5 PM — Songkick venue 17026 / Ticketmaster
- **Cayucos Spring Antique Street Faire** — Sat May 3, all day, Ocean Ave — annual recurring
- **Art After Dark First Friday** — Fri May 2, 5–8 PM, Downtown SLO — triple-source confirmation
- **Vintage Rendezvous, Paso Robles** — Sat Apr 25, Downtown City Park — annual
- **Paso Wine Fest weekend kickoff** — May 15–17, Downtown Paso + member wineries
