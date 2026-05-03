import Script from "next/script";
import SiteFooter from "@/components/SiteFooter";

export const metadata = {
  title: "Subscribe",
  description:
    "Get the week's best events on the Central Coast delivered to your inbox every Friday.",
};

export default function SubscribePage() {
  return (
    <div className="flex flex-col flex-1 w-full">
      <header className="border-b-4 border-double border-foreground/80 px-6 pt-10 pb-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-center text-[11px] uppercase tracking-[0.3em] text-muted">
            A daily guide for the Central Coast
          </p>
          <h1 className="font-serif text-center text-4xl sm:text-5xl font-black tracking-tight mt-3">
            Subscribe to What&rsquo;s On SLO
          </h1>
          <p className="text-center text-sm text-muted mt-3">
            Get the week&rsquo;s best events delivered to your inbox every
            Friday.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl w-full px-6 py-10 flex-1">
        <Script
          src="https://what-s-on-slo.kit.com/b9989705e8/index.js"
          data-uid="b9989705e8"
          strategy="afterInteractive"
        />
      </main>

      <SiteFooter />
    </div>
  );
}
