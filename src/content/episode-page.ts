import type { EpisodePage } from "@/lib/content";

// The Episode page's interface words. Its title, Show notes, date, and length
// come from the Feed (feed.ts).
export const episodePage = {
  episode: "Episode",
  bonus: "Bonus",
  trailer: "Trailer",
  units: { hours: "hr", minutes: "min" },
  play: "Play",
  showNotes: "Show notes",
  sequence: {
    label: "More Episodes",
    previous: "Previous Episode",
    next: "Next Episode",
  },
  share: {
    button: "Share",
    copied: {
      text: "Link copied. Paste it anywhere to share this Episode.",
      draft: true,
    },
    failed: {
      text: "Your browser wouldn't copy the link. Copy this page's address to share it.",
      draft: true,
    },
  },
} as const satisfies EpisodePage;
