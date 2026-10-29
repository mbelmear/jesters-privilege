"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

const scrolled = () => window.scrollY > 0;
// The page is prerendered at the top.
const atTop = () => false;

/**
 * The header bar: transparent at the top of the page, so a hero painting can
 * show through, and solid and compact once the page scrolls. It's fixed, so
 * it never moves the page; the layout starts content below its full height.
 */
export function HeaderFrame({ children }: { children: React.ReactNode }) {
  const isScrolled = useSyncExternalStore(subscribe, scrolled, atTop);
  return (
    <header
      data-scrolled={isScrolled || undefined}
      className="fixed inset-x-0 top-0 z-40 flex h-(--header-height) items-center border-b border-transparent transition-[height,background-color,border-color,box-shadow] duration-(--motion-courtly-duration) ease-courtly data-scrolled:h-(--header-height-compact) data-scrolled:border-border data-scrolled:bg-background data-scrolled:shadow-sm"
    >
      {children}
    </header>
  );
}
