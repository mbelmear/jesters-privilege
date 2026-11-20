import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Fetch } from "@/lib/download";
import { createEpisodeFeed, fileSnapshotStore } from "@/lib/episode-feed";
import type { BuildRecord } from "@/lib/build-manifest";
import type { EpisodeListenLink } from "@/lib/episode-listen-links";
import type { Episode } from "@/lib/feed";
import { chooseFeedSource, fixtureSource, liveSource } from "@/lib/feed-source";
import { spotifyKey } from "@/lib/spotify-lookup";
import type { Transcript } from "@/lib/transcript";
import { LIVE_FEED_URL, site } from "./site";

// A hung download fails (or, for a Transcript, skips) rather than stalling
// the build.
const fetchWithTimeout: Fetch = (url, init) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });

const inRepo = (path: string) => join(process.cwd(), path);
const readRepoFile = (path: string) => readFile(inRepo(path), "utf8");

const fixture = (path: string) =>
  fixtureSource(
    {
      path,
      transcripts: "src/content/transcripts",
      savedTranscripts: "src/content/saved-transcripts",
      appleLookup: "src/content/apple-lookup-fixture.json",
      standsInFor: LIVE_FEED_URL,
    },
    readRepoFile
  );

// Where a build keeps everything it reads of the feed, written once by
// `npm run snapshot` (scripts/snapshot.ts) before `next build` (gitignored).
export const FEED_SNAPSHOT = ".feed-snapshot.json";

export const feedSnapshot = fileSnapshotStore(FEED_SNAPSHOT, {
  readFile: readRepoFile,
  writeFile: (path, text) => writeFile(inRepo(path), text),
});

// Deploys read the live feed (FEED=live); every other build reads a fixture
// shaped like it, whose Episodes are draft copy, so tests never depend on
// Spreaker. `FEED=empty` builds the site with no Episodes, as before Episode 1,
// to test the coming-soon state (docs/testing.md). Spotify is asked only of
// the live feed, with the key the deploy passes in (SPOTIFY_CLIENT_ID and
// SPOTIFY_CLIENT_SECRET); without it every Episode's Spotify link opens the
// show, and the run says the key is missing (`spotifyKey`).
export const feed = createEpisodeFeed(
  chooseFeedSource(
    { FEED: process.env.FEED, SITE_ENV: process.env.SITE_ENV },
    {
      live: liveSource(
        {
          url: LIVE_FEED_URL,
          savedTranscripts:
            "https://raw.githubusercontent.com/mbelmear/jesters-privilege/transcripts/",
          spotifyKey: () =>
            spotifyKey({
              SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
              SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
            }),
        },
        fetchWithTimeout
      ),
      fixture: fixture("src/content/feed-fixture.xml"),
      empty: fixture("src/content/feed-fixture-empty.xml"),
    }
  ),
  feedSnapshot,
  { listen: site.listen }
);

// Every Episode, newest first.
export const getEpisodes = (): Promise<Episode[]> => feed.episodes();

// An Episode's Transcript, or null when it has none or it couldn't be had
// (the snapshot's log says which).
export const getTranscript = (
  episode: Pick<Episode, "guid">
): Promise<Transcript | null> => feed.transcript(episode);

// The Episode's Listen link in each app the show is on; the build log names
// each one that opens the show for want of the Episode's own.
export const getEpisodeListenLinks = (
  episode: Pick<Episode, "guid" | "title">
): Promise<EpisodeListenLink[]> => feed.listenLinks(episode);

// What this build knows of the feed's Episodes, which the build manifest
// publishes for the feed check to compare against.
export const getBuildRecord = (): Promise<BuildRecord> => feed.record();
