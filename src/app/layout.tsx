import type { Metadata } from "next";
import { Geist, Playfair_Display } from "next/font/google";
import "./globals.css";

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
  metadataBase: new URL("https://whats-on-slo.vercel.app"),
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
    url: "https://whats-on-slo.vercel.app",
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
