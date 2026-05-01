import Link from "next/link";
import { submitComment } from "./actions";

export const metadata = {
  title: "Share your thoughts",
  description:
    "Send feedback, ideas, or comments to What's On SLO. We read every message.",
};

type SearchParams = Promise<{ ok?: string; err?: string }>;

export default async function CommentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const submitted = params.ok === "1";
  const error = params.err;

  return (
    <div className="flex flex-col flex-1 w-full">
      <header className="border-b-4 border-double border-foreground/80 px-6 pt-10 pb-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-center text-[11px] uppercase tracking-[0.3em] text-muted">
            A daily guide for the Central Coast
          </p>
          <h1 className="font-serif text-center text-4xl sm:text-5xl font-black tracking-tight mt-3">
            Share your thoughts
          </h1>
          <p className="text-center text-sm text-muted mt-3">
            Anything you&rsquo;d like to see, change, or fix on What&rsquo;s
            On SLO — we&rsquo;d love to hear it.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl w-full px-6 py-10 flex-1">
        {submitted ? (
          <div className="rounded-sm border border-foreground/40 p-6">
            <h2 className="font-serif text-2xl font-bold mb-2">
              Thanks — got it.
            </h2>
            <p className="leading-relaxed">
              Your comment is in our inbox. If it asked for a reply, expect
              one within a day or two.
            </p>
            <p className="mt-4 text-sm">
              <Link
                href="/comments"
                className="underline hover:text-accent"
              >
                Send another
              </Link>
              {" or "}
              <Link href="/" className="underline hover:text-accent">
                back to the calendar
              </Link>
              .
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="rounded-sm border border-accent bg-accent/10 px-4 py-3 mb-6 text-sm">
                <strong>Couldn&rsquo;t send:</strong>{" "}
                {decodeURIComponent(error)}
              </div>
            )}

            <form action={submitComment} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Field label="Your name" name="name" required />
                <Field
                  label="Your email"
                  name="email"
                  type="email"
                  required
                  hint="So we can reply if needed."
                />
              </div>

              <div>
                <label
                  htmlFor="message"
                  className="block text-[11px] uppercase tracking-widest text-muted mb-1"
                >
                  Message <span className="text-accent">*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={8}
                  placeholder="Tell us what you think."
                  className="w-full border border-rule bg-background px-3 py-2 rounded-sm focus:outline-none focus:border-accent leading-relaxed"
                />
              </div>

              {/* Honeypot — bots fill this; humans never see it */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "-9999px",
                  width: 1,
                  height: 1,
                  overflow: "hidden",
                }}
              >
                <label>
                  Website
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </label>
              </div>

              <button
                type="submit"
                className="font-serif font-bold bg-foreground text-background px-6 py-3 rounded-sm hover:bg-accent transition-colors"
              >
                Send
              </button>
            </form>
          </>
        )}
      </main>

      <footer className="border-t border-rule mt-10 px-6 py-6">
        <div className="mx-auto max-w-3xl text-xs text-muted flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>What&rsquo;s On SLO &middot; Comments</span>
          <Link href="/" className="hover:text-accent">
            ← Back to events
          </Link>
        </div>
      </footer>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-[11px] uppercase tracking-widest text-muted mb-1"
      >
        {label}
        {required && <span className="text-accent"> *</span>}
      </label>
      <input
        type={type}
        id={name}
        name={name}
        required={required}
        placeholder={placeholder}
        className="w-full border border-rule bg-background px-3 py-2 rounded-sm focus:outline-none focus:border-accent"
      />
      {hint && <p className="text-xs text-muted mt-1">{hint}</p>}
    </div>
  );
}
