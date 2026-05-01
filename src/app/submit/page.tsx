import Link from "next/link";
import { submitEvent } from "./actions";
import SiteFooter from "@/components/SiteFooter";

export const metadata = {
  title: "Submit an event",
  description:
    "Tell What's On SLO about an event in San Luis Obispo or the Central Coast. Submissions are reviewed before they appear.",
};

const CATEGORIES = [
  "Music",
  "Food & Drink",
  "Arts",
  "Community",
  "Family",
  "Outdoors",
] as const;

const COMMUNITIES = [
  "San Luis Obispo",
  "Avila Beach",
  "Pismo Beach",
  "Shell Beach",
  "Arroyo Grande",
  "Grover Beach",
  "Oceano",
  "Nipomo",
  "Morro Bay",
  "Los Osos",
  "Cayucos",
  "Cambria",
  "Atascadero",
  "Templeton",
  "Santa Margarita",
  "Paso Robles",
  "Other",
];

type SearchParams = Promise<{ ok?: string; err?: string }>;

export default async function SubmitPage({
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
            Submit an event
          </h1>
          <p className="text-center text-sm text-muted mt-3">
            Tell us about something happening on the Central Coast. We review
            every submission before it goes live.
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
              Your submission is in the queue. We&rsquo;ll review it and, if
              it fits, you&rsquo;ll see it on the calendar within a day or two.
            </p>
            <p className="mt-4 text-sm">
              <Link href="/submit" className="underline hover:text-accent">
                Submit another
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
                <strong>Couldn&rsquo;t submit:</strong> {decodeURIComponent(error)}
              </div>
            )}

            <form action={submitEvent} className="space-y-6">
              <Field label="Event name" name="title" required />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Field
                  label="Starts (date & time, Pacific)"
                  name="starts_at"
                  type="datetime-local"
                  required
                />
                <Field
                  label="Ends (optional)"
                  name="ends_at"
                  type="datetime-local"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Field label="Venue" name="venue" required />

                <div>
                  <label
                    htmlFor="community"
                    className="block text-[11px] uppercase tracking-widest text-muted mb-1"
                  >
                    Community <span className="text-accent">*</span>
                  </label>
                  <select
                    id="community"
                    name="community"
                    required
                    defaultValue=""
                    className="w-full border border-rule bg-background px-3 py-2 rounded-sm focus:outline-none focus:border-accent"
                  >
                    <option value="" disabled>
                      Pick one…
                    </option>
                    {COMMUNITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="category"
                  className="block text-[11px] uppercase tracking-widest text-muted mb-1"
                >
                  Category <span className="text-accent">*</span>
                </label>
                <select
                  id="category"
                  name="category"
                  required
                  defaultValue=""
                  className="w-full border border-rule bg-background px-3 py-2 rounded-sm focus:outline-none focus:border-accent"
                >
                  <option value="" disabled>
                    Pick one…
                  </option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-[11px] uppercase tracking-widest text-muted mb-1"
                >
                  Description <span className="text-accent">*</span>
                </label>
                <textarea
                  id="description"
                  name="description"
                  required
                  rows={5}
                  placeholder="A sentence or two about the event."
                  className="w-full border border-rule bg-background px-3 py-2 rounded-sm focus:outline-none focus:border-accent leading-relaxed"
                />
              </div>

              <Field
                label="Link (event page or tickets)"
                name="source_url"
                type="url"
                required
                placeholder="https://…"
              />

              <div className="border-t border-rule pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Field
                  label="Your name"
                  name="submitter_name"
                  required
                />
                <Field
                  label="Your email"
                  name="submitter_email"
                  type="email"
                  required
                  hint="So we can follow up if anything's unclear."
                />
              </div>

              {/* Honeypot field — hidden from real users, attractive to bots */}
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
                Submit for review
              </button>

              <p className="text-xs text-muted">
                Your submission will be reviewed before going live. Please make
                sure event details are accurate.
              </p>
            </form>
          </>
        )}
      </main>

      <SiteFooter />
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
