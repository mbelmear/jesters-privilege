import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseFeed, type Episode } from "@/lib/feed";
import {
  loadFeedText,
  transcriptFetch,
  type FeedIO,
  type FeedSource,
} from "@/lib/feed-source";
import { loadTranscript, type Transcript } from "@/lib/transcript";

// The one value to change once Episode 1 is published on Spreaker:
//   { kind: "url", url: "https://www.spreaker.com/show/<id>/episodes/feed" }
const configuredSource: FeedSource = {
  kind: "fixture",
  path: "src/content/feed-fixture.xml",
  transcripts: "src/content/transcripts",
  draft: true,
};

// `FEED=empty` builds the site with no Episodes, as before Episode 1, to test
// the coming-soon state (docs/testing.md).
export const feedSource: FeedSource =
  process.env.FEED === "empty"
    ? {
        kind: "fixture",
        path: "src/content/feed-fixture-empty.xml",
        transcripts: "src/content/transcripts",
        draft: true,
      }
    : configuredSource;

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
