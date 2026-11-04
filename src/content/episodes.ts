import type { EpisodesPage } from "@/lib/content";

// The Episodes archive's copy. Its Episodes come from the Feed (feed.ts); the
// labels on its rows are the Episode page's (episode-page.ts).
export const episodes = {
  title: "Episodes",
  intro: {
    text: "Every Episode, newest first. In each one, three fools for Christ laugh at the church's habits (ours first), then open the Scriptures to hear what the King actually said. Press Play on any of them, and it keeps playing while you wander the rest of the court.",
  },
  finished: "Finished",
} as const satisfies EpisodesPage;
