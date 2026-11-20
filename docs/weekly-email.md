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

## How it's sent

Automatically, every week. `.github/workflows/weekend-email.yml` runs on
Thursday mornings, with a backup run early in the afternoon, and calls
`scripts/send-weekend-email.mjs`, which:

1. fetches `/email/this-weekend` and waits until it shows the coming weekend
   (the page is cached, so the first request can return last week's copy);
2. stops with an error if no events are listed, rather than send an empty email;
3. skips the week if a broadcast with the same subject is already scheduled or
   sent in Kit, so the backup run never sends twice;
4. creates a Kit broadcast to all subscribers, scheduled for **Thursday at
   5 PM Pacific**.

It needs one repository secret, `KIT_API_KEY`: a v4 API key from Kit
(Settings, Developer).

To test without sending, open Actions, "Weekend email", "Run workflow" and
pick `draft`. The email is saved in Kit as a draft and nothing goes out.

To skip a week, delete or unschedule that week's broadcast in Kit after the
Thursday morning run. To stop the emails altogether, disable the workflow in
Actions. If a run fails, GitHub emails the repository owner and nothing is
sent that week.

Kit adds its own footer with the unsubscribe link and mailing address on
every send; the template leaves that out on purpose.
