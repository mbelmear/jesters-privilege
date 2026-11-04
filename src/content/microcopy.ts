import type { Copy } from "@/lib/content";

// Short copy used across the site. Which copy is final and which is draft:
// AGENTS.md, Content.
export const microcopy = {
  draftRibbon: { text: "Draft" },
  draftRibbonNote: {
    text: "Draft: this page uses copy awaiting the Jesters' words.",
  },
  comingSoon: {
    text: "Episode 1 is on its way. Follow the show and you'll hear it the moment it's published.",
    draft: true,
  },
  newToPodcasts: {
    text: "New to podcasts? Open the podcast app already on your phone (Apple Podcasts on an iPhone, Spotify or YouTube elsewhere), search for Jester's Privilege, and tap Follow. New Episodes will arrive on their own.",
    draft: true,
  },
  notFoundTitle: { text: "A fool's errand" },
  notFoundBody: {
    text: "You've gone looking for a page that doesn't exist. We'd know a fool's errand when we see one.",
  },
  notFoundLink: { text: "Return to the great hall" },
} as const satisfies Record<string, Copy>;
