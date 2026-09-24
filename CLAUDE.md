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
   form is a weak listing. When the fetched text doesn't mention the
   event, check whether the detail lives in an image (flyers, posters,
   event graphics) before calling the link weak. Absence from
   extracted text is not absence from the page.
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

## Scrape failure auto-fix

`.github/workflows/scrape-autofix.yml` runs whenever "Scrape events"
fails on `main` (or on an `autofix-test/*` branch, used to test it).

1. **Rerun.** It reruns only the failed jobs once and waits. A pass
   ends it there: most failures are transient timeouts.
2. **Skip known failures.** Open issues and PRs labelled `auto-fix`
   carry their job names in the title, as `[auto-fix: goslo] ...`. A
   job that already has one is not diagnosed again, so close the item
   once it's resolved.
3. **Diagnose.** Claude (via `anthropics/claude-code-action`, using the
   `CLAUDE_CODE_OAUTH_TOKEN` secret, max 20 turns) reads the last 400
   log lines of each failed job and returns one of: a code fix, an
   issue for something outside the code, or "none" if it was transient.
4. **Publish.** A code fix becomes a PR from `auto-fix/<run id>` into
   the branch that failed, with the workflow's own `npm test` and
   dry-run output appended. Anything else becomes an issue with steps
   for the owner. If Claude can't finish, an issue says so.

Safety rules the workflow depends on; keep them when editing it:

- Claude's job has a read-only `GITHUB_TOKEN` and no Supabase or
  Ticketmaster keys. Scrapers there run with `SCRAPE_DRY_RUN=1`.
- Only the publish job can write, and it never runs Claude's code. It
  applies the commits as a patch and pushes an `auto-fix/*` branch.
- Workflow logs include text from scraped sites; the prompt tells
  Claude to treat it as data.

`SCRAPE_DRY_RUN=1 node scripts/scrape-<name>.mjs` works locally too,
with no env vars except Ticketmaster's API key. Source fetches go
through `scripts/_fetch-retry.mjs`, which retries network errors, 429
and 5xx three times before a job fails.
