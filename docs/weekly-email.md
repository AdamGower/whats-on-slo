# Weekly "This weekend in SLO" email

Signups go to the existing Kit form (9399228), from `/subscribe` and from the
inline signup blocks on event pages and `/this-weekend`. Kit holds the one
list and handles double opt-in and unsubscribe links.

The email fills itself from the Friday to Sunday events (Pacific time). Three
URLs serve it, each refreshed at most every 15 minutes:

| URL | What it is |
| --- | --- |
| `/email/this-weekend` | Ready-to-send HTML (600px, inline styles, up to 10 events a day) |
| `/email/this-weekend/text` | Plain-text version |
| `/this-weekend/feed.xml` | RSS feed of every event that weekend |

Subject line: `This weekend in SLO: Nov 20 to 22` (see `weekendEmailSubject`
in `src/lib/weekend-email.ts`). Event links carry
`utm_source=newsletter&utm_medium=email&utm_campaign=this-weekend`.

## Ways to send it (nothing is wired up yet)

1. **Paste into a Kit broadcast each Friday.** Open `/email/this-weekend`,
   view the page source, and paste it into a Kit broadcast using Kit's HTML
   option. Works on any Kit plan. About five minutes a week.
2. **Kit RSS automation.** If your Kit plan includes RSS-to-email, point it
   at `https://whatsonslo.com/this-weekend/feed.xml` with a Friday morning
   schedule. Kit builds the email from its own RSS template, so it will
   look different from the HTML version.
3. **Fully automatic, later.** A scheduled GitHub Action could create the
   Kit broadcast through Kit's API every Friday. That needs a Kit API key
   stored as a repository secret, and Kit's API access depends on the plan.

Kit adds its own footer with the unsubscribe link and mailing address on
every send; the template leaves that out on purpose.
