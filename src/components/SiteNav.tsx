"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NavItem = {
  label: string;
  href: string | null; // null = disabled (e.g. About until that page exists)
};

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Events", href: "/" },
  { label: "Hiking", href: "/hiking" },
  { label: "Submit your event", href: "/submit" },
  { label: "Contact", href: "/comments" },
  { label: "Subscribe", href: "/subscribe" },
];

// Home and Events both point at "/". We mark Events as the active one
// because the page IS the events listing.
function activeLabel(pathname: string): string | null {
  if (pathname.startsWith("/hiking")) return "Hiking";
  if (pathname.startsWith("/subscribe")) return "Subscribe";
  if (pathname.startsWith("/about")) return "About";
  if (pathname.startsWith("/submit")) return "Submit your event";
  if (pathname.startsWith("/comments")) return "Contact";
  if (pathname === "/" || pathname.startsWith("/?")) return "Events";
  return null;
}

export default function SiteNav() {
  const pathname = usePathname() ?? "/";
  const active = activeLabel(pathname);
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  // Close on outside click and Escape.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function itemClass(isActive: boolean) {
    return isActive
      ? "opacity-100 underline underline-offset-[6px] decoration-1"
      : "opacity-60 hover:opacity-100 transition-opacity";
  }

  return (
    <nav
      ref={navRef}
      aria-label="Site"
      // z-index must beat Leaflet's map controls (which top out around 1000)
      // so the nav stays above the map when scrolling /hiking?view=map.
      className="sticky top-0 z-[1100]"
      style={{ background: "#2C2416", color: "#F5F0E8" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-3 flex items-center justify-between gap-8">
        {/* Desktop: horizontal links. Hidden below md. */}
        <div className="hidden md:flex items-center gap-8 text-[11px] uppercase tracking-[0.2em] font-sans">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.label;
            if (!item.href) {
              return (
                <span
                  key={item.label}
                  className={`${itemClass(isActive)} cursor-default`}
                  aria-disabled
                >
                  {item.label}
                </span>
              );
            }
            return (
              <Link
                key={item.label}
                href={item.href}
                className={itemClass(isActive)}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Mobile: hamburger toggle. Hidden at md+. */}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="site-nav-mobile"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden ml-auto inline-flex items-center justify-center w-9 h-9 -mr-2 opacity-80 hover:opacity-100"
        >
          {open ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden
            >
              <line x1="4" y1="4" x2="16" y2="16" />
              <line x1="16" y1="4" x2="4" y2="16" />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden
            >
              <line x1="3" y1="6" x2="17" y2="6" />
              <line x1="3" y1="10" x2="17" y2="10" />
              <line x1="3" y1="14" x2="17" y2="14" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown panel. Rendered at md and below; collapsed when closed. */}
      <div
        id="site-nav-mobile"
        className={`md:hidden overflow-hidden transition-[max-height,opacity] duration-200 ease-out ${
          open ? "max-h-[480px] opacity-100" : "max-h-0 opacity-0"
        }`}
        style={{ borderTop: open ? "1px solid rgba(245,240,232,0.15)" : "none" }}
      >
        <ul className="px-6 py-2 flex flex-col text-[11px] uppercase tracking-[0.2em] font-sans">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.label;
            if (!item.href) {
              return (
                <li key={item.label}>
                  <span
                    className={`${itemClass(isActive)} block py-3 cursor-default`}
                    aria-disabled
                  >
                    {item.label}
                  </span>
                </li>
              );
            }
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={`${itemClass(isActive)} block py-3`}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
