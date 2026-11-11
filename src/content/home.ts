import type { Home } from "@/lib/content";
import { gallery } from "./gallery";

// The home page's section copy. The hero copy (hero.ts), the Jesters'
// summaries (jesters.ts), the Listen buttons (listen.ts), and "New to
// podcasts?" and coming-soon (microcopy.ts) live with the rest of their kind.
export const home = {
  latestEpisode: {
    title: "Latest Episode",
    episode: "Episode",
    bonus: "Bonus",
    trailer: "Trailer",
    units: { hours: "hr", minutes: "min" },
  },
  gallery: {
    title: gallery.title,
    intro: {
      text: "Long before this show, there were fools who told kings the truth: Stańczyk brooding while the Polish court danced, the holy fools who rebuked tsars barefoot in the snow, and Triboulet, a simple fool whose name later collected other fools' jokes. Walk through their history, painting by painting.",
    },
    link: { text: "Enter the Fools' Gallery" },
  },
  jesters: {
    title: "Meet the Jesters",
    link: "More about the Jesters",
  },
} as const satisfies Home;
