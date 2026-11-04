import type { Copy } from "@/lib/content";

// Short copy used across the site. Which copy is final and which is draft:
// AGENTS.md, Content.
export const microcopy = {
  draftRibbon: { text: "Draft" },
  draftRibbonNote: {
    text: "Draft: this page uses copy awaiting the Jesters' words.",
  },
  comingSoon: {
    text: "Our Episodes have wandered off, which is awkward for a show about a church that wanders. We're out rounding them up. Check back soon.",
  },
  newToPodcasts: {
    text: "New to podcasts? Open the podcast app already on your phone (Apple Podcasts on an iPhone, Spotify elsewhere), search for Jester's Privilege, and tap Follow. New Episodes will arrive on their own.",
  },
  notFoundTitle: { text: "A fool's errand" },
  notFoundBody: {
    text: "You've gone looking for a page that doesn't exist. We'd know a fool's errand when we see one.",
  },
  notFoundLink: { text: "Return to the great hall" },
} as const satisfies Record<string, Copy>;
