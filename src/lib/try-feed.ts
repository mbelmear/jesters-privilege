// Whether the site could build from a feed, before pointing the site at it:
// reads the feed at `url` with the same rules the build uses, and lists the
// page each Episode would get. Run by scripts/try-feed.ts.
import { downloadText, errorMessage, type Fetch } from "./download";
import { episodePath, parseFeed, type Episode } from "./feed";

export type TryFeedIO = {
  fetch: Fetch;
  log: (line: string) => void;
};

// Returns the exit code.
export async function tryFeed(url: string, io: TryFeedIO): Promise<number> {
  let episodes: Episode[];
  try {
    episodes = parseFeed(await downloadText("Feed", url, io.fetch));
  } catch (error: unknown) {
    io.log(`The site can't build from ${url}: ${errorMessage(error)}`);
    return 1;
  }
  io.log(`The site can build from ${url}: ${episodes.length} Episodes`);
  for (const episode of episodes) {
    io.log(`  ${episodePath(episode)}  ${episode.title}`);
  }
  return 0;
}
