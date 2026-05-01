import type { Metadata } from "next";
import { Geist, Playfair_Display } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import SiteNav from "@/components/SiteNav";
import "./globals.css";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const GA_ENABLED = process.env.NODE_ENV === "production" && !!GA_ID;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const SITE_DESCRIPTION =
  "A daily guide to live music, food, festivals, and community events across San Luis Obispo and the Central Coast — Paso Robles, Morro Bay, Avila Beach, Pismo Beach, Cambria, Atascadero, and beyond.";

export const metadata: Metadata = {
  metadataBase: new URL("https://whatsonslo.com"),
  title: {
    default: "What's On SLO — San Luis Obispo & the Central Coast",
    template: "%s | What's On SLO",
  },
  description: SITE_DESCRIPTION,
  applicationName: "What's On SLO",
  authors: [{ name: "What's On SLO" }],
  keywords: [
    "San Luis Obispo events",
    "SLO events",
    "Central Coast events",
    "Paso Robles events",
    "Morro Bay events",
    "Avila Beach events",
    "Pismo Beach events",
    "live music SLO",
    "things to do San Luis Obispo",
  ],
  openGraph: {
    type: "website",
    siteName: "What's On SLO",
    title: "What's On SLO — San Luis Obispo & the Central Coast",
    description: SITE_DESCRIPTION,
    url: "https://whatsonslo.com",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "What's On SLO",
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "m0PzCMnkAU7dNLFvy4rOQZyY1KbU43ZuwvVoJwfXBP8",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteNav />
        {children}
        <VercelAnalytics />
        <SpeedInsights />
      </body>
      {GA_ENABLED && <GoogleAnalytics gaId={GA_ID!} />}
    </html>
  );
}
