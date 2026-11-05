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
  savedTranscripts,
  transcriptFetch,
  type FeedIO,
  type FeedSource,
} from "@/lib/feed-source";
import {
  loadTranscriptTexts,
  parseTranscript,
  parseTranscriptTexts,
  type Transcript,
  type TranscriptTexts,
} from "@/lib/transcript";
import { LIVE_FEED_URL, site } from "./site";

// Deploys read the live feed (FEED=live); every other build reads a fixture
// shaped like it, whose Episodes are draft copy, so tests never depend on
// Spreaker. `FEED=empty` builds the site with no Episodes, as before Episode 1,
// to test the coming-soon state (docs/testing.md).
export const feedSource: FeedSource = chooseFeedSource(
  { FEED: process.env.FEED, SITE_ENV: process.env.SITE_ENV },
  {
    live: {
      kind: "url",
      url: LIVE_FEED_URL,
      savedTranscripts:
        "https://raw.githubusercontent.com/mbelmear/jesters-privilege/transcripts/",
    },
    fixture: {
      kind: "fixture",
      path: "src/content/feed-fixture.xml",
      transcripts: "src/content/transcripts",
      savedTranscripts: "src/content/saved-transcripts",
      appleLookup: "src/content/apple-lookup-fixture.json",
      standsInFor: LIVE_FEED_URL,
      draft: true,
    },
    empty: {
      kind: "fixture",
      path: "src/content/feed-fixture-empty.xml",
      transcripts: "src/content/transcripts",
      savedTranscripts: "src/content/saved-transcripts",
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

// Where a build that reads the live feed keeps every Episode's Transcript,
// written once by scripts/transcripts.ts before `next build` (gitignored).
export const TRANSCRIPTS_SNAPSHOT = ".transcripts.json";

// Each Episode's Transcript, read afresh: the host's where the feed links
// one, the site's own from the `transcripts` branch otherwise. The build log
// names each Episode left without one, and why, through `warn`. The feed
// check calls this; pages and the build manifest call getTranscriptTexts.
export async function lookUpTranscripts(
  warn: (message: string) => void = (message) => console.warn(message)
): Promise<TranscriptTexts> {
  return loadTranscriptTexts(await getEpisodes(), {
    fetch: transcriptFetch(feedSource, io),
    saved: savedTranscripts(feedSource, io),
    warn,
  });
}

// The Transcripts every page and the build manifest read: a build from the
// live feed reads the one snapshot made before Next's workers start, as with
// the apps' lookups (getLookups), so a download that fails in one worker
// can't leave a page without the Transcript the manifest records. The
// fixture's are files, the same in every worker.
let transcriptTexts: Promise<TranscriptTexts> | undefined;
export function getTranscriptTexts(): Promise<TranscriptTexts> {
  transcriptTexts ??=
    feedSource.kind === "url"
      ? readSnapshot(TRANSCRIPTS_SNAPSHOT, "transcripts", parseTranscriptTexts)
      : lookUpTranscripts();
  return transcriptTexts;
}

// An Episode's Transcript, or null when it has none or it can't be had (the
// build log says which).
export async function getTranscript(
  episode: Episode
): Promise<Transcript | null> {
  const text = (await getTranscriptTexts()).get(episode.guid);
  return text === undefined ? null : parseTranscript(text);
}

// The Episodes that have a Transcript, newest first, as the build manifest
// records.
export async function getTranscribedEpisodes(): Promise<string[]> {
  const texts = await getTranscriptTexts();
  return (await getEpisodes())
    .map(({ guid }) => guid)
    .filter((guid) => texts.has(guid));
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
  lookups ??=
    feedSource.kind === "url"
      ? readSnapshot(LOOKUPS_SNAPSHOT, "lookups", parseLookups)
      : lookUpEpisodes();
  return lookups;
}

async function readSnapshot<T>(
  path: string,
  script: string,
  parse: (value: unknown) => T
): Promise<T> {
  let text: string;
  try {
    text = await io.readFile(path);
  } catch (error: unknown) {
    throw new Error(
      `Snapshot ${path} can't be read, so run \`npm run ${script}\` before \`next build\` (npm run build does): ${errorMessage(error)}`
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`Snapshot ${path} isn't JSON`);
  }
  return parse(value);
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
