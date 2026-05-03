"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string | null; // null = disabled (e.g. About until that page exists)
};

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Hiking", href: "/hiking" },
  { label: "Submit your event", href: "/submit" },
  { label: "Contact", href: "/comments" },
  { label: "Subscribe", href: "/subscribe" },
];

function activeLabel(pathname: string): string | null {
  if (pathname.startsWith("/hiking")) return "Hiking";
  if (pathname.startsWith("/subscribe")) return "Subscribe";
  if (pathname.startsWith("/about")) return "About";
  if (pathname.startsWith("/submit")) return "Submit your event";
  if (pathname.startsWith("/comments")) return "Contact";
  if (pathname === "/" || pathname.startsWith("/?")) return "Home";
  return null;
}

export default function SiteNav() {
  const pathname = usePathname() ?? "/";
  const active = activeLabel(pathname);

  return (
    <nav
      aria-label="Site"
      // z-index must beat Leaflet's map controls (which top out around 1000)
      // so the nav stays above the map when scrolling /hiking?view=map.
      className="sticky top-0 z-[1100]"
      style={{ background: "#2C2416", color: "#F5F0E8" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-3 flex items-center gap-8 text-[11px] uppercase tracking-[0.2em] font-sans">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.label;
          // Style: active items full-opacity + underlined; inactive at 60%;
          // hover restores full opacity. Disabled items (no href) match
          // inactive opacity but don't underline on hover and don't link.
          const baseClass = isActive
            ? "opacity-100 underline underline-offset-[6px] decoration-1"
            : "opacity-60 hover:opacity-100 transition-opacity";
          if (!item.href) {
            return (
              <span
                key={item.label}
                className={`${baseClass} cursor-default`}
                aria-disabled
              >
                {item.label}
              </span>
            );
          }
          return (
            <Link key={item.label} href={item.href} className={baseClass}>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
