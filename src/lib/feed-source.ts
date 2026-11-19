import { basename, join } from "node:path";
import {
  downloadText,
  errorMessage,
  type Fetch,
  type TextResponse,
} from "./download";
import type { FeedSourceAdapter, SpotifyAccess } from "./episode-feed";

// The feeds a build can read, named by FEED: the live Spreaker feed, and
// fixtures shaped like it for tests, one with Episodes and one without.
export const FEED_NAMES = ["live", "fixture", "empty"] as const;
export type FeedName = (typeof FEED_NAMES)[number];

// Which feed this build reads, from the environment. Builds read the fixture
// unless FEED says otherwise, so tests never depend on Spreaker; the deploy
// sets FEED=live, and a production build without it fails rather than
// publishing a fixture.
export function chooseFeedSource<Source>(
  env: { FEED?: string; SITE_ENV?: string },
  sources: Record<FeedName, Source>
): Source {
  const name = feedName(env.FEED);
  if (env.SITE_ENV === "production" && name !== "live") {
    throw new Error(
      `A production build must read the live feed (FEED=live), not ${feedLabel(name)}`
    );
  }
  return sources[name];
}

function feedName(value: string | undefined): FeedName {
  if (value === undefined || value === "") return "fixture";
  const name = FEED_NAMES.find((n) => n === value);
  if (!name) {
    throw new Error(
      `FEED is "${value}"; expected one of ${FEED_NAMES.join(", ")} (unset means fixture)`
    );
  }
  return name;
}

function feedLabel(name: FeedName): string {
  switch (name) {
    case "live":
      return "the live feed";
    case "fixture":
      return "the fixture";
    case "empty":
      return "the empty fixture";
    default: {
      const unhandled: never = name;
      return unhandled;
    }
  }
}

// The Spreaker feed, with the site's own Transcripts on the `transcripts`
// branch, read at its raw address. Builds read the branch here; Transcribe
// decides what's saved from its own git checkout of it instead (`isSaved` in
// scripts/transcribe.ts), with its own token.
export function liveSource(
  {
    url,
    savedTranscripts,
    spotifyKey,
  }: {
    url: string;
    savedTranscripts: string;
    spotifyKey: SpotifyAccess["key"];
  },
  fetch: Fetch
): FeedSourceAdapter {
  return {
    address: url,
    feedText: () => downloadText("Feed", url, fetch),
    hostTranscript: fetch,
    async savedTranscript(fileName) {
      const address = savedTranscripts + encodeURIComponent(fileName);
      let response: TextResponse;
      try {
        response = await fetch(address);
      } catch (error: unknown) {
        throw new Error(
          `Saved Transcript ${address} couldn't be reached: ${errorMessage(error)}`
        );
      }
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new Error(
          `Saved Transcript ${address} answered ${response.status} ${response.statusText}`
        );
      }
      return response.text();
    },
    appleLookup: fetch,
    spotify: { fetch, key: spotifyKey },
  };
}

// A fixture shaped like the live feed: its Transcripts in a folder beside it,
// named like the ones Spreaker serves; its saved ones in another, standing in
// for the branch; and Apple's lookup of its Episodes in a file. It never asks
// Spotify. Its Episodes are draft copy, and `standsInFor` is the feed address
// it pretends to be.
export function fixtureSource(
  {
    path,
    transcripts,
    savedTranscripts,
    appleLookup,
    standsInFor,
  }: {
    path: string;
    transcripts: string;
    savedTranscripts: string;
    appleLookup: string;
    standsInFor: string;
  },
  readFile: (path: string) => Promise<string>
): FeedSourceAdapter {
  const answer = async (read: Promise<string>): Promise<TextResponse> => {
    const text = await read;
    return { ok: true, status: 200, statusText: "OK", text: async () => text };
  };
  return {
    address: standsInFor,
    draft: true,
    feedText: () => readFile(path),
    hostTranscript: (url) =>
      answer(readFile(join(transcripts, basename(new URL(url).pathname)))),
    async savedTranscript(fileName) {
      try {
        return await readFile(join(savedTranscripts, fileName));
      } catch (error: unknown) {
        if (isMissingFile(error)) return null;
        throw error;
      }
    },
    appleLookup: () => answer(readFile(appleLookup)),
  };
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
