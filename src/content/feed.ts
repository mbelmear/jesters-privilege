import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  episodeListenLinks,
  listedEpisodes,
  lookUpApple,
  parseLookups,
  type EpisodeListenLink,
  type ListedEpisodes,
  type Lookups,
} from "@/lib/episode-listen-links";
import { errorMessage } from "@/lib/download";
import { parseFeed, type Episode } from "@/lib/feed";
import {
  appleLookupFetch,
  chooseFeedSource,
  loadFeedText,
  transcriptFetch,
  type FeedIO,
  type FeedSource,
} from "@/lib/feed-source";
import { loadTranscript, type Transcript } from "@/lib/transcript";
import { LIVE_FEED_URL, site } from "./site";

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
      appleLookup: "src/content/apple-lookup-fixture.json",
      standsInFor: LIVE_FEED_URL,
      draft: true,
    },
    empty: {
      kind: "fixture",
      path: "src/content/feed-fixture-empty.xml",
      transcripts: "src/content/transcripts",
      appleLookup: "src/content/apple-lookup-fixture.json",
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

// Where a build that reads the live feed keeps the apps' lookups, written
// once by scripts/lookups.ts before `next build` (gitignored).
export const LOOKUPS_SNAPSHOT = ".lookups.json";

// Each app's lookup of the Feed's Episodes, looked up afresh. The feed check
// calls this; pages and the build manifest call getLookups.
export async function lookUpEpisodes(): Promise<Lookups> {
  const apple = site.listen["apple-podcasts"];
  return apple
    ? {
        "apple-podcasts": await lookUpApple(
          apple,
          appleLookupFetch(feedSource, io)
        ),
      }
    : {};
}

// The lookups every page and the build manifest read. Next renders them in
// several worker processes, so a build from the live feed reads the one
// snapshot made before them all: were each to ask Apple itself, a lookup that
// failed in one worker would leave a page linking to the show while the
// manifest recorded the Episode's own link, and the feed check would never
// rebuild it. The fixture's answer is a file, the same in every worker; it
// lists every Episode but the newest and the trailer, so the built site shows
// both an Episode's own link and the fallback to the show.
let lookups: Promise<Lookups> | undefined;
export function getLookups(): Promise<Lookups> {
  lookups ??= feedSource.kind === "url" ? readSnapshot() : lookUpEpisodes();
  return lookups;
}

async function readSnapshot(): Promise<Lookups> {
  let text: string;
  try {
    text = await io.readFile(LOOKUPS_SNAPSHOT);
  } catch (error: unknown) {
    throw new Error(
      `Lookups snapshot ${LOOKUPS_SNAPSHOT} can't be read, so run \`npm run lookups\` before \`next build\` (npm run build does): ${errorMessage(error)}`
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`Lookups snapshot ${LOOKUPS_SNAPSHOT} isn't JSON`);
  }
  return parseLookups(value);
}

// The Episode's Listen link in each app the show is on; the build log names
// each one that opens the show for want of the Episode's own.
export async function getEpisodeListenLinks(
  episode: Episode
): Promise<EpisodeListenLink[]> {
  return episodeListenLinks(
    episode,
    site.listen,
    await getLookups(),
    (message) => console.warn(message)
  );
}

// The Feed's Episodes each app has a link for, as the build manifest records.
export async function getListedEpisodes(): Promise<ListedEpisodes> {
  return listedEpisodes(await getEpisodes(), await getLookups());
}
