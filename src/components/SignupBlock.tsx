// Inline newsletter signup. Posts straight to the same Kit form as /subscribe
// (form 9399228), as Kit's plain HTML embed does, so subscribers land on the
// one existing list. No script: on submit the browser goes to Kit's own
// confirmation page, and Kit sends its double opt-in email as usual.
const KIT_FORM_ACTION = "https://app.kit.com/forms/9399228/subscriptions";

export default function SignupBlock({
  heading = "Get the weekend's events by email",
  blurb = "One email every Thursday evening with what's on across San Luis Obispo County that weekend. Free, and you can unsubscribe any time.",
  id = "signup",
}: {
  heading?: string;
  blurb?: string;
  id?: string;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="my-10 border-2 border-foreground/80 px-5 py-6 sm:px-8"
    >
      <h2 id={`${id}-heading`} className="font-serif text-2xl font-bold">
        {heading}
      </h2>
      <p className="mt-1 text-muted">{blurb}</p>
      <form
        action={KIT_FORM_ACTION}
        method="post"
        className="mt-4 flex flex-col sm:flex-row gap-3"
      >
        <label className="sr-only" htmlFor={`${id}-name`}>
          First name
        </label>
        <input
          id={`${id}-name`}
          name="fields[first_name]"
          type="text"
          required
          autoComplete="given-name"
          placeholder="First name"
          className="sm:w-40 border border-rule bg-white px-3 py-2.5"
        />
        <label className="sr-only" htmlFor={`${id}-email`}>
          Email address
        </label>
        <input
          id={`${id}-email`}
          name="email_address"
          type="email"
          required
          autoComplete="email"
          placeholder="Email address"
          className="flex-1 border border-rule bg-white px-3 py-2.5"
        />
        <button
          type="submit"
          className="bg-foreground text-background px-6 py-2.5 text-sm uppercase tracking-widest hover:bg-accent transition-colors"
        >
          Subscribe
        </button>
      </form>
    </section>
  );
}
