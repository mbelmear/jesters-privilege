import type { ListenCopy } from "@/lib/content";

// The Listen links: the show's "Listen on" buttons under How to listen on
// About, and the "or listen on" icons on the home page's latest Episode and
// on Episode pages (docs/spec.md, Pages).
export const listen = {
  title: "Listen on",
  onEpisode: "or listen on",
  platforms: {
    "apple-podcasts": "Apple Podcasts",
    spotify: "Spotify",
    youtube: "YouTube",
    rss: "RSS",
  },
} as const satisfies ListenCopy;
