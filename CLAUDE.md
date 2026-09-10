@AGENTS.md

# whats-on-slo

Local events aggregator for San Luis Obispo County. Next.js on Vercel,
Supabase for data. Scrapers pull from Visit SLO, BigBigSLO, the county
library calendar, Ticketmaster and others every 6 hours. Members of the
public submit events through a form; those land in `submissions` and are
published by hand.

## Publishing a submitted event

Work through this in order. Don't insert anything until the checks pass.

1. **Fetch the source URL.** Submitters get details wrong and their own
   pages sometimes contradict themselves. Trust the body copy of the
   source page over both the submission form and the page's own
   calendar-plugin headers, which are often wrong.
2. **Confirm the link is worth publishing.** If it doesn't describe the
   event, say so before seeding. A "Learn more" link to a bare contact
   form is a weak listing.
3. **Split multi-night events into one row per night.** Expiry keys on
   start date only, so a single row spanning two days disappears before
   the second night. A submitter describing "Fri 5 PM to Sat 9 PM"
   usually means two evenings, not one continuous event.
4. **Check the id slug uses the LOCAL date, not UTC.** A 5 PM Pacific
   event stores as the following day in UTC. Getting this wrong on a
   two-night event makes the second upsert overwrite the first.
5. **Rewrite the description as prose.** Emoji, bullet glyphs and
   asterisk footnotes collapse into a run-on once whitespace is
   stripped. Put the hook in the first paragraph and keep that
   paragraph at or under DESCRIPTION_WORD_LIMIT, verified against the
   real truncateWords, so the card renders it whole with no ellipsis.
6. **Check for an existing row** covering the same date and venue.
   Scrapers may already have it, and duplicate submissions happen.
7. **Show me the row before inserting.** Then insert, read back with
   timestamps converted to Pacific, and flip the submission to
   `approved`.

## Data conventions

- `venue` is a short name plus street, no city, state or ZIP. The
  community is appended automatically when rendering, so including it
  duplicates. Example: `SLO Elks Lodge, 222 Elks Lane`.
- `community` must match an existing value exactly. `San Luis Obispo`,
  never `Downtown San Luis Obispo`.
- `category` must be one of the existing taxonomy values. Stop and ask
  if a submission needs one that doesn't exist.
- `source` uses the organization name for hand-curated rows.
- `ends_at` is stored even though expiry ignores it.
- Never correct deliberate misspellings in submitted copy. Band names
  and event branding are often intentionally odd.
