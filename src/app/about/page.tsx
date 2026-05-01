import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";

export const metadata = {
  title: "About",
  description:
    "What's On SLO is your insider's guide to what's happening in and around San Luis Obispo, pulled together by people who actually live here.",
};

export default function AboutPage() {
  return (
    <div className="flex flex-col flex-1 w-full">
      <header className="border-b-4 border-double border-foreground/80 px-6 pt-10 pb-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-center text-[11px] uppercase tracking-[0.3em] text-muted">
            A daily guide for the Central Coast
          </p>
          <h1 className="font-serif text-center text-4xl sm:text-5xl font-black tracking-tight mt-3">
            About
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl w-full px-6 py-10 flex-1">
        <article className="space-y-10 leading-relaxed">
          <section>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold border-b border-foreground/40 pb-2 mb-4">
              Who We Are
            </h2>
            <p>
              What&rsquo;s On SLO is your insider&rsquo;s guide to what&rsquo;s
              happening in and around San Luis Obispo, pulled together by
              people who actually live here, go to these events, and care
              about this community. It&rsquo;s built for anyone who has ever
              said, &ldquo;There&rsquo;s got to be something good going on
              this week,&rdquo; and then spent way too long searching five
              different calendars to prove it.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold border-b border-foreground/40 pb-2 mb-4">
              What We Cover
            </h2>
            <p>
              The idea is simple: one clean, reliable place to find things
              worth doing in SLO County this week and next. From live music
              downtown and winery events in Edna Valley to family-friendly
              festivals, gallery openings, and pop-up food happenings,
              What&rsquo;s On SLO is a comprehensive guide to everything SLO
              has to offer.
            </p>
            <p className="mt-4">
              We focus on SLO County, with an emphasis on the city of San
              Luis Obispo and the surrounding communities you&rsquo;re most
              likely to visit: the coast, North County, and the wine
              regions. Our goal is to surface the things that feel
              representative of the area and worth leaving the house for.
              You&rsquo;ll see a mix of recurring favorites and new
              discoveries, so there&rsquo;s always something familiar and
              something you haven&rsquo;t tried yet.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold border-b border-foreground/40 pb-2 mb-4">
              Who It&rsquo;s For
            </h2>
            <p>What&rsquo;s On SLO is for three main groups of people.</p>
            <p className="mt-4">
              <strong>First, locals</strong> who want a quick, trustworthy
              snapshot of what&rsquo;s going on this week: where to hear
              live music, what&rsquo;s happening on Thursday night, or how
              to keep visiting friends entertained.
            </p>
            <p className="mt-4">
              <strong>Second, visitors</strong> who want their time in SLO
              to feel a bit more like living here and a bit less like
              checking off tourist boxes.
            </p>
            <p className="mt-4">
              <strong>Third, local businesses, venues, and organizers</strong>{" "}
              who want to reach those people without having to shout into
              the void of social media and hope the algorithm is in a good
              mood.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold border-b border-foreground/40 pb-2 mb-4">
              List Your Event
            </h2>
            <p>
              If you organize events in SLO County, we&rsquo;d love to have
              you list your event here. Tell us what you&rsquo;re putting
              on, give us the details people need to decide, and we&rsquo;ll
              do our best to get it in front of the right audience. We care
              about supporting local venues, independent businesses, and
              community organizations, and we&rsquo;re especially interested
              in events that make SLO feel more connected, more
              interesting, and more welcoming.
            </p>
            <p className="mt-4">
              <Link
                href="/submit"
                className="font-bold underline decoration-2 underline-offset-4 hover:text-accent"
              >
                Submit your event →
              </Link>
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold border-b border-foreground/40 pb-2 mb-4">
              Get in Touch
            </h2>
            <p>
              We would very much value your thoughts and comments about how
              we can improve this site or what else you would like to see.
            </p>
            <p className="mt-4">
              <Link
                href="/comments"
                className="font-bold underline decoration-2 underline-offset-4 hover:text-accent"
              >
                Submit your thoughts and comments →
              </Link>
            </p>
          </section>

          <section>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold border-b border-foreground/40 pb-2 mb-4">
              The Bottom Line
            </h2>
            <p>
              At its core, What&rsquo;s On SLO is about making it easier to
              enjoy where you are. Whether you live here year-round or
              you&rsquo;re just in town for the weekend, this is meant to
              be your quick way to answer, &ldquo;What should we do?&rdquo;
              and actually find something you love.{" "}
              <Link href="/" className="underline hover:text-accent">
                Start by seeing what&rsquo;s on this week
              </Link>
              , bookmark the site, and if you&rsquo;re putting something on
              that belongs here,{" "}
              <Link href="/submit" className="underline hover:text-accent">
                send it our way
              </Link>
              .
            </p>
          </section>
        </article>
      </main>

      <SiteFooter />
    </div>
  );
}
