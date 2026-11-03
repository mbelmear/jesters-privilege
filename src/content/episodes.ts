import type { EpisodesPage } from "@/lib/content";

// The Episodes archive's copy. Its Episodes come from the Feed (feed.ts); the
// labels on its rows are the Episode page's (episode-page.ts).
export const episodes = {
  title: "Episodes",
  intro: {
    text: "Every Episode of Jester's Privilege, newest first. Three fools for Christ laugh at church culture, and at themselves first, then open the Scriptures so that the church listens to her King. Press Play on any of them and keep browsing while it plays.",
    draft: true,
  },
  finished: "Finished",
} as const satisfies EpisodesPage;
