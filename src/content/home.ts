import type { Home } from "@/lib/content";

// The home page's section copy. The hero copy (hero.ts), the Jesters'
// summaries (jesters.ts), and "New to podcasts?" and coming-soon
// (microcopy.ts) live with the rest of their kind.
export const home = {
  listen: {
    title: "Listen on",
    platforms: {
      "apple-podcasts": "Apple Podcasts",
      spotify: "Spotify",
      youtube: "YouTube",
      rss: "RSS",
    },
  },
  latestEpisode: {
    title: "Latest Episode",
    episode: "Episode",
    bonus: "Bonus",
    trailer: "Trailer",
    play: "Play",
  },
  gallery: {
    title: "The Fools' Gallery",
    intro: {
      text: "Long before this show, there were fools who told kings the truth: Stańczyk brooding while the Polish court danced, Triboulet trading barbs with the kings of France, and the holy fools who rebuked tsars barefoot in the snow. Walk through their history, painting by painting.",
      draft: true,
    },
    link: { text: "Enter the Fools' Gallery", draft: true },
  },
  jesters: {
    title: "Meet the Jesters",
    link: "More about the Jesters",
  },
} as const satisfies Home;
