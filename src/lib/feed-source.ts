import { basename, join } from "node:path";
import {
  downloadText,
  errorMessage,
  type Fetch,
  type TextResponse,
} from "./download";

// Where the Feed comes from: the Spreaker feed's address, with the site's own
// Transcripts on the `transcripts` branch (`savedTranscripts`, the branch's
// raw address); or a fixture shaped like it, with its Transcripts in a folder
// beside it, its saved ones in another standing in for the branch, and
// Apple's lookup of its Episodes in a file, which every build but a deploy reads
// (chooseFeedSource). A fixture's Episodes are draft copy;
// `standsInFor` is the feed address it pretends to be, which the page head
// links to.
export type FeedSource =
  | {
      kind: "fixture";
      path: string;
      transcripts: string;
      savedTranscripts: string;
      appleLookup: string;
      standsInFor: string;
      draft: true;
    }
  | { kind: "url"; url: string; savedTranscripts: string };

// The feeds a build can read, named by FEED: the live Spreaker feed, and
// fixtures shaped like it for tests, one with Episodes and one without.
export const FEED_NAMES = ["live", "fixture", "empty"] as const;
export type FeedName = (typeof FEED_NAMES)[number];

type UrlSource = Extract<FeedSource, { kind: "url" }>;
type FixtureSource = Extract<FeedSource, { kind: "fixture" }>;
export type FeedSources = {
  live: UrlSource;
  fixture: FixtureSource;
  empty: FixtureSource;
};

// Which feed this build reads, from the environment. Builds read the fixture
// unless FEED says otherwise, so tests never depend on Spreaker; the deploy
// sets FEED=live, and a production build without it fails rather than
// publishing a fixture.
export function chooseFeedSource(
  env: { FEED?: string; SITE_ENV?: string },
  sources: FeedSources
): FeedSource {
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

export type FeedIO = {
  fetch: Fetch;
  readFile: (path: string) => Promise<string>;
};

// The feed's public address, which podcast apps subscribe to.
export function feedUrl(source: FeedSource): string {
  switch (source.kind) {
    case "fixture":
      return source.standsInFor;
    case "url":
      return source.url;
    default: {
      const unhandled: never = source;
      return unhandled;
    }
  }
}

// Any failure here fails the build, so the last good deploy stays live (ADR 0001).
export async function loadFeedText(
  source: FeedSource,
  io: FeedIO
): Promise<string> {
  switch (source.kind) {
    case "fixture":
      return io.readFile(source.path);
    case "url":
      return downloadText("Feed", source.url, io.fetch);
    default: {
      const unhandled: never = source;
      return unhandled;
    }
  }
}

// How to fetch the Transcripts the Feed links to. The fixture's are files named
// like the ones Spreaker serves.
export function transcriptFetch(source: FeedSource, io: FeedIO): Fetch {
  switch (source.kind) {
    case "fixture":
      return async (url) => {
        const text = await io.readFile(
          join(source.transcripts, basename(new URL(url).pathname))
        );
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => text,
        };
      };
    case "url":
      return io.fetch;
    default: {
      const unhandled: never = source;
      return unhandled;
    }
  }
}

// How to read the site's own Transcripts, saved on the `transcripts` branch
// (ADR 0003): null when none is saved under the file name, and a throw when
// the branch can't be read. The fixture's are files in a folder.
export function savedTranscripts(
  source: FeedSource,
  io: FeedIO
): (fileName: string) => Promise<string | null> {
  switch (source.kind) {
    case "fixture":
      return async (fileName) => {
        try {
          return await io.readFile(join(source.savedTranscripts, fileName));
        } catch (error: unknown) {
          if (isMissingFile(error)) return null;
          throw error;
        }
      };
    case "url":
      return async (fileName) => {
        const url = source.savedTranscripts + encodeURIComponent(fileName);
        let response: TextResponse;
        try {
          response = await io.fetch(url);
        } catch (error: unknown) {
          throw new Error(
            `Saved Transcript ${url} couldn't be reached: ${errorMessage(error)}`
          );
        }
        if (response.status === 404) return null;
        if (!response.ok) {
          throw new Error(
            `Saved Transcript ${url} answered ${response.status} ${response.statusText}`
          );
        }
        return response.text();
      };
    default: {
      const unhandled: never = source;
      return unhandled;
    }
  }
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

// How to look up the Feed's Episodes in Apple Podcasts. The fixture answers
// every lookup with one file shaped like Apple's answer.
export function appleLookupFetch(source: FeedSource, io: FeedIO): Fetch {
  switch (source.kind) {
    case "fixture":
      return async () => {
        const text = await io.readFile(source.appleLookup);
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => text,
        };
      };
    case "url":
      return io.fetch;
    default: {
      const unhandled: never = source;
      return unhandled;
    }
  }
}
