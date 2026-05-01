"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string | null; // null = disabled (e.g. About until that page exists)
};

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Events", href: "/" },
  { label: "Hiking", href: "/hiking" },
  { label: "About", href: "/about" },
];

// Returns true for the single nav item that should be visually active for
// the current path. Home and Events both point at "/" today; we mark Events
// as the active one (the page IS the events listing). Once a separate
// landing page exists, give it its own route and update this rule.
function activeLabel(pathname: string): string | null {
  if (pathname.startsWith("/hiking")) return "Hiking";
  if (pathname.startsWith("/about")) return "About";
  if (pathname === "/" || pathname.startsWith("/?")) return "Events";
  return null;
}

export default function SiteNav() {
  const pathname = usePathname() ?? "/";
  const active = activeLabel(pathname);

  return (
    <nav
      aria-label="Site"
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
