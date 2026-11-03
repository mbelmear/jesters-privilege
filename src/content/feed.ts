import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseFeed, type Episode } from "@/lib/feed";
import {
  chooseFeedSource,
  loadFeedText,
  transcriptFetch,
  type FeedIO,
  type FeedSource,
} from "@/lib/feed-source";
import { loadTranscript, type Transcript } from "@/lib/transcript";
import { LIVE_FEED_URL } from "./site";

// Deploys read the live feed (FEED=live); every other build reads a fixture
// shaped like it, whose Episodes are draft copy, so tests never depend on
// Spreaker. `FEED=empty` builds the site with no Episodes, as before Episode 1,
// to test the coming-soon state (docs/testing.md).
export const feedSource: FeedSource = chooseFeedSource(
  { FEED: process.env.FEED, SITE_ENV: process.env.SITE_ENV },
  {
    live: { kind: "url", url: LIVE_FEED_URL },
    fixture: {
      kind: "fixture",
      path: "src/content/feed-fixture.xml",
      transcripts: "src/content/transcripts",
      standsInFor: LIVE_FEED_URL,
      draft: true,
    },
    empty: {
      kind: "fixture",
      path: "src/content/feed-fixture-empty.xml",
      transcripts: "src/content/transcripts",
      standsInFor: LIVE_FEED_URL,
      draft: true,
    },
  }
);

const io: FeedIO = {
  // A hung download fails (or, for a Transcript, skips) rather than stalling
  // the build.
  fetch: (url) => fetch(url, { signal: AbortSignal.timeout(30_000) }),
  readFile: (path) => readFile(join(process.cwd(), path), "utf8"),
};

// Every Episode, newest first. Throws (failing the build) when the feed can't
// be read or breaks a rule, so the last good deploy stays live.
export async function getEpisodes(): Promise<Episode[]> {
  return parseFeed(await loadFeedText(feedSource, io));
}

// An Episode's Transcript, or null when it has none or it can't be had (the
// build log says which).
export function getTranscript(episode: Episode): Promise<Transcript | null> {
  return loadTranscript(episode, {
    fetch: transcriptFetch(feedSource, io),
    warn: (message) => console.warn(message),
  });
}
