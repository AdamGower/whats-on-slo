// The masthead-style header used on content pages: a small kicker line over a
// serif H1, closed by the double rule.
export default function PageHeader({
  kicker = "A daily guide for the Central Coast",
  title,
  children,
  width = "max-w-3xl",
}: {
  kicker?: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  width?: string;
}) {
  return (
    <header className="border-b-4 border-double border-foreground/80 px-6 pt-10 pb-6">
      <div className={`mx-auto ${width}`}>
        <p className="text-center text-[11px] uppercase tracking-[0.3em] text-muted">
          {kicker}
        </p>
        <h1 className="font-serif text-center text-4xl sm:text-5xl font-black tracking-tight mt-3">
          {title}
        </h1>
        {children}
      </div>
    </header>
  );
}
