import type { Page, ViewportSize } from "@playwright/test";

// Tailwind's md and lg breakpoints, which the site uses unchanged: below md
// the header's links give way to the menu and paintings crop to portrait; at
// lg the Gallery's bands zoom.
export const MD = 768;
export const LG = 1024;

const width = (viewport: ViewportSize | null) => viewport?.width ?? 0;

// A phone project is one narrower than md, by width rather than isMobile,
// which Firefox's phone project lacks.
export const isPhone = (viewport: ViewportSize | null) => width(viewport) < MD;

// Whether the page's current window is at least `min` wide.
export const isWide = (page: Page, min: number) =>
  width(page.viewportSize()) >= min;
