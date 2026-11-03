// Whether the site could build from a feed, before pointing the live feed
// (LIVE_FEED_URL in src/content/site.ts) at it. Touches nothing. Logic:
// src/lib/try-feed.ts.
// Usage: npm run try-feed -- <feed url>
import { tryFeed } from "@/lib/try-feed";

const url = process.argv[2];
if (!url) {
  console.error("Usage: npm run try-feed -- <feed url>");
  process.exit(1);
}

tryFeed(url, {
  fetch: (address) => fetch(address, { signal: AbortSignal.timeout(30_000) }),
  log: (line) => console.log(line),
}).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  }
);
