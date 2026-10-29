import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseFeed, type Episode } from "@/lib/feed";
import { loadFeedText, type FeedSource } from "@/lib/feed-source";

// The one value to change once Episode 1 is published on Spreaker:
//   { kind: "url", url: "https://www.spreaker.com/show/<id>/episodes/feed" }
export const feedSource: FeedSource = {
  kind: "fixture",
  path: "src/content/feed-fixture.xml",
  draft: true,
};

// Every Episode, newest first. Throws (failing the build) when the feed can't
// be read or breaks a rule, so the last good deploy stays live.
export async function getEpisodes(): Promise<Episode[]> {
  const text = await loadFeedText(feedSource, {
    // A hung feed fails the build rather than stalling it.
    fetch: (url) => fetch(url, { signal: AbortSignal.timeout(30_000) }),
    readFile: (path) => readFile(join(process.cwd(), path), "utf8"),
  });
  return parseFeed(text);
}
