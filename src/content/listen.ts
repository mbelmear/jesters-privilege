import type { ListenCopy } from "@/lib/content";

// The "Listen on" buttons, shown on the home page and under How to listen on
// About.
export const listen = {
  title: "Listen on",
  platforms: {
    "apple-podcasts": "Apple Podcasts",
    spotify: "Spotify",
    youtube: "YouTube",
    rss: "RSS",
  },
} as const satisfies ListenCopy;
