import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import SiteFooter from "@/components/SiteFooter";
import { pageMetadata } from "@/lib/seo";

// Where Kit sends people after they sign up (set as the form's redirect URL
// in Kit). Kit uses double opt-in, so the main job of this page is to tell
// them to confirm by email. Not useful in search results, so noindex.
export const metadata = pageMetadata({
  title: "Thanks for Subscribing",
  description:
    "Check your inbox to confirm your subscription to the weekly What's On SLO email.",
  path: "/subscribe/thanks",
  noindex: true,
});

const NEXT_LINKS = [
  { href: "/this-weekend", label: "This weekend", text: "Everything on across the county, Friday to Sunday." },
  { href: "/towns", label: "Browse by town", text: "Upcoming events in each of the county's towns." },
  { href: "/hiking", label: "Hiking trails", text: "Trails near San Luis Obispo, with difficulty, dogs and views." },
  { href: "/submit", label: "Submit an event", text: "Running something? Send it in and we'll list it." },
];

export default function SubscribeThanksPage() {
  return (
    <div className="flex flex-col flex-1 w-full">
      <PageHeader title="Thanks for subscribing" />

      <main className="mx-auto max-w-3xl w-full px-6 py-10 flex-1">
        <section className="border-2 border-foreground/80 px-5 py-6 sm:px-8">
          <p className="text-[11px] uppercase tracking-widest text-muted">One last step</p>
          <h2 className="font-serif text-2xl font-bold mt-1">Confirm your email address</h2>
          <p className="mt-3 text-lg leading-relaxed">
            We&rsquo;ve just sent you an email from What&rsquo;s On SLO. Open it and click the
            confirm button, and you&rsquo;re on the list.
          </p>
          <p className="mt-3 text-muted leading-relaxed">
            Not there after a few minutes? Check your spam or promotions folder, and add
            hello@whatsonslo.com to your contacts so the weekly email lands in your inbox.
          </p>
        </section>

        <p className="mt-8 text-lg leading-relaxed">
          Once you&rsquo;ve confirmed, the weekend email arrives every Thursday at 5 PM,
          with what&rsquo;s on across San Luis Obispo County from Friday to Sunday: live
          music, markets, theater, family days out and more. Every email has an unsubscribe
          link at the bottom.
        </p>

        <h2 className="font-serif text-2xl font-bold mt-12 border-b-2 border-foreground pb-1">
          While you&rsquo;re here
        </h2>
        <ul className="mt-2 divide-y divide-rule">
          {NEXT_LINKS.map((l) => (
            <li key={l.href} className="py-4">
              <Link
                href={l.href}
                className="font-serif text-xl font-bold hover:text-accent hover:underline underline-offset-2"
              >
                {l.label} &raquo;
              </Link>
              <p className="text-muted mt-1">{l.text}</p>
            </li>
          ))}
        </ul>
      </main>

      <SiteFooter />
    </div>
  );
}
