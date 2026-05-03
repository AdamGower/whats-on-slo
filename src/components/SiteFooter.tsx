import Link from "next/link";

// Site-wide footer used on every page. Kept simple and identical across
// routes so the bottom of every page reads the same.
export default function SiteFooter() {
  return (
    <footer className="border-t border-rule mt-10 px-6 py-6">
      <div className="mx-auto max-w-5xl text-xs text-muted flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>What&rsquo;s On SLO</span>
        <span className="flex items-center gap-4">
          <Link
            href="/about"
            className="underline decoration-dotted underline-offset-2 hover:text-accent"
          >
            About
          </Link>
          <Link
            href="/hiking"
            className="underline decoration-dotted underline-offset-2 hover:text-accent"
          >
            Hiking
          </Link>
          <Link
            href="/subscribe"
            className="underline decoration-dotted underline-offset-2 hover:text-accent"
          >
            Subscribe
          </Link>
          <Link
            href="/submit"
            className="underline decoration-dotted underline-offset-2 hover:text-accent"
          >
            Submit your event
          </Link>
          <Link
            href="/comments"
            className="underline decoration-dotted underline-offset-2 hover:text-accent"
          >
            Contact
          </Link>
        </span>
      </div>
    </footer>
  );
}
